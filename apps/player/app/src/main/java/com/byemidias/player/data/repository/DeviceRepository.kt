package com.byemidias.player.data.repository

import android.content.Context
import android.os.Build
import android.provider.Settings
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.data.api.ApiClient
import com.byemidias.player.data.database.AppDatabase
import com.byemidias.player.data.models.CachedCampaign
import com.byemidias.player.data.models.CachedMedia
import com.byemidias.player.data.models.CachedPlaylist
import com.byemidias.player.data.models.DeviceConfig
import com.google.gson.Gson
import com.google.gson.JsonObject
import java.io.File
import java.util.UUID

class DeviceRepository(
    private val context: Context,
    private val database: AppDatabase
) {
    private val configDao = database.configDao()
    private val playlistDao = database.playlistDao()
    private val mediaDao = database.mediaDao()
    private val campaignDao = database.campaignDao()
    private val gson = Gson()

    private var apiClient: ApiClient? = null

    private suspend fun getApiClient(): ApiClient {
        if (apiClient == null) {
            val baseUrl = configDao.getValue("api_base_url") ?: ""
            val supabaseUrl = configDao.getValue("supabase_url") ?: ""
            val supabaseKey = configDao.getValue("supabase_anon_key") ?: ""
            apiClient = ApiClient(baseUrl, supabaseUrl, supabaseKey)
        }
        return apiClient!!
    }

    // --- Device ID ---

    fun getDeviceUuid(): String {
        val prefs = context.getSharedPreferences("byemidias", Context.MODE_PRIVATE)
        var uuid = prefs.getString("device_uuid", null)
        if (uuid == null) {
            uuid = UUID.randomUUID().toString()
            prefs.edit().putString("device_uuid", uuid).apply()
        }
        return uuid
    }

    fun getDeviceId(): String? {
        val prefs = context.getSharedPreferences("byemidias", Context.MODE_PRIVATE)
        return prefs.getString("device_id", null)
    }

    fun setDeviceId(deviceId: String) {
        val prefs = context.getSharedPreferences("byemidias", Context.MODE_PRIVATE)
        prefs.edit().putString("device_id", deviceId).apply()
    }

    fun isActivated(): Boolean {
        val prefs = context.getSharedPreferences("byemidias", Context.MODE_PRIVATE)
        return prefs.getBoolean("is_activated", false)
    }

    fun setActivated(activated: Boolean) {
        val prefs = context.getSharedPreferences("byemidias", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("is_activated", activated).apply()
    }

    // --- Content Version ---

    suspend fun getContentVersion(): Int {
        return configDao.getValue("content_version")?.toIntOrNull() ?: 0
    }

    suspend fun setContentVersion(version: Int) {
        configDao.set(DeviceConfig("content_version", version.toString()))
    }

    // --- Activation ---

    suspend fun activateDevice(activationCode: String): Result<String> {
        val result = getApiClient().activateDevice(
            deviceUuid = getDeviceUuid(),
            activationCode = activationCode,
            model = Build.MODEL,
            manufacturer = Build.MANUFACTURER,
            osVersion = Build.VERSION.RELEASE,
            playerVersion = getPlayerVersionName(),
            resolution = getResolution()
        )

        return result.map { json ->
            val deviceId = json.get("device_id")?.asString ?: throw Exception("No device_id")
            setDeviceId(deviceId)
            setActivated(true)

            // Store config
            json.get("api_base_url")?.asString?.let { configDao.set(DeviceConfig("api_base_url", it)) }
            json.get("supabase_url")?.asString?.let { configDao.set(DeviceConfig("supabase_url", it)) }
            json.get("supabase_anon_key")?.asString?.let { configDao.set(DeviceConfig("supabase_anon_key", it)) }
            json.get("content_version")?.asString?.let { configDao.set(DeviceConfig("content_version", it)) }

            apiClient = null // Reset with new config
            deviceId
        }
    }

    // --- Heartbeat ---

    suspend fun sendHeartbeat(
        status: String,
        currentContent: String? = null,
        currentPlaylist: String? = null,
        errorMessage: String? = null
    ): Result<Boolean> {
        val deviceId = getDeviceId() ?: return Result.failure(Exception("Device not activated"))
        val storageAvailable = context.filesDir.freeSpace

        return getApiClient().sendHeartbeat(
            deviceId = deviceId,
            status = status,
            playerVersion = getPlayerVersionName(),
            storageAvailable = storageAvailable,
            currentContent = currentContent,
            currentPlaylist = currentPlaylist,
            errorMessage = errorMessage
        ).map { true }
    }

    // --- Sync ---

    suspend fun syncContent(): Result<Boolean> {
        val deviceId = getDeviceId() ?: return Result.failure(Exception("Device not activated"))
        val currentVersion = getContentVersion()

        return getApiClient().getDeviceSync(deviceId, currentVersion).map { json ->
            val newVersion = json.get("content_version")?.asInt ?: return@map false

            if (newVersion > currentVersion) {
                // Parse and cache playlists
                json.getAsJsonArray("playlists")?.forEach { element ->
                    val obj = element.asJsonObject
                    val playlist = CachedPlaylist(
                        id = obj.get("id").asString,
                        name = obj.get("name").asString,
                        description = obj.get("description")?.asString,
                        items = obj.get("items").toString(),
                        contentVersion = newVersion
                    )
                    playlistDao.insert(playlist)
                }

                // Parse and cache media
                json.getAsJsonArray("media")?.forEach { element ->
                    val obj = element.asJsonObject
                    val media = CachedMedia(
                        id = obj.get("id").asString,
                        name = obj.get("name").asString,
                        type = obj.get("type").asString,
                        fileUrl = obj.get("file_url").asString,
                        localPath = null,
                        duration = obj.get("duration")?.asInt,
                        fileSize = obj.get("file_size")?.asLong,
                        width = obj.get("width")?.asInt,
                        height = obj.get("height")?.asInt,
                        contentVersion = newVersion
                    )
                    mediaDao.insert(media)
                }

                // Parse and cache campaigns
                json.getAsJsonArray("campaigns")?.forEach { element ->
                    val obj = element.asJsonObject
                    val campaign = CachedCampaign(
                        id = obj.get("id").asString,
                        name = obj.get("name").asString,
                        playlistId = obj.get("playlist_id").asString,
                        status = obj.get("status").asString,
                        startDate = obj.get("start_date")?.asString,
                        endDate = obj.get("end_date")?.asString,
                        startTime = obj.get("start_time")?.asString,
                        endTime = obj.get("end_time")?.asString,
                        daysOfWeek = obj.get("days_of_week").toString(),
                        priority = obj.get("priority").asInt,
                        contentVersion = newVersion
                    )
                    campaignDao.insert(campaign)
                }

                setContentVersion(newVersion)
            }

            true
        }
    }

    // --- Download Media ---

    suspend fun downloadMedia(media: CachedMedia): Result<String> {
        return try {
            val dir = File(context.filesDir, "media")
            dir.mkdirs()
            val file = File(dir, "${media.id}_${media.name}")

            if (file.exists()) {
                return Result.success(file.absolutePath)
            }

            val url = java.net.URL(media.fileUrl)
            val connection = url.openConnection()
            connection.connect()

            val inputStream = connection.getInputStream()
            file.outputStream().use { output ->
                inputStream.copyTo(output)
            }
            inputStream.close()

            mediaDao.updateLocalPath(media.id, file.absolutePath, System.currentTimeMillis())
            Result.success(file.absolutePath)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Helpers ---

    private fun getPlayerVersionName(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    private fun getResolution(): String {
        val dm = context.resources.displayMetrics
        return "${dm.widthPixels}x${dm.heightPixels}"
    }

    // --- Cache access ---

    suspend fun getCachedPlaylists() = playlistDao.getAll()
    suspend fun getCachedMedia() = mediaDao.getAll()
    suspend fun getCachedActiveCampaigns() = campaignDao.getActive()
    suspend fun getDownloadedMedia() = mediaDao.getDownloaded()
}
