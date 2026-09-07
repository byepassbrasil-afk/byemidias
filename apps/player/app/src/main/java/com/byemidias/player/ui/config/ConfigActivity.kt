package com.byemidias.player.ui.config

import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.text.InputType
import android.util.Log
import android.view.View
import android.widget.*
import android.widget.SeekBar
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.BuildConfig
import com.byemidias.player.R
import com.byemidias.player.ui.logs.LogsActivity
import com.byemidias.player.ui.player.PlayerActivity
import com.byemidias.player.ui.qr.QrDeviceActivity
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
        prefs = getSharedPreferences("byemidias", MODE_PRIVATE)
        // Apply rotation BEFORE setContentView so the layout inflates correctly
        try {
            applyRotation(prefs.getInt("screen_rotation", 0))
        } catch (_: Exception) {}
        setContentView(R.layout.activity_config)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val rootView = findViewById<android.view.View>(android.R.id.content)
        try {
            val rotation = prefs.getInt("screen_rotation", 0)
            applyVisualRotationToContent(rootView, rotation)
        } catch (_: Exception) {}

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
        val kioskPinInput = findViewById<EditText>(R.id.kioskPinInput)
        val mirrorHSwitch = findViewById<Switch>(R.id.mirrorHSwitch)
        val mirrorVSwitch = findViewById<Switch>(R.id.mirrorVSwitch)
        val videoPlayerSpinner = findViewById<Spinner>(R.id.videoPlayerSpinner)
        val autoUpdateSwitch = findViewById<Switch>(R.id.autoUpdateSwitch)
        val lowMemRestartSwitch = findViewById<Switch>(R.id.lowMemRestartSwitch)
        val htmlRenderSpinner = findViewById<Spinner>(R.id.htmlRenderSpinner)

        // Load current URL
        val currentUrl = prefs.getString("api_base_url", null) ?: BuildConfig.API_BASE_URL
        urlInput.setText(currentUrl)

        // Load kiosk PIN
        val savedPin = prefs.getString("kiosk_pin", "1234") ?: "1234"
        kioskPinInput.setText(savedPin)

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

        // Image fit mode spinner — values: fit, fill, centerCrop, center, fitCenter, fitXY
        val imageFitSpinner = findViewById<Spinner>(R.id.imageFitSpinner)
        val fitModes = listOf("fit", "fill", "centerCrop", "center", "fitCenter", "fitXY")
        val savedFit = prefs.getString("image_fit_mode", "fit") ?: "fit"
        imageFitSpinner.setSelection(fitModes.indexOf(savedFit).takeIf { it >= 0 } ?: 0)

        // Image rotation lock spinner — values: 0, 90, 180, 270
        val imageRotationSpinner = findViewById<Spinner>(R.id.imageRotationSpinner)
        val rotations = listOf(0, 90, 180, 270)
        val savedRot = prefs.getInt("image_rotation_lock", 0)
        imageRotationSpinner.setSelection(rotations.indexOf(savedRot).takeIf { it >= 0 } ?: 0)

        // Video volume seekbar
        val videoVolumeSeek = findViewById<SeekBar>(R.id.videoVolumeSeek)
        val videoVolumeLabel = findViewById<TextView>(R.id.videoVolumeLabel)
        fun updateVolumeLabel(v: Int) {
            videoVolumeLabel.text = "Volume: $v%"
        }
        val savedVolume = prefs.getInt("video_volume", 100)
        videoVolumeSeek.progress = savedVolume.coerceIn(0, 100)
        updateVolumeLabel(savedVolume)
        videoVolumeSeek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                updateVolumeLabel(progress)
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

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
            val pin = kioskPinInput.text.toString().trim().ifEmpty { "1234" }
            prefs.edit().apply {
                putString("api_base_url", url)
                putInt("screen_rotation", rotation)
                putBoolean("mirror_horizontal", mirrorHSwitch.isChecked)
                putBoolean("mirror_vertical", mirrorVSwitch.isChecked)
                putInt("video_player", videoPlayerSpinner.selectedItemPosition)
                putBoolean("auto_update", autoUpdateSwitch.isChecked)
                putBoolean("low_mem_restart", lowMemRestartSwitch.isChecked)
                putInt("html_render", htmlRenderSpinner.selectedItemPosition)
                putString("image_fit_mode", fitModes[imageFitSpinner.selectedItemPosition])
                putInt("image_rotation_lock", rotations[imageRotationSpinner.selectedItemPosition])
                putInt("video_volume", videoVolumeSeek.progress)
                putString("kiosk_pin", pin)
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

        // Exit button — requires PIN
        exitBtn.setOnClickListener {
            showExitPinDialog()
        }

        // Rotate now button — manually cycle orientation (useful when device sensor fails)
        val rotateNowBtn = findViewById<Button>(R.id.rotateNowBtn)
        rotateNowBtn?.setOnClickListener {
            val current = prefs.getInt("screen_rotation", 0)
            // Cycle: 0 → 90 → 270 → 180 → 0
            val next = when (current) {
                0 -> 90
                90 -> 270
                270 -> 180
                180 -> 0
                else -> 0
            }
            prefs.edit().putInt("screen_rotation", next).commit()
            val labels = listOf("Retrato", "Paisagem", "Paisagem Invertida", "Retrato Invertido", "Automático")
            val label = when (next) {
                0 -> labels[0]
                90 -> labels[1]
                270 -> labels[2]
                180 -> labels[3]
                else -> labels[4]
            }
            applyRotation(next)
            val rootView = findViewById<android.view.View>(android.R.id.content)
            applyVisualRotationToContent(rootView, next)
            statusText.text = "Rotação: $label"
            statusText.visibility = View.VISIBLE
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                statusText.visibility = View.GONE
            }, 1500)
        }

        // Show QR Code button (server-generated)
        val showQrBtn = findViewById<Button>(R.id.showQrBtn)
        showQrBtn.setOnClickListener {
            try {
                val intent = Intent(this, QrDeviceActivity::class.java)
                startActivity(intent)
            } catch (e: Exception) {
                statusText.text = "Erro ao abrir QR: ${e.message}"
                statusText.visibility = View.VISIBLE
            }
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

    /**
     * Apply visual rotation to the config screen.
     *
     * SIMPLEST APPROACH: just use setRequestedOrientation.
     * On most Android devices this works. On Google TV it's ignored,
     * but the config screen is just settings — readable in landscape too.
     *
     * The user can still navigate config with D-pad in landscape mode.
     */
    private fun applyVisualRotationToContent(view: android.view.View, rotation: Int) {
        try {
            val r = if (rotation == -1) 0 else rotation
            // Just apply the orientation — no view rotation needed
            // The activity itself will re-create and re-layout with the correct orientation
            when (r) {
                90 -> {
                    if (requestedOrientation != android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE) {
                        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    }
                }
                270 -> {
                    if (requestedOrientation != android.content.pm.ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE) {
                        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                    }
                }
                180 -> {
                    if (requestedOrientation != android.content.pm.ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT) {
                        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                    }
                }
                0 -> {
                    if (requestedOrientation != android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT) {
                        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    }
                }
            }
            android.util.Log.i(tag, "Config rotation set to $r via setRequestedOrientation")
        } catch (e: Exception) {
            android.util.Log.e(tag, "applyVisualRotationToContent: ${e.message}", e)
        }
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        // Re-apply rotation on config change
        try {
            val r = prefs.getInt("screen_rotation", 0)
            applyRotation(r)
            val rootView = findViewById<android.view.View>(android.R.id.content)
            applyVisualRotationToContent(rootView, r)
        } catch (_: Exception) {}
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

    private fun showExitPinDialog() {
        val storedPin = prefs.getString("kiosk_pin", "1234")
        val input = android.widget.EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "Digite o PIN"
            setPadding(48, 32, 48, 32)
        }
        AlertDialog.Builder(this)
            .setTitle("Sair do Kiosk")
            .setMessage("Digite o PIN para sair.")
            .setView(input)
            .setPositiveButton("Confirmar") { _, _ ->
                if (input.text.toString() == storedPin) {
                    ByeMidiasApp.instance.kioskExitRequested = true
                    try {
                        stopLockTask()
                    } catch (_: Exception) {}
                    finishAffinity()
                    System.exit(0)
                } else {
                    Toast.makeText(this, "PIN incorreto", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
