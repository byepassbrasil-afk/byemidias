package com.byemidias.player.ui.config

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.byemidias.player.BuildConfig
import com.byemidias.player.R
import com.byemidias.player.ui.logs.LogsActivity
import com.byemidias.player.ui.player.PlayerActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ConfigActivity : ComponentActivity() {

    private val tag = "Config"
    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_config)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        prefs = getSharedPreferences("byemidias", MODE_PRIVATE)

        val urlInput = findViewById<EditText>(R.id.urlInput)
        val saveBtn = findViewById<Button>(R.id.saveBtn)
        val exitBtn = findViewById<Button>(R.id.exitBtn)
        val statusText = findViewById<TextView>(R.id.configStatusText)
        val viewLogsBtn = findViewById<Button>(R.id.viewLogsBtn)

        val syncBtn = findViewById<Button>(R.id.syncBtn)
        val forceSyncBtn = findViewById<Button>(R.id.forceSyncBtn)
        val rebootBtn = findViewById<Button>(R.id.rebootBtn)
        val deviceInfoText = findViewById<TextView>(R.id.deviceInfoText)

        val orientationSpinner = findViewById<Spinner>(R.id.orientationSpinner)
        val mirrorHSwitch = findViewById<Switch>(R.id.mirrorHSwitch)
        val mirrorVSwitch = findViewById<Switch>(R.id.mirrorVSwitch)
        val videoPlayerSpinner = findViewById<Spinner>(R.id.videoPlayerSpinner)
        val autoUpdateSwitch = findViewById<Switch>(R.id.autoUpdateSwitch)
        val lowMemRestartSwitch = findViewById<Switch>(R.id.lowMemRestartSwitch)
        val htmlRenderSpinner = findViewById<Spinner>(R.id.htmlRenderSpinner)

        // Load current URL
        val currentUrl = prefs.getString("api_base_url", null) ?: BuildConfig.API_BASE_URL
        urlInput.setText(currentUrl)

        // Load device info
        val deviceId = prefs.getString("device_id", "")
        val deviceUuid = prefs.getString("device_uuid", "")
        deviceInfoText.text = "Device ID: ${deviceId?.take(12)}...\nUUID: ${deviceUuid?.take(12)}...\nURL: ${currentUrl.take(30)}"

        // Orientation spinner
        val orientations = listOf("Retrato", "Paisagem", "Paisagem Invertida", "Retrato Invertido", "Automatico")
        val orientationValues = listOf(0, 90, 270, 180, -1)
        val savedRotation = prefs.getInt("screen_rotation", 0)
        val currentOrientationIndex = orientationValues.indexOf(savedRotation).takeIf { it >= 0 } ?: 4
        orientationSpinner.setSelection(currentOrientationIndex)

        // Video player spinner
        val videoPlayers = listOf("Nativo", "VLC", "ExoPlayer")
        videoPlayerSpinner.setSelection(prefs.getInt("video_player", 0).coerceIn(0, 2))

        // HTML render spinner
        val htmlRenders = listOf("Nativo", "WebView")
        htmlRenderSpinner.setSelection(prefs.getInt("html_render", 0).coerceIn(0, 1))

        // Load switches
        autoUpdateSwitch.isChecked = prefs.getBoolean("auto_update", true)
        lowMemRestartSwitch.isChecked = prefs.getBoolean("low_mem_restart", true)
        mirrorHSwitch.isChecked = prefs.getBoolean("mirror_horizontal", false)
        mirrorVSwitch.isChecked = prefs.getBoolean("mirror_vertical", false)

        // Save button
        saveBtn.setOnClickListener {
            val url = urlInput.text.toString().trim()
            if (url.isEmpty()) {
                statusText.text = "URL nao pode ser vazia"
                statusText.visibility = View.VISIBLE
                return@setOnClickListener
            }

            val rotation = orientationValues[orientationSpinner.selectedItemPosition]
            prefs.edit().apply {
                putString("api_base_url", url)
                putInt("screen_rotation", rotation)
                putBoolean("mirror_horizontal", mirrorHSwitch.isChecked)
                putBoolean("mirror_vertical", mirrorVSwitch.isChecked)
                putInt("video_player", videoPlayerSpinner.selectedItemPosition)
                putBoolean("auto_update", autoUpdateSwitch.isChecked)
                putBoolean("low_mem_restart", lowMemRestartSwitch.isChecked)
                putInt("html_render", htmlRenderSpinner.selectedItemPosition)
                commit()
            }

            statusText.text = "Configuracoes salvas!"
            statusText.visibility = View.VISIBLE

            // Apply rotation immediately
            applyRotation(rotation)

            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                statusText.visibility = View.GONE
            }, 2000)
        }

        // Sync button
        syncBtn.setOnClickListener {
            statusText.text = "Sincronizando..."
            statusText.visibility = View.VISIBLE
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val apiUrl = urlInput.text.toString().trim()
                    val body = JSONObject().apply {
                        put("device_id", deviceId ?: "")
                        put("status", "online")
                        put("player_version", try { packageManager.getPackageInfo(packageName, 0).versionName } catch (_: Exception) { "1.0.0" })
                    }
                    val result = httpPost("$apiUrl/api/device/heartbeat", body.toString())
                    val json = JSONObject(result)
                    val version = json.optInt("content_version", 0)
                    withContext(Dispatchers.Main) {
                        statusText.text = "Sync OK! v$version"
                        statusText.visibility = View.VISIBLE
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        statusText.text = "Erro: ${e.message}"
                        statusText.visibility = View.VISIBLE
                    }
                }
            }
        }

        // Force sync button
        forceSyncBtn.setOnClickListener {
            statusText.text = "Forçando sync..."
            statusText.visibility = View.VISIBLE
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val apiUrl = urlInput.text.toString().trim()
                    // Bump content_version
                    val body = JSONObject().apply {
                        put("device_id", deviceId ?: "")
                        put("content_version", System.currentTimeMillis() % 100000)
                    }
                    val result = httpPost("$apiUrl/api/device/heartbeat", body.toString())
                    withContext(Dispatchers.Main) {
                        statusText.text = "Sync forçado!"
                        statusText.visibility = View.VISIBLE
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        statusText.text = "Erro: ${e.message}"
                        statusText.visibility = View.VISIBLE
                    }
                }
            }
        }

        // Reboot button
        rebootBtn.setOnClickListener {
            val intent = Intent(this, PlayerActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            finish()
        }

        // View logs button
        viewLogsBtn.setOnClickListener {
            try {
                val intent = Intent(this, LogsActivity::class.java)
                startActivity(intent)
            } catch (e: Exception) {
                statusText.text = "Erro ao abrir logs: ${e.message}"
                statusText.visibility = View.VISIBLE
            }
        }

        // Exit button
        exitBtn.setOnClickListener {
            finishAffinity()
            System.exit(0)
        }
    }

    private fun applyRotation(rotation: Int) {
        when (rotation) {
            90 -> requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            270 -> requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
            180 -> requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
            0 -> requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            else -> requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        }
    }

    private fun httpPost(urlStr: String, jsonBody: String): String {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        conn.doOutput = true
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.connect()
        conn.outputStream.use { os ->
            os.write(jsonBody.toByteArray(Charsets.UTF_8))
            os.flush()
        }
        val code = conn.responseCode
        val body = if (code in 200..299) {
            BufferedReader(InputStreamReader(conn.inputStream)).readText()
        } else {
            val err = conn.errorStream
            if (err != null) BufferedReader(InputStreamReader(err)).readText() else "{}"
        }
        conn.disconnect()
        return body
    }
}
