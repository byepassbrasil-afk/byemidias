package com.byemidias.player.cache

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Gerencia cache de arquivos de mídia (imagens e vídeos) em disco local.
 * Permite que o player rode offline após primeiro sync online.
 *
 * Estrutura:
 *   cacheDir/
 *     md5_hash_do_url.bin  → arquivo binário
 *     index.json             → { "url": "hash" } para mapear URL → arquivo
 */
class MediaFileCache(private val context: Context) {

    private val tag = "MediaFileCache"
    private val cacheDir: File by lazy {
        File(context.cacheDir, "media").apply { mkdirs() }
    }
    private val indexFile: File by lazy { File(cacheDir, "index.json") }
    private val indexMap: MutableMap<String, String> = mutableMapOf()

    init {
        loadIndex()
    }

    private fun loadIndex() {
        try {
            if (!indexFile.exists()) return
            val text = indexFile.readText()
            val json = org.json.JSONObject(text)
            for (k in json.keys()) {
                indexMap[k] = json.getString(k)
            }
        } catch (e: Exception) {
            Log.w(tag, "loadIndex failed: ${e.message}")
        }
    }

    private fun saveIndex() {
        try {
            val json = org.json.JSONObject()
            for ((k, v) in indexMap) json.put(k, v)
            indexFile.writeText(json.toString())
        } catch (e: Exception) {
            Log.w(tag, "saveIndex failed: ${e.message}")
        }
    }

    private fun hash(url: String): String {
        val md = MessageDigest.getInstance("MD5")
        val bytes = md.digest(url.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun fileFor(url: String): File = File(cacheDir, hash(url) + ".bin")

    /** Retorna o path local se cacheado, null caso contrário */
    fun getCachedFile(url: String): String? {
        val f = fileFor(url)
        return if (f.exists() && f.length() > 0) f.absolutePath else null
    }

    /** Baixa o arquivo para o cache local. Retorna o path local ou null em caso de erro. */
    suspend fun download(url: String): String? = withContext(Dispatchers.IO) {
        try {
            // Se já existe, retorna
            getCachedFile(url)?.let { return@withContext it }

            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 30000
            conn.readTimeout = 60000
            conn.requestMethod = "GET"
            conn.connect()

            if (conn.responseCode !in 200..299) {
                conn.disconnect()
                return@withContext null
            }

            val f = fileFor(url)
            val tmp = File(cacheDir, hash(url) + ".tmp")

            conn.inputStream.use { input ->
                FileOutputStream(tmp).use { out ->
                    input.copyTo(out)
                }
            }
            conn.disconnect()

            // Rename atômico
            if (f.exists()) f.delete()
            if (tmp.renameTo(f)) {
                indexMap[url] = f.name
                saveIndex()
                Log.i(tag, "Cached: ${url.take(60)} (${f.length() / 1024}KB)")
                f.absolutePath
            } else {
                Log.e(tag, "rename tmp → cache failed")
                null
            }
        } catch (e: Exception) {
            Log.w(tag, "download failed: ${url.take(80)} — ${e.message}")
            null
        }
    }

    /**
     * Pré-baixar uma lista de URLs. Retorna lista de URLs que falharam.
     * Não bloqueia — roda em background.
     */
    suspend fun prefetchAll(urls: List<String>): List<String> = withContext(Dispatchers.IO) {
        val failed = mutableListOf<String>()
        for (url in urls.distinct()) {
            if (getCachedFile(url) == null) {
                val result = download(url)
                if (result == null) failed.add(url)
            }
        }
        Log.i(tag, "prefetchAll done: ${urls.size - failed.size}/${urls.size} succeeded")
        failed
    }

    fun getCacheSizeMB(): Double {
        val bytes = cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
        return bytes / 1024.0 / 1024.0
    }

    fun clear() {
        cacheDir.walkTopDown().forEach { if (it.isFile) it.delete() }
        indexMap.clear()
        saveIndex()
    }
}
