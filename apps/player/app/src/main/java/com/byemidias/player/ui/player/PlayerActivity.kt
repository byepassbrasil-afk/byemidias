package com.byemidias.player.ui.player

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentCallbacks2
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ScrollView
import android.widget.TextView
import android.widget.LinearLayout
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem as ExoMediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.BuildConfig
import com.byemidias.player.R
import com.byemidias.player.service.PlayerService
import com.byemidias.player.ui.config.ConfigActivity
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedReader
import java.io.File
import java.io.FileWriter
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class PlayerActivity : ComponentActivity() {

    private val tag = "Player"
    private var prefs: SharedPreferences? = null
    private var fileLogger: FileLogger? = null

    private var rootLayout: FrameLayout? = null
    private var statusText: TextView? = null

    private var mediaList = mutableListOf<MediaItem>()
    private var currentIndex = 0
    private var currentCampaignId: String? = null
    private var currentPlaylistId: String? = null
    private var currentContentVersion: Long = 0
    private var layoutZones: List<ZoneData> = emptyList()
    @Volatile private var needsResync = false
    private var syncIntervalSeconds = 30
    private var syncHandler: Handler? = null

    private var exoPlayer: ExoPlayer? = null
    private var exoPlayerView: PlayerView? = null
    private var imageView: ImageView? = null
    private var activeZoneViews = mutableListOf<View>()
    private var clockTextViews = mutableListOf<TextView>()
    private var weatherTextViews = mutableListOf<TextView>()
    private var widgetTextViews = mutableListOf<TextView>()
    private var clockHandler: Handler? = null
    private var lastAppliedRotation = 0
    private var lastAppliedMirrorH = false
    private var lastAppliedMirrorV = false
    private var tapCount = 0
    private var lastTapTime = 0L
    private val TAP_THRESHOLD = 10
    private val TAP_TIMEOUT = 2000L

    data class MediaItem(
        val id: String,
        val name: String,
        val displayName: String? = null,
        val type: String,
        val fileUrl: String,
        val duration: Int,
        val campaignId: String?,
        val playlistId: String?,
        val isSlot: Boolean = false,
        val slotDurationSeconds: Int = 0,
        val slotHasContent: Boolean = true,
        val slotContentDuration: Int = 0,
        val defaultOrientation: String = "auto"  // "auto" | "portrait" | "landscape"
    ) {
        companion object {
            private val IMAGE_EXTS = setOf("png", "jpg", "jpeg", "avif", "webp", "gif")
            private val VIDEO_EXTS = setOf("mp4", "avi", "wmv", "mkv")

            fun isImageFile(fileUrl: String): Boolean {
                val clean = fileUrl.substringBefore("?").substringBefore("#")
                val ext = clean.substringAfterLast(".", "").lowercase()
                return IMAGE_EXTS.contains(ext)
            }

            fun isVideoFile(fileUrl: String): Boolean {
                val clean = fileUrl.substringBefore("?").substringBefore("#")
                val ext = clean.substringAfterLast(".", "").lowercase()
                return VIDEO_EXTS.contains(ext)
            }

            fun getResolvedType(fileUrl: String, fallbackType: String): String {
                if (isImageFile(fileUrl)) return "image"
                if (isVideoFile(fileUrl)) return "video"
                return fallbackType
            }
        }

        fun resolvedType(): String = getResolvedType(fileUrl, type)
        fun isImage(): Boolean = isImageFile(fileUrl)
        fun isVideo(): Boolean = isVideoFile(fileUrl)
    }

    data class ZoneData(
        val name: String,
        val x: Float,
        val y: Float,
        val width: Float,
        val height: Float,
        val type: String,
        val widgetType: String,
        val widgetConfig: Map<String, String>
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            super.onCreate(savedInstanceState)
            Log.i(tag, "onCreate START — ByeMidias Player v1.0.82")

            // CRITICAL: Apply orientation BEFORE setContentView so layout inflates with correct dimensions
            prefs = getSharedPreferences("byemidias", MODE_PRIVATE)
            try {
                applyRotationFromPrefs()
            } catch (e: Exception) {
                Log.e(tag, "applyRotation failed: ${e.message}")
            }

            // Detect and log screen dimensions BEFORE setContentView
            try {
                val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display else windowManager.defaultDisplay
                @Suppress("DEPRECATION")
                val w = display?.width ?: 0
                @Suppress("DEPRECATION")
                val h = display?.height ?: 0
                @Suppress("DEPRECATION")
                val rotation = display?.rotation ?: 0
                flog("I", tag, "Display BEFORE setContentView: w=$w h=$h rotation=$rotation")
            } catch (e: Exception) {
                flog("W", tag, "Could not log display: ${e.message}")
            }

            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    window.insetsController?.let {
                        it.hide(android.view.WindowInsets.Type.systemBars())
                        it.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    }
                } else {
                    @Suppress("DEPRECATION")
                    window.decorView.systemUiVisibility = (
                        View.SYSTEM_UI_FLAG_FULLSCREEN or
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    )
                }
            } catch (e: Exception) {
                Log.e(tag, "Immersive mode failed: ${e.message}")
            }

            // KIOSK MODE: Start lock task to prevent leaving the app
            try {
                startLockTask()
                Log.i(tag, "Lock task started")
            } catch (e: Exception) {
                Log.w(tag, "startLockTask failed (device may not be owner): ${e.message}")
            }

            try {
                @Suppress("DEPRECATION")
                onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
                    override fun handleOnBackPressed() {
                        Log.i(tag, "Back pressed — ignored")
                    }
                })
            } catch (e: Exception) {
                Log.e(tag, "Back press callback failed: ${e.message}")
            }

            try {
                requestNotificationPermission()
            } catch (e: Exception) {
                Log.e(tag, "requestNotificationPermission failed: ${e.message}")
            }

            fileLogger = FileLogger(filesDir.path)

            val deviceId = prefs?.getString("device_id", null)
            Log.i(tag, "deviceId=${deviceId?.take(12) ?: "null"}")

            if (deviceId.isNullOrEmpty()) {
                showActivation()
            } else {
                startPlayer()
            }

            Log.i(tag, "onCreate END")
        } catch (e: Exception) {
            Log.e(tag, "FATAL CRASH in onCreate: ${e.message}", e)
            try {
                showCrashError(e)
            } catch (_: Exception) {}
        }
    }

    private fun showCrashError(e: Exception) {
        val tv = TextView(this)
        tv.setTextColor(Color.RED)
        tv.setBackgroundColor(Color.BLACK)
        tv.gravity = Gravity.CENTER
        tv.textSize = 14f
        tv.setPadding(32, 32, 32, 32)
        tv.text = "CRASH: ${e.javaClass.simpleName}\n${e.message}\n\nVeja crash.log no storage do app"
        setContentView(tv)
    }

    override fun onResume() {
        super.onResume()
        try {
            applyRotationFromPrefs()
        } catch (_: Exception) {}
        try {
            lifecycleScope.launch(Dispatchers.IO) {
                sendHeartbeatOn()
            }
        } catch (_: Exception) {}
    }

    override fun onStop() {
        super.onStop()
        try {
            lifecycleScope.launch(Dispatchers.IO) {
                sendHeartbeatOff()
            }
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        try { exoPlayer?.release(); exoPlayer = null } catch (_: Exception) {}
        try { clockHandler?.removeCallbacksAndMessages(null) } catch (_: Exception) {}
        try { syncHandler?.removeCallbacksAndMessages(null) } catch (_: Exception) {}
        try {
            lifecycleScope.launch(Dispatchers.IO) {
                sendHeartbeatOff()
            }
        } catch (_: Exception) {}
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        // No-op: removed persistent service auto-restart (flagged as malware)
    }

    /**
     * Apply rotation by calling setRequestedOrientation BEFORE setContentView.
     * This forces Android to re-create the activity with the correct orientation
     * and layout dimensions from the start.
     *
     * Also tries the View-based fallback (rootLayout rotation) for devices where
     * setRequestedOrientation is ignored (some Android TV boxes).
     */
    private fun applyRotationFromPrefs() {
        val p = prefs ?: return
        val rotation = p.getInt("screen_rotation", 0)
        val mirrorH = p.getBoolean("mirror_horizontal", false)
        val mirrorV = p.getBoolean("mirror_vertical", false)

        flog("I", tag, "applyRotationFromPrefs: rotation=$rotation, mirrorH=$mirrorH, mirrorV=$mirrorV")

        // Step 1: Try to set activity orientation (works on standard Android, ignored on Google TV)
        try {
            when (rotation) {
                90 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                270 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                180 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                0 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                -1 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            }
        } catch (_: Exception) {}

        // Step 2: Force physical display rotation via reflection (works on some Chinese TV boxes)
        forceDisplayRotation(rotation)

        // Step 3: Apply mirror to rootLayout (visual mirror only, no rotation)
        val rl = rootLayout ?: return
        runOnUiThread {
            rl.scaleX = if (mirrorH) -1f else 1f
            rl.scaleY = if (mirrorV) -1f else 1f
        }
    }

    /**
     * Force physical display rotation. This bypasses the activity-level orientation
     * request and actually rotates the display hardware, which is required for
     * Chinese Android TV boxes (Mecool, X96, T95, etc.) that ignore setRequestedOrientation.
     */
    private fun forceDisplayRotation(rotation: Int) {
        try {
            val surfaceRotation = when (rotation) {
                0 -> android.view.Surface.ROTATION_0
                90 -> android.view.Surface.ROTATION_90
                180 -> android.view.Surface.ROTATION_180
                270 -> android.view.Surface.ROTATION_270
                else -> android.view.Surface.ROTATION_0
            }

            // Try Display.rotate() via reflection (private API, works on some boxes but throws on others)
            // Catch all exceptions silently — fallback to setRequestedOrientation in applyRotationFromPrefs
            try {
                val displayClass = Class.forName("android.view.Display")
                val rotateMethod = displayClass.getMethod("rotate", Int::class.javaPrimitiveType)
                val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    display
                } else {
                    @Suppress("DEPRECATION")
                    windowManager.defaultDisplay
                }
                rotateMethod.invoke(display, surfaceRotation)
                flog("I", tag, "Display rotated via Display.rotate() to surface=$surfaceRotation")
            } catch (_: Throwable) {
                // Silently ignore - not all devices support this API
            }
        } catch (_: Throwable) {
            // Silently ignore - not critical
        }
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        flog("I", tag, "onConfigurationChanged: orientation=${newConfig.orientation}")
        // Re-apply rotation when system configuration changes
        try {
            applyRotationFromPrefs()
        } catch (e: Exception) {
            Log.e(tag, "onConfigurationChanged apply failed: ${e.message}")
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
            }
        }
    }

    // ===================== ACTIVATION =====================

    private fun showActivation() {
        try {
            setContentView(R.layout.activity_activation)
            rootLayout = findViewById(android.R.id.content)
            statusText = findViewById(R.id.activateStatusText)

            // Start polling for external activation (via admin QR scan)
            startActivationPolling()

            // 10x tap on activation screen to open config (lets user change URL, etc.)
            rootLayout?.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    val now = System.currentTimeMillis()
                    if (now - lastTapTime > TAP_TIMEOUT) tapCount = 0
                    tapCount++
                    lastTapTime = now
                    if (tapCount >= TAP_THRESHOLD) {
                        tapCount = 0
                        try {
                            val intent = Intent(this, ConfigActivity::class.java)
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                        } catch (e: Exception) {
                            Log.e(tag, "ConfigActivity from activation failed: ${e.message}")
                        }
                    }
                }
                true
            }

            // TV remote support on activation screen
            rootLayout?.setOnKeyListener { _, keyCode, event ->
                if (event.action == KeyEvent.ACTION_DOWN &&
                    (keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                     keyCode == KeyEvent.KEYCODE_ENTER ||
                     keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER ||
                     keyCode == KeyEvent.KEYCODE_BUTTON_A)) {
                    val now = System.currentTimeMillis()
                    if (now - lastTapTime > TAP_TIMEOUT) tapCount = 0
                    tapCount++
                    lastTapTime = now
                    if (tapCount >= TAP_THRESHOLD) {
                        tapCount = 0
                        try {
                            val intent = Intent(this, ConfigActivity::class.java)
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                        } catch (e: Exception) {
                            Log.e(tag, "ConfigActivity from activation D-pad failed: ${e.message}")
                        }
                    }
                    true
                } else {
                    false
                }
            }
            rootLayout?.isFocusable = true
            rootLayout?.isFocusableInTouchMode = true
            rootLayout?.requestFocus()

            val codeInput = findViewById<EditText>(R.id.codeInput) ?: return
            val activateBtn = findViewById<Button>(R.id.activateBtn) ?: return
            val errorText = findViewById<TextView>(R.id.errorText) ?: return
            val activateStatus = findViewById<TextView>(R.id.activateStatusText) ?: return
            val qrImageView = findViewById<ImageView>(R.id.qrImageView) ?: return
            val qrDeviceIdText = findViewById<TextView>(R.id.qrDeviceIdText) ?: return
            val openConfigBtn = findViewById<Button>(R.id.openConfigBtn)

            // "Abrir Configuracoes" button — alternative to 10x tap
            openConfigBtn?.setOnClickListener {
                try {
                    val intent = Intent(this, ConfigActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                } catch (e: Exception) {
                    Log.e(tag, "ConfigActivity from button failed: ${e.message}")
                }
            }

            // Show QR code with device_uuid (works even before activation)
            val deviceUuid = getDeviceUuid()
            qrDeviceIdText.text = deviceUuid
            val apiUrlForQr = getApiUrl()
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val conn = URL("$apiUrlForQr/api/device/$deviceUuid/qr").openConnection() as HttpURLConnection
                    conn.connectTimeout = 15000
                    conn.readTimeout = 15000
                    val respCode = conn.responseCode
                    if (respCode in 200..299) {
                        val bmp = BufferedInputStream(conn.inputStream).use { BitmapFactory.decodeStream(it) }
                        conn.disconnect()
                        withContext(Dispatchers.Main) {
                            if (bmp != null) qrImageView.setImageBitmap(bmp)
                            else { qrDeviceIdText.text = "Erro ao decodificar imagem"; Log.e(tag, "QR bitmap null") }
                        }
                    } else {
                        conn.disconnect()
                        withContext(Dispatchers.Main) { qrDeviceIdText.text = "Erro HTTP $respCode" }
                    }
                } catch (e: Exception) {
                    Log.e(tag, "QR fetch on activation: ${e.message}", e)
                    withContext(Dispatchers.Main) { qrDeviceIdText.text = "Sem QR: ${e.message}" }
                }
            }

            activateBtn.setOnClickListener {
                val code = codeInput.text.toString().trim()
                if (code.isEmpty()) {
                    errorText.text = "Digite o codigo"
                    errorText.visibility = View.VISIBLE
                    return@setOnClickListener
                }

                activateBtn.isEnabled = false
                activateStatus.text = "Ativando..."
                activateStatus.visibility = View.VISIBLE
                errorText.visibility = View.GONE

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val apiUrl = getApiUrl()
                        val body = JSONObject().apply {
                            put("device_uuid", getDeviceUuid())
                            put("activation_code", code)
                            put("model", android.os.Build.MODEL)
                            put("manufacturer", android.os.Build.MANUFACTURER)
                        }

                        val result = httpPost("$apiUrl/api/device/activate", body.toString())
                        val json = JSONObject(result)

                        if (json.has("error")) {
                            withContext(Dispatchers.Main) {
                                errorText.text = json.getString("error")
                                errorText.visibility = View.VISIBLE
                                activateBtn.isEnabled = true
                                activateStatus.visibility = View.GONE
                            }
                            return@launch
                        }

                        val deviceId = json.optString("device_id", "")
                        if (deviceId.isEmpty()) {
                            withContext(Dispatchers.Main) {
                                errorText.text = "Resposta sem device_id"
                                errorText.visibility = View.VISIBLE
                                activateBtn.isEnabled = true
                                activateStatus.visibility = View.GONE
                            }
                            return@launch
                        }

                        prefs?.edit()?.putString("device_id", deviceId)?.commit()

                        withContext(Dispatchers.Main) {
                            startPlayer()
                        }
                    } catch (e: Exception) {
                        withContext(Dispatchers.Main) {
                            errorText.text = "Erro: ${e.message}"
                            errorText.visibility = View.VISIBLE
                            activateBtn.isEnabled = true
                            activateStatus.visibility = View.GONE
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "showActivation crash: ${e.message}", e)
        }
    }

    // ===================== ACTIVATION POLLING =====================

    private var activationPollingRunning = false
    private val activationPollingHandler = android.os.Handler(android.os.Looper.getMainLooper())

    /**
     * Polls /api/device/check-activation?device_uuid=... every 3s.
     * If the device has been activated externally (e.g. via admin QR scan),
     * saves the device_id locally and starts the player.
     */
    private fun startActivationPolling() {
        if (activationPollingRunning) return
        activationPollingRunning = true
        val deviceUuid = getDeviceUuid()
        val baseUrl = getApiUrl()
        if (deviceUuid.isEmpty()) return

        val pollRunnable = object : Runnable {
            override fun run() {
                if (!activationPollingRunning) return
                val runnableRef = this
                lifecycleScope.launch(Dispatchers.IO) {
                    var activatedNow = false
                    var deviceIdFound = ""
                    try {
                        val conn = URL("$baseUrl/api/device/check-activation?device_uuid=$deviceUuid").openConnection() as HttpURLConnection
                        conn.connectTimeout = 10000
                        conn.readTimeout = 10000
                        if (conn.responseCode == 200) {
                            val body = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                            val json = JSONObject(body)
                            conn.disconnect()
                            val activated = json.optBoolean("activated", false)
                            val exists = json.optBoolean("exists", false)
                            deviceIdFound = json.optString("device_id", "")
                            if (activated && exists && deviceIdFound.isNotEmpty()) {
                                activatedNow = true
                            }
                        } else {
                            conn.disconnect()
                        }
                    } catch (_: Exception) {}

                    withContext(Dispatchers.Main) {
                        if (activatedNow) {
                            activationPollingRunning = false
                            prefs?.edit()?.putString("device_id", deviceIdFound)?.commit()
                            flog("I", tag, "Activation detected via scan! device_id=$deviceIdFound")
                            startPlayer()
                        } else if (activationPollingRunning) {
                            activationPollingHandler.postDelayed(runnableRef, 3000)
                        }
                    }
                }
            }
        }
        activationPollingHandler.postDelayed(pollRunnable, 3000)
    }

    private fun stopActivationPolling() {
        activationPollingRunning = false
        activationPollingHandler.removeCallbacksAndMessages(null)
    }

    // ===================== PLAYER =====================

    private fun startPlayer() {
        try {
            setContentView(R.layout.activity_player)
            rootLayout = findViewById(R.id.root)
            statusText = findViewById(R.id.statusText)
            exoPlayerView = findViewById(R.id.exoPlayerView)
            // CRITICAL: Hide ExoPlayer controls overlay (back/play/pause/forward buttons)
            exoPlayerView?.useController = false
            exoPlayerView?.controllerAutoShow = false
            exoPlayerView?.setShowBuffering(androidx.media3.ui.PlayerView.SHOW_BUFFERING_NEVER)

            // CRITICAL: Keep screen bright and prevent sleep/dimming
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            try {
                val params = window.attributes
                params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
                window.attributes = params
            } catch (_: Exception) {}

            // Re-apply rotation AFTER setContentView so rootLayout is available
            // for the visual fallback rotation
            try {
                applyRotationFromPrefs()
            } catch (e: Exception) {
                Log.e(tag, "applyRotation after setContentView failed: ${e.message}")
            }

            // Log actual rootLayout dimensions after layout
            rootLayout?.post {
                try {
                    flog("I", tag, "rootLayout AFTER setContentView: w=${rootLayout?.width} h=${rootLayout?.height}")
                    val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display else windowManager.defaultDisplay
                    @Suppress("DEPRECATION")
                    val dw = display?.width ?: 0
                    @Suppress("DEPRECATION")
                    val dh = display?.height ?: 0
                    flog("I", tag, "Display AFTER setContentView: w=$dw h=$dh")

                    // FORCE rootLayout to fill the display
                    // This fixes issues where match_parent doesn't work due to wrong activity orientation
                    if (rootLayout != null && dw > 0 && dh > 0) {
                        val params = rootLayout?.layoutParams
                        if (params != null) {
                            val rotation = prefs?.getInt("screen_rotation", 0) ?: 0
                            // For portrait mode, use the display's portrait dimensions (h > w)
                            if (rotation == 0 || rotation == 180) {
                                params.width = if (dw < dh) dw else dh
                                params.height = if (dw < dh) dh else dw
                            } else {
                                // For landscape, use landscape dimensions
                                params.width = if (dw > dh) dw else dh
                                params.height = if (dw > dh) dh else dw
                            }
                            rootLayout?.layoutParams = params
                            rootLayout?.requestLayout()
                            flog("I", tag, "FORCED rootLayout to display size: w=${params.width} h=${params.height}")
                        }
                    }
                } catch (e: Exception) {
                    flog("W", tag, "Could not log layout dimensions: ${e.message}")
                }
            }

            rootLayout?.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    val now = System.currentTimeMillis()
                    if (now - lastTapTime > TAP_TIMEOUT) tapCount = 0
                    tapCount++
                    lastTapTime = now
                    if (tapCount >= TAP_THRESHOLD) {
                        tapCount = 0
                        try {
                            val intent = Intent(this, ConfigActivity::class.java)
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                        } catch (e: Exception) {
                            Log.e(tag, "ConfigActivity failed: ${e.message}")
                        }
                    }
                }
                true
            }

            // TV remote support: D-pad OK / Center / Enter should also count as taps
            // KeyEvent.KEYCODE_DPAD_CENTER (23), KEYCODE_ENTER (66), KEYCODE_NUMPAD_ENTER (160)
            rootLayout?.setOnKeyListener { _, keyCode, event ->
                if (event.action == KeyEvent.ACTION_DOWN &&
                    (keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                     keyCode == KeyEvent.KEYCODE_ENTER ||
                     keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER ||
                     keyCode == KeyEvent.KEYCODE_BUTTON_A)) {
                    val now = System.currentTimeMillis()
                    if (now - lastTapTime > TAP_TIMEOUT) tapCount = 0
                    tapCount++
                    lastTapTime = now
                    flog("I", tag, "D-pad/Enter tap detected: count=$tapCount")
                    if (tapCount >= TAP_THRESHOLD) {
                        tapCount = 0
                        try {
                            val intent = Intent(this, ConfigActivity::class.java)
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                        } catch (e: Exception) {
                            Log.e(tag, "ConfigActivity from D-pad failed: ${e.message}")
                        }
                    }
                    true
                } else {
                    false
                }
            }
            // Make root focusable to receive key events
            rootLayout?.isFocusable = true
            rootLayout?.isFocusableInTouchMode = true
            rootLayout?.requestFocus()

            // Delay syncAndPlay until view is fully laid out — avoids black screen on cold start
            window.decorView.post {
                lifecycleScope.launch(Dispatchers.Main) {
                    sendHeartbeatOn()
                    syncAndPlay()
                }
            }

            startClockUpdates()
        } catch (e: Exception) {
            Log.e(tag, "startPlayer crash: ${e.message}", e)
        }
    }

    private fun startClockUpdates() {
        try {
            clockHandler = Handler(Looper.getMainLooper())
            val runnable = object : Runnable {
                override fun run() {
                    try {
                        val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                        val dateStr = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date())
                        val timeStr = sdf.format(Date())
                        for (tv in clockTextViews) {
                            val format = tv.tag as? String ?: "HH:mm:ss"
                            tv.text = if (format == "date") dateStr else timeStr
                        }
                    } catch (_: Exception) {}
                    clockHandler?.postDelayed(this, 1000)
                }
            }
            clockHandler?.post(runnable)
        } catch (e: Exception) {
            Log.e(tag, "startClockUpdates failed: ${e.message}")
        }
    }

    private fun buildZoneLayout() {
        runOnUiThread {
            try {
                clearZoneViews()
                val rl = rootLayout ?: return@runOnUiThread
                if (layoutZones.isEmpty()) return@runOnUiThread

                val dm = resources.displayMetrics
                val screenW = dm.widthPixels
                val screenH = dm.heightPixels

                for (zone in layoutZones) {
                    val zoneLeft = (zone.x / 100f * screenW).toInt()
                    val zoneTop = (zone.y / 100f * screenH).toInt()
                    val zoneW = (zone.width / 100f * screenW).toInt()
                    val zoneH = (zone.height / 100f * screenH).toInt()

                    if (zone.type == "campaign") continue

                    when (zone.widgetType) {
                        "clock" -> {
                            val tv = TextView(this)
                            tv.setTextColor(Color.WHITE)
                            tv.gravity = Gravity.CENTER
                            tv.textSize = 24f
                            tv.setShadowLayer(4f, 2f, 2f, Color.BLACK)
                            tv.tag = zone.widgetConfig["format"] ?: "HH:mm:ss"
                            val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                            lp.leftMargin = zoneLeft; lp.topMargin = zoneTop
                            rl.addView(tv, lp)
                            clockTextViews.add(tv)
                        }
                        "weather" -> {
                            val tv = TextView(this)
                            tv.setTextColor(Color.WHITE)
                            tv.gravity = Gravity.CENTER
                            tv.textSize = 20f
                            tv.setShadowLayer(4f, 2f, 2f, Color.BLACK)
                            tv.text = "-- C"
                            val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                            lp.leftMargin = zoneLeft; lp.topMargin = zoneTop
                            rl.addView(tv, lp)
                            weatherTextViews.add(tv)
                            fetchWeather(tv, zone.widgetConfig["city"] ?: "Sao Paulo")
                        }
                        "text" -> {
                            val tv = TextView(this)
                            tv.setTextColor(Color.parseColor(zone.widgetConfig["color"] ?: "#FFFFFF"))
                            tv.gravity = Gravity.CENTER
                            tv.textSize = 18f
                            tv.setShadowLayer(4f, 2f, 2f, Color.BLACK)
                            tv.text = zone.widgetConfig["content"] ?: ""
                            tv.tag = "text_content"
                            val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                            lp.leftMargin = zoneLeft; lp.topMargin = zoneTop
                            rl.addView(tv, lp)
                            widgetTextViews.add(tv)
                        }
                        "logo" -> {
                            val iv = ImageView(this)
                            iv.scaleType = ImageView.ScaleType.FIT_CENTER
                            iv.setBackgroundColor(Color.parseColor(zone.widgetConfig["bg_color"] ?: "#000000"))
                            val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                            lp.leftMargin = zoneLeft; lp.topMargin = zoneTop
                            rl.addView(iv, lp)
                            val logoUrl = zone.widgetConfig["url"]
                            if (!logoUrl.isNullOrEmpty()) {
                                lifecycleScope.launch(Dispatchers.IO) {
                                    try {
                                        val bitmap = URL(logoUrl).openStream().use { BitmapFactory.decodeStream(it) }
                                        if (bitmap != null) runOnUiThread { iv.setImageBitmap(bitmap) }
                                    } catch (_: Exception) {}
                                }
                            }
                        }
                        "mask" -> {
                            val v = View(this)
                            v.setBackgroundColor(Color.parseColor(zone.widgetConfig["color"] ?: "#6B21A8"))
                            v.alpha = (zone.widgetConfig["opacity"]?.toFloatOrNull() ?: 50f) / 100f
                            val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                            lp.leftMargin = zoneLeft; lp.topMargin = zoneTop
                            rl.addView(v, lp)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(tag, "buildZoneLayout error: ${e.message}")
            }
        }
    }

    private fun fetchWeather(tv: TextView, city: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val url = "https://wttr.in/${city}?format=%t+%C&lang=pt"
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 10000; conn.readTimeout = 10000
                if (conn.responseCode in 200..299) {
                    val temp = BufferedReader(InputStreamReader(conn.inputStream)).readText().trim()
                    withContext(Dispatchers.Main) { tv.text = temp }
                }
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun clearZoneViews() {
        try { exoPlayer?.release(); exoPlayer = null } catch (_: Exception) {}
        try { exoPlayerView?.let { rootLayout?.removeView(it) } } catch (_: Exception) {}
        try { imageViewA?.let { rootLayout?.removeView(it) } } catch (_: Exception) {}
        try { imageViewB?.let { rootLayout?.removeView(it) } } catch (_: Exception) {}
        try { imageView?.let { rootLayout?.removeView(it) } } catch (_: Exception) {}
        for (v in activeZoneViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        for (v in clockTextViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        for (v in weatherTextViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        for (v in widgetTextViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        exoPlayerView = null; imageView = null; imageViewA = null; imageViewB = null; activeImageView = null
        lastBitmap = null
        activeZoneViews.clear(); clockTextViews.clear(); weatherTextViews.clear(); widgetTextViews.clear()
    }

    private fun createMediaViewsForZone(zone: ZoneData) {
        try {
            val rl = rootLayout ?: return
            exoPlayerView?.let { rl.removeView(it) }
            imageViewA?.let { rl.removeView(it) }
            imageViewB?.let { rl.removeView(it) }

            val dm = resources.displayMetrics
            val screenW = dm.widthPixels; val screenH = dm.heightPixels
            val zoneW = (zone.width / 100f * screenW).toInt()
            val zoneH = (zone.height / 100f * screenH).toInt()
            val zoneX = (zone.x / 100f * screenW).toInt()
            val zoneY = (zone.y / 100f * screenH).toInt()

            val epv = exoPlayerView ?: findViewById(R.id.exoPlayerView)
            epv?.let {
                it.visibility = View.GONE
                val lpE = FrameLayout.LayoutParams(zoneW, zoneH)
                lpE.leftMargin = zoneX; lpE.topMargin = zoneY
                rl.addView(it, lpE)
                exoPlayerView = it
            }

            val ivA = ImageView(this)
            ivA.visibility = View.GONE
            ivA.scaleType = ImageView.ScaleType.CENTER_CROP
            ivA.adjustViewBounds = false
            val lpA = FrameLayout.LayoutParams(zoneW, zoneH)
            lpA.leftMargin = zoneX; lpA.topMargin = zoneY
            rl.addView(ivA, lpA)
            imageViewA = ivA

            val ivB = ImageView(this)
            ivB.visibility = View.GONE
            ivB.scaleType = ImageView.ScaleType.CENTER_CROP
            ivB.adjustViewBounds = false
            val lpB = FrameLayout.LayoutParams(zoneW, zoneH)
            lpB.leftMargin = zoneX; lpB.topMargin = zoneY
            rl.addView(ivB, lpB)
            imageViewB = ivB

            activeImageView = ivA
            imageView = ivA
            flog("I", "UI", "createMediaViewsForZone: exoPlayerView+imageViewA+imageViewB created for zone ${zone.name}")
        } catch (e: Exception) {
            flog("E", "UI", "createMediaViewsForZone error: ${e.message}")
        }
    }

    private fun startPeriodicSync() {
        syncHandler?.removeCallbacksAndMessages(null)
        syncHandler = Handler(Looper.getMainLooper())
        val runnable = object : Runnable {
            override fun run() {
                // Check content_version via heartbeat instead of blindly resyncing
                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val deviceId = prefs?.getString("device_id", "") ?: ""
                        if (deviceId.isEmpty()) return@launch
                        val body = JSONObject().apply {
                            put("device_id", deviceId); put("status", "playing")
                            put("player_version", getVersionName())
                        }
                        val result = httpPost("${getApiUrl()}/api/device/heartbeat", body.toString())
                        if (result.isNotEmpty()) {
                            val json = JSONObject(result)
                            val serverVersion = json.optLong("content_version", 0)
                            if (serverVersion > currentContentVersion) {
                                Log.i(tag, "Periodic check: content changed $currentContentVersion -> $serverVersion, resyncing")
                                needsResync = true
                            }
                        }
                    } catch (_: Exception) {}
                }
                syncHandler?.postDelayed(this, syncIntervalSeconds * 1000L)
            }
        }
        syncHandler?.postDelayed(runnable, syncIntervalSeconds * 1000L)
    }

    private fun ensureDualImageViews() {
        val rl = rootLayout ?: return
        if (imageViewA != null) return
        val ivA = ImageView(this)
        ivA.visibility = View.GONE
        ivA.scaleType = ImageView.ScaleType.CENTER_CROP
        val lpA = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        rl.addView(ivA, lpA)
        imageViewA = ivA
        val ivB = ImageView(this)
        ivB.visibility = View.GONE
        ivB.scaleType = ImageView.ScaleType.CENTER_CROP
        val lpB = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        rl.addView(ivB, lpB)
        imageViewB = ivB
        activeImageView = ivA
        exoPlayerView = findViewById(R.id.exoPlayerView)
    }

    private suspend fun syncAndPlay() {
        var isFirstSync = true
        var usingCache = false
        while (true) {
            try {
                flog("I", tag, "=== syncAndPlay: isFirstSync=$isFirstSync, mediaList.size=${mediaList.size}, needsResync=$needsResync ===")
                if (isFirstSync || mediaList.isEmpty()) {
                    showStatus("Sincronizando...")
                }
                val result = fetchMedia()
                val items = result.first
                val zones = result.second
                flog("I", tag, "syncAndPlay: fetched items=${items.size}, zones=${zones.size}")
                if (items.isEmpty()) {
                    if (!usingCache && mediaList.isEmpty()) {
                        val cachedItems = loadCache()
                        if (cachedItems.isNotEmpty()) {
                            usingCache = true
                            mediaList.clear()
                            mediaList.addAll(cachedItems)
                            currentIndex = 0
                            layoutZones = loadZonesCache()
                            if (layoutZones.isNotEmpty()) {
                                buildZoneLayout()
                                val campaignZone = layoutZones.firstOrNull { it.type == "campaign" }
                                if (campaignZone != null) createMediaViewsForZone(campaignZone)
                            } else {
                                exoPlayerView = findViewById(R.id.exoPlayerView)
                                imageView = findViewById(R.id.imageView)
                                ensureDualImageViews()
                            }
                            hideStatus()
                            showStatus("Modo offline — reproduzindo cache")
                            delay(3000)
                            hideStatus()
                            startPeriodicSync()
                            playLoop()
                            continue
                        }
                    }
                    showStatus("Sem midia vinculada. Aguardando campanha...")
                    delay(5000)
                    continue
                }
                usingCache = false
                saveCache(items, zones)
                mediaList.clear()
                mediaList.addAll(items)
                currentIndex = 0

                layoutZones = zones
                if (layoutZones.isNotEmpty()) {
                    buildZoneLayout()
                    val campaignZone = layoutZones.firstOrNull { it.type == "campaign" }
                    if (campaignZone != null) createMediaViewsForZone(campaignZone)
                } else {
                    exoPlayerView = findViewById(R.id.exoPlayerView)
                    imageView = findViewById(R.id.imageView)
                    ensureDualImageViews()
                }

                hideStatus()
                isFirstSync = false
                startPeriodicSync()
                playLoop()
            } catch (e: Exception) {
                flog("E", "Sync", "Sync EXCEPTION: ${e.message}")
                if (mediaList.isEmpty()) {
                    val cachedItems = loadCache()
                    if (cachedItems.isNotEmpty()) {
                        usingCache = true
                        mediaList.clear()
                        mediaList.addAll(cachedItems)
                        currentIndex = 0
                        layoutZones = loadZonesCache()
                        if (layoutZones.isNotEmpty()) {
                            buildZoneLayout()
                            val campaignZone = layoutZones.firstOrNull { it.type == "campaign" }
                            if (campaignZone != null) createMediaViewsForZone(campaignZone)
                        } else {
                            exoPlayerView = findViewById(R.id.exoPlayerView)
                            imageView = findViewById(R.id.imageView)
                            ensureDualImageViews()
                        }
                        hideStatus()
                        showStatus("Modo offline — reproduzindo cache")
                        delay(3000)
                        hideStatus()
                        startPeriodicSync()
                        playLoop()
                    } else {
                        showStatus("Erro sync e sem cache: ${e.message?.take(60)}")
                        delay(5000)
                    }
                } else {
                    delay(5000)
                }
            }
        }
    }

    private suspend fun fetchMedia(): Pair<List<MediaItem>, List<ZoneData>> = withContext(Dispatchers.IO) {
        val deviceId = prefs?.getString("device_id", "") ?: ""
        val apiUrl = getApiUrl()

        val url = "$apiUrl/api/device/sync?device_id=$deviceId&content_version=$currentContentVersion"
        flog("I", "Fetch", "fetchMedia: URL=$url")
        val response = httpGet(url)
        flog("I", "Fetch", "fetchMedia: response length=${response.length}, first 300: ${response.take(300)}")
        val json = JSONObject(response)

        if (json.has("error")) {
            val errorMsg = json.getString("error")
            flog("E", "Fetch", "fetchMedia ERROR: $errorMsg")
            if (errorMsg.contains("não encontrado") || errorMsg.contains("404")) {
                prefs?.edit()?.remove("device_id")?.commit()
                withContext(Dispatchers.Main) { showActivation() }
                return@withContext Pair(emptyList(), emptyList())
            }
            return@withContext Pair(emptyList(), emptyList())
        }

        val items = mutableListOf<MediaItem>()
        val playlists = json.optJSONArray("playlists")
        val mediaArray = json.optJSONArray("media")

        if (playlists == null || mediaArray == null) {
            flog("E", "Fetch", "fetchMedia: playlists=${playlists != null}, media=${mediaArray != null} — EMPTY, returning empty")
            return@withContext Pair(emptyList(), emptyList())
        }
        flog("I", "Fetch", "fetchMedia: playlists=${playlists.length()}, media=${mediaArray.length()}")

        val respCampaignId = json.optString("campaign_id", "")
        currentCampaignId = if (!respCampaignId.isNullOrEmpty()) respCampaignId else null

        syncIntervalSeconds = json.optInt("sync_interval_seconds", 30)

        if (json.optBoolean("screenshot_requested", false)) sendScreenshot()

        // Apply device-level orientation settings from sync response
        val deviceOrientation = json.optString("device_orientation", "")
        val serverRotation = json.optInt("screen_rotation", -999)
        if (deviceOrientation.isNotEmpty() || serverRotation != -999) {
            applyDeviceOrientation(deviceOrientation, serverRotation)
        }

        val mediaMap = mutableMapOf<String, JSONObject>()
        for (i in 0 until mediaArray.length()) {
            val m = mediaArray.getJSONObject(i)
            mediaMap[m.getString("id")] = m
        }
        flog("I", "Fetch", "fetchMedia: mediaMap built, ${mediaMap.size} entries. Keys: ${mediaMap.keys.take(5)}")

        for (i in 0 until playlists.length()) {
            val playlist = playlists.getJSONObject(i)
            val playlistId = playlist.optString("id", "")
            val playlistItems = playlist.optJSONArray("items")
            flog("I", "Fetch", "fetchMedia: playlist[$i] id=$playlistId, items=${playlistItems?.length() ?: "null"}, slots=${playlist.optJSONArray("slots")?.length() ?: 0}")

            if (playlistItems == null || playlistItems.length() == 0) {
                flog("W", "Fetch", "fetchMedia: playlist $playlistId has no items, skipping")
                continue
            }

            // Build list of (position, slotId, MediaItem) for each playlist item
            data class ItemPos(val position: Int, val slotId: String, val media: MediaItem)
            val allItems = mutableListOf<ItemPos>()

            for (j in 0 until playlistItems.length()) {
                val item = playlistItems.getJSONObject(j)
                val mediaId = item.optString("media_id", "")
                if (mediaId.isEmpty()) { flog("W", "Fetch", "fetchMedia: item[$j] empty media_id, skip"); continue }
                val media = mediaMap[mediaId]
                if (media == null) { flog("E", "Fetch", "fetchMedia: item[$j] mediaId=$mediaId NOT in mediaMap, skip — MEDIA NOT FOUND"); continue }
                // duration=0 = até o final natural do vídeo (sem corte)
                // Se item.duration não está setado (0/null), usa media.duration mas com mínimo de 5s para imagens
                val rawDuration = item.optInt("duration", 0)
                val mediaDuration = media.optInt("duration", 0)
                val duration = if (rawDuration <= 0) {
                    // Item sem duração: se for vídeo, 0 = natural; se for imagem, mínimo 5s
                    if (media.optString("type", "image") == "video") 0
                    else mediaDuration.coerceAtLeast(5)
                } else {
                    rawDuration
                }
                val fileUrl = media.optString("file_url", "")
                val orientation = media.optString("default_orientation", "auto")
                val displayName = media.optString("display_name", "").ifEmpty { null }
                val mediaItem = MediaItem(
                    id = mediaId,
                    name = media.optString("name", ""),
                    displayName = displayName,
                    type = media.optString("type", "image"),
                    fileUrl = fileUrl,
                    duration = duration,
                    campaignId = respCampaignId,
                    playlistId = playlistId,
                    defaultOrientation = orientation
                )
                val pos = item.optInt("position", j)
                val slotId = item.optString("slot_id", "")
                flog("I", "Fetch", "fetchMedia: item[$j] name=${mediaItem.name}, pos=$pos, slotId='$slotId', orientation=${mediaItem.defaultOrientation}")
                allItems.add(ItemPos(pos, slotId, mediaItem))
            }
            flog("I", "Fetch", "fetchMedia: parsed ${allItems.size} items")

            // Parse slot definitions from playlist
            val slotsArray = playlist.optJSONArray("slots")
            val slotDefMap = mutableMapOf<String, Int>() // slot_id -> slot_order
            if (slotsArray != null) {
                for (k in 0 until slotsArray.length()) {
                    val slot = slotsArray.getJSONObject(k)
                    slotDefMap[slot.optString("id", "")] = slot.optInt("slot_order", 0)
                }
            }

            // Sort by position, then place each item
            // Items with slot_id that matches a known slot definition are placed at the slot's order
            // Items without slot_id or with slot_id not matching any definition use their own position
            val sorted = allItems.sortedWith(compareBy({ it.position }, { it.media.name }))

            // Build play order
            val playList = mutableListOf<MediaItem>()
            for (ip in sorted) {
                // If item has slot_id matching a known slot, use slot's order; else use item position
                val effectivePos = slotDefMap[ip.slotId] ?: ip.position
                playList.add(ip.media)
                flog("I", "Fetch", "fetchMedia: queued ${ip.media.name} (slot='${ip.slotId}', pos=$effectivePos)")
            }

            flog("I", "Fetch", "fetchMedia: FINAL playList size=${playList.size} for playlist $playlistId")
            items.addAll(playList)
        }
        flog("I", "Fetch", "fetchMedia: FINAL items=${items.size}, zones=${json.optJSONArray("layout_zones")?.length() ?: 0} layout_zones")

        val respVersion = json.optLong("content_version", 0)
        if (respVersion > 0) currentContentVersion = respVersion

        val zonesArray = json.optJSONArray("layout_zones")
        val zones = mutableListOf<ZoneData>()
        if (zonesArray != null) {
            for (i in 0 until zonesArray.length()) {
                val z = zonesArray.getJSONObject(i)
                val widgetConfig = mutableMapOf<String, String>()
                val wci = z.optJSONObject("widget_config")
                if (wci != null) { for (key in wci.keys()) widgetConfig[key] = wci.optString(key, "") }
                zones.add(ZoneData(z.optString("name", ""), z.optDouble("x", 0.0).toFloat(),
                    z.optDouble("y", 0.0).toFloat(), z.optDouble("width", 100.0).toFloat(),
                    z.optDouble("height", 100.0).toFloat(), z.optString("type", "campaign"),
                    z.optString("widget_type", ""), widgetConfig))
            }
        }

        Pair(items, zones)
    }

    private suspend fun playLoop() {
        flog("I", "Play", "playLoop: START, mediaList.size=${mediaList.size}")
        while (mediaList.isNotEmpty()) {
            if (needsResync) { needsResync = false; break }
            if (currentIndex >= mediaList.size) currentIndex = 0
            val item = mediaList[currentIndex]
            val resolvedType = item.resolvedType()
            flog("I", "Play", "playLoop: index=$currentIndex/${mediaList.size}, item=${item.name}, dbType=${item.type}, resolvedType=$resolvedType, duration=${item.duration}s, url=${item.fileUrl.take(80)}")
            try {
                // NOTE: We do NOT call applyMediaOrientation here anymore.
                // The rotation is set ONCE at startup (from device prefs/setup)
                // and never re-applied during playback — this prevents the
                // "horizontal flash" between media items.
                when (resolvedType) {
                    "video" -> playVideo(item)
                    "image" -> playImage(item)
                    else -> { flog("W", "Play", "playLoop: unknown resolved type $resolvedType for ${item.name}, delaying ${item.duration}s"); delay(item.duration * 1000L) }
                }
                logPlayback(item)
            } catch (e: Exception) {
                flog("E", "Play", "Play error: ${item.name} — ${e.message}")
                delay(2000)
            }
            currentIndex++
        }
        flog("I", "Play", "playLoop: END")
    }

    /**
     * Apply orientation ONCE at startup, not per-media.
     */
    private fun applyStartupOrientation() {
        val p = prefs ?: return
        val rotation = p.getInt("screen_rotation", 0)
        val deviceOrientation = p.getString("device_orientation", "landscape") ?: "landscape"

        flog("I", tag, "applyStartupOrientation: rotation=$rotation, deviceOrientation=$deviceOrientation")

        // Only set activity orientation ONCE if changed
        if (lastAppliedRotation != rotation) {
            lastAppliedRotation = rotation
            runOnUiThread {
                when (rotation) {
                    90 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    270 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                    180 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                    -1 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                    else -> requestedOrientation = if (deviceOrientation == "portrait") {
                        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    } else {
                        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    }
                }
            }
        }
    }

    /**
     * Apply orientation for the current media item (DEPRECATED - kept for compatibility).
     * Orientation is now applied once at startup, not per-media.
     */
    @Deprecated("Use applyRotationFromPrefs instead")
    private fun applyMediaOrientation(mediaOrientation: String) {
        // No-op - orientation is set once at startup
    }

    /**
     * Apply device-level orientation pushed from the dashboard (DEPRECATED - kept for compatibility).
     */
    @Deprecated("Use applyRotationFromPrefs instead")
    private fun applyDeviceOrientation(deviceOrientation: String, serverRotation: Int) {
        // No-op - orientation is set once at startup
    }


    private var imageViewA: ImageView? = null
    private var imageViewB: ImageView? = null
    private var activeImageView: ImageView? = null
    private var lastBitmap: android.graphics.Bitmap? = null

    private fun loadBitmapFromFileUrl(fileUrl: String): android.graphics.Bitmap? {
        return try {
            val bitmap = if (fileUrl.startsWith("data:")) {
                val base64Data = fileUrl.substringAfter("base64,")
                val decoded = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                BitmapFactory.decodeByteArray(decoded, 0, decoded.size)
            } else {
                flog("I", "Fetch", "loadBitmap: fetching URL=${fileUrl.take(100)}")
                val conn = URL(fileUrl).openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.requestMethod = "GET"
                val httpCode = conn.responseCode
                val contentType = conn.contentType ?: "unknown"
                flog("I", "Fetch", "loadBitmap: HTTP $httpCode contentType=$contentType for ${fileUrl.take(60)}")
                if (httpCode != 200) {
                    val errorBody = conn.errorStream?.bufferedReader()?.readText()?.take(200) ?: "no body"
                    flog("E", "Fetch", "loadBitmap: HTTP $httpCode error body: $errorBody")
                    conn.disconnect()
                    return null
                }
                // Reject non-image content-types if specified
                if (contentType.startsWith("text/") || contentType == "application/octet-stream" || contentType == "unknown") {
                    flog("E", "Fetch", "loadBitmap: suspicious content-type '$contentType' for ${fileUrl.take(80)} — rejecting")
                    conn.disconnect()
                    return null
                }
                val inputStream = conn.inputStream
                val options = BitmapFactory.Options().apply { inJustDecodeBounds = false }
                val result = BitmapFactory.decodeStream(inputStream, null, options)
                conn.disconnect()
                result
            }
            if (bitmap != null) {
                flog("I", "Fetch", "loadBitmap: OK — ${bitmap.width}x${bitmap.height}")
            } else {
                flog("E", "Fetch", "loadBitmap: decode returned NULL for ${fileUrl.take(80)}")
            }
            bitmap
        } catch (e: Exception) {
            flog("E", "Fetch", "loadBitmap EXCEPTION: ${e.javaClass.simpleName}: ${e.message} — URL=${fileUrl.take(80)}")
            null
        }
    }

    // ===================== RENDERING CONFIG =====================

    private fun getImageScaleType(): ImageView.ScaleType {
        val mode = prefs?.getString("image_fit_mode", "centerCrop") ?: "centerCrop"
        return when (mode) {
            "fill" -> ImageView.ScaleType.FIT_XY          // Fill 100% (stretched)
            "center" -> ImageView.ScaleType.CENTER         // Centered, no scale
            "centerCrop" -> ImageView.ScaleType.CENTER_CROP    // Fill 100% (cropped) - DEFAULT for DOOH
            "centerInside" -> ImageView.ScaleType.CENTER_INSIDE
            "fitCenter" -> ImageView.ScaleType.FIT_CENTER  // Letterbox (preserves aspect)
            "fit" -> ImageView.ScaleType.FIT_XY           // Fill 100% (stretched)
            else -> ImageView.ScaleType.CENTER_CROP       // Default: fill 100% cropped
        }
    }

    private fun getImageRotation(): Float {
        val rot = prefs?.getInt("image_rotation_lock", 0) ?: 0
        return rot.toFloat()
    }

    private fun getVideoVolume(): Float {
        // Default 1.0 (100%). Stored 0-100.
        val vol = prefs?.getInt("video_volume", 100) ?: 100
        return (vol.coerceIn(0, 100) / 100f)
    }

    private fun crossfadeToImage(newBitmap: android.graphics.Bitmap) {
        val current = activeImageView ?: imageViewA ?: return
        val next = if (current == imageViewA) imageViewB else imageViewA ?: return

        runOnUiThread {
            try {
                exoPlayerView?.visibility = View.GONE
                next?.setImageBitmap(newBitmap)
                next?.scaleType = getImageScaleType()
                next?.rotation = getImageRotation()
                current.alpha = 1f
                next?.alpha = 0f
                next?.visibility = View.VISIBLE

                val anim = android.animation.ObjectAnimator.ofFloat(next!!, "alpha", 0f, 1f)
                anim.duration = 500
                anim.addListener(object : android.animation.AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: android.animation.Animator) {
                        current.visibility = View.GONE
                        current.setImageBitmap(null)
                    }
                })
                anim.start()
                activeImageView = next
                lastBitmap = newBitmap
            } catch (e: Exception) {
                Log.e(tag, "crossfade error: ${e.message}")
            }
        }
    }

    private fun showImageImmediate(bitmap: android.graphics.Bitmap) {
        val iv = activeImageView ?: imageViewA
        if (iv == null) {
            flog("E", "UI", "showImageImmediate: NO activeImageView and NO imageViewA — image NOT displayed")
            return
        }
        runOnUiThread {
            try {
                exoPlayerView?.visibility = View.GONE
                iv.setImageBitmap(bitmap)
                iv.scaleType = getImageScaleType()
                iv.rotation = getImageRotation()
                iv.visibility = View.VISIBLE
                iv.alpha = 1f
                activeImageView = iv
                lastBitmap = bitmap
                flog("I", "UI", "showImageImmediate: displayed ${bitmap.width}x${bitmap.height}")
            } catch (e: Exception) {
                flog("E", "UI", "showImageImmediate error: ${e.message}")
            }
        }
    }

    private suspend fun playVideo(item: MediaItem) {
        if (!item.isVideo()) {
            flog("W", "Play", "REDIRECT: ${item.name} (ext=${item.fileUrl.substringAfterLast(".")}) → playImage")
            playImage(item)
            return
        }

        // duration=0 significa "até o final natural do vídeo"
        val playToEnd = item.duration <= 0
        flog("I", "Play", "playVideo REAL: ${item.name}, configured duration=${item.duration}s, playToEnd=$playToEnd")

        val latch = java.util.concurrent.CountDownLatch(1)
        var videoEndedNaturally = false
        var playerError: String? = null

        withContext(Dispatchers.Main) {
            try {
                imageViewA?.visibility = View.GONE
                imageViewB?.visibility = View.GONE

                // Show ExoPlayerView, hide ImageView
                exoPlayerView?.visibility = View.VISIBLE

                // Reuse existing ExoPlayer instance to avoid 4-5s freeze on every video change
                // (creating fresh ExoPlayer + setting surface = expensive on Google TV)
                var player = exoPlayer
                if (player == null) {
                    player = ExoPlayer.Builder(this@PlayerActivity)
                        .setHandleAudioBecomingNoisy(true)
                        .build()
                    exoPlayer = player
                    exoPlayerView?.player = player
                }

                val volume = getVideoVolume()
                player.volume = volume

                player.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        when (state) {
                            Player.STATE_READY -> {
                                flog("I", "Play", "ExoPlayer READY: ${item.name}, videoDuration=${player.duration}ms, configured=${item.duration}s")
                                if (!player.isPlaying) player.play()
                            }
                            Player.STATE_ENDED -> {
                                flog("I", "Play", "ExoPlayer ENDED naturally: ${item.name}")
                                videoEndedNaturally = true
                                latch.countDown()
                            }
                            Player.STATE_BUFFERING -> {
                                flog("I", "Play", "ExoPlayer BUFFERING: ${item.name}")
                            }
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        flog("E", "Play", "ExoPlayer ERROR: ${item.name} — ${error.errorCodeName}: ${error.message}")
                        playerError = "${error.errorCodeName}: ${error.message}"
                        latch.countDown()
                    }
                })

                val mediaItem = ExoMediaItem.fromUri(item.fileUrl)
                player.stop()
                player.clearMediaItems()
                player.setMediaItem(mediaItem)
                player.prepare()
                player.playWhenReady = true

                flog("I", "Play", "ExoPlayer started: ${item.name}")
            } catch (e: Exception) {
                flog("E", "Play", "playVideo ExoPlayer EXCEPTION: ${e.javaClass.simpleName}: ${e.message}")
                playerError = "${e.javaClass.simpleName}: ${e.message}"
                latch.countDown()
            }
        }

        // Se playToEnd: espera até STATE_ENDED (latch.countDown()) sem limite.
        // Senão: espera duração configurada + 5s de margem.
        if (playToEnd) {
            withContext(Dispatchers.IO) { latch.await() }  // sem timeout
        } else {
            withContext(Dispatchers.IO) { latch.await(item.duration.toLong() + 5, java.util.concurrent.TimeUnit.SECONDS) }
        }

        // Force stop at exactly the configured duration (only if not playToEnd and didn't end naturally)
        if (!playToEnd) {
            withContext(Dispatchers.Main) {
                val player = exoPlayer
                if (player != null && !videoEndedNaturally && playerError == null) {
                    flog("I", "Play", "Duration cut: stopping ${item.name} at ${item.duration}s (configured cut-off)")
                    player.stop()
                }
            }
        }

        // Report errors to server (notification + device_logs)
        if (playerError != null) {
            reportMediaError(item, playerError!!)
        }

        // Release player after video ends
        try { exoPlayer?.release(); exoPlayer = null } catch (_: Exception) {}
        exoPlayerView?.player = null
        exoPlayerView?.visibility = View.GONE
        flog("I", "Play", "playVideo: finished ${item.name}, endedNaturally=$videoEndedNaturally, error=${playerError ?: "none"}")
    }

    private fun reportMediaError(item: MediaItem, errorMsg: String) {
        try {
            val deviceId = prefs?.getString("device_id", "") ?: ""
            if (deviceId.isEmpty()) return
            val apiUrl = getApiUrl()
            val body = JSONObject().apply {
                put("device_id", deviceId)
                put("event_type", "media_error")
                put("severity", "error")
                put("message", "Falha ao reproduzir: ${item.name}")
                put("details", errorMsg)
                put("media_id", item.id)
                put("media_url", item.fileUrl)
                item.campaignId?.let { put("campaign_id", it) }
                item.playlistId?.let { put("playlist_id", it) }
            }
            // Fire and forget — don't block playback loop
            Thread {
                try {
                    val conn = URL("$apiUrl/api/device/log-error").openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    conn.connectTimeout = 5000
                    conn.readTimeout = 5000
                    conn.outputStream.use { os ->
                        os.write(body.toString().toByteArray(Charsets.UTF_8))
                        os.flush()
                    }
                    conn.responseCode
                    conn.disconnect()
                } catch (_: Exception) {}
            }.start()
        } catch (_: Exception) {}
    }

    private suspend fun playImage(item: MediaItem) {
        if (item.fileUrl.isEmpty()) {
            flog("W", "Play", "playImage: empty url for ${item.name}, skipping")
            delay(item.duration * 1000L)
            return
        }
        val bitmap = withContext(Dispatchers.IO) { loadBitmapFromFileUrl(item.fileUrl) }
        if (bitmap != null) {
            flog("I", "Play", "playImage: OK ${item.name} ${bitmap.width}x${bitmap.height}")
            val isFirstDisplay = lastBitmap == null && (activeImageView?.drawable == null)
            if (isFirstDisplay) {
                showImageImmediate(bitmap)
            } else {
                crossfadeToImage(bitmap)
            }
        } else {
            flog("E", "Play", "playImage: FAILED to load ${item.name} url=${item.fileUrl.take(80)} — screen stays")
            // Keep current image visible if we have one
        }
        delay(item.duration * 1000L)
    }

    // ===================== PLAYBACK LOG =====================

    private fun logPlayback(item: MediaItem) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val deviceId = prefs?.getString("device_id", "") ?: ""
                if (deviceId.isEmpty()) return@launch
                val apiUrl = getApiUrl()
                val uptime = try { ((System.currentTimeMillis() - ByeMidiasApp.instance.sessionStartTime) / 1000).toInt() } catch (_: Exception) { 0 }
                val body = JSONObject().apply {
                    put("device_id", deviceId); put("status", "playing")
                    put("player_version", getVersionName()); put("uptime_seconds", uptime)
                    put("media_id", item.id)
                    item.campaignId?.let { put("campaign_id", it) }
                    item.playlistId?.let { put("playlist_id", it) }
                }
                val result = httpPost("$apiUrl/api/device/heartbeat", body.toString())
                if (result.isNotEmpty()) {
                    val json = JSONObject(result)
                    // Only apply settings — heartbeat content_version check already in applyDeviceSettings
                    // Don't duplicate the check here
                    applyDeviceSettings(json)
                }
            } catch (_: Exception) {}
        }
    }

    // ===================== HTTP =====================

    // ===================== HEARTBEAT =====================

    private fun sendHeartbeatOn() {
        try {
            val deviceId = prefs?.getString("device_id", "") ?: ""
            if (deviceId.isEmpty()) return
            val apiUrl = getApiUrl()
            val uptime = try { ((System.currentTimeMillis() - ByeMidiasApp.instance.sessionStartTime) / 1000).toInt() } catch (_: Exception) { 0 }
            val body = JSONObject().apply {
                put("device_id", deviceId); put("status", "online")
                put("player_version", getVersionName()); put("uptime_seconds", uptime)
            }
            val result = httpPost("$apiUrl/api/device/heartbeat", body.toString())
            if (result.isNotEmpty()) {
                val json = JSONObject(result)
                applyDeviceSettings(json)
            }
        } catch (_: Exception) {}
    }

    private fun applyDeviceSettings(json: JSONObject) {
        try {
            // DON'T check content_version from heartbeat — it causes false-positive resyncs
            // Content version is only updated from sync endpoint via fetchMedia()
            // The heartbeat returns the same version sync already set on the APK

            if (json.optBoolean("restart", false)) {
                Log.i(tag, "applyDeviceSettings: restart requested")
                runOnUiThread {
                    try {
                        val intent = packageManager.getLaunchIntentForPackage(packageName)
                        intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                        finishAffinity()
                    } catch (_: Exception) {}
                }
            }

            // NOTE: We do NOT re-apply rotation here anymore to avoid flicker
            // between media items. Rotation is set ONCE at startup and on
            // explicit user action (config screen button).
            val mirrorH = json.optBoolean("mirror_horizontal", false)
            val mirrorV = json.optBoolean("mirror_vertical", false)

            if (mirrorH != lastAppliedMirrorH || mirrorV != lastAppliedMirrorV) {
                lastAppliedMirrorH = mirrorH
                lastAppliedMirrorV = mirrorV
                runOnUiThread {
                    rootLayout?.scaleX = if (mirrorH) -1f else 1f
                    rootLayout?.scaleY = if (mirrorV) -1f else 1f
                }
            }

            // Process remote commands from dashboard
            val commandsArray = json.optJSONArray("commands")
            if (commandsArray != null && commandsArray.length() > 0) {
                for (i in 0 until commandsArray.length()) {
                    val cmd = commandsArray.getJSONObject(i)
                    executeRemoteCommand(cmd.optString("command", ""))
                }
            }
        } catch (_: Exception) {}
    }

    /**
     * Executa comandos remotos vindos do painel (disparados via botão).
     */
    private fun executeRemoteCommand(command: String) {
        flog("I", "Cmd", "executeRemoteCommand: $command")
        runOnUiThread {
            try {
                when (command) {
                    "open_config" -> {
                        // Vai direto pra tela de configurações (mesma função do toque 10x)
                        val intent = android.content.Intent(this, ConfigActivity::class.java)
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                    }
                    "rotate" -> {
                        // Alterna rotação (mesmo comportamento do botão Rotacionar no APK)
                        rotateScreen()
                    }
                    "rotate_portrait" -> {
                        prefs?.edit()?.putInt("screen_rotation", 0)?.apply()
                        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    }
                    "rotate_landscape" -> {
                        prefs?.edit()?.putInt("screen_rotation", 90)?.apply()
                        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    }
                    "reload" -> {
                        // Força re-sync
                        needsResync = true
                        currentContentVersion = -1
                    }
                    "clear_cache" -> {
                        try {
                            prefs?.edit()
                                ?.remove("cache_media")
                                ?.remove("cache_zones")
                                ?.remove("cache_time")
                                ?.apply()
                        } catch (_: Exception) {}
                        flog("I", "Cmd", "Cache cleared by remote command")
                    }
                    "toggle_kiosk" -> {
                        try {
                            val dpm = getSystemService(android.content.Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
                            // For simplicity: launch lock task
                            val lockIntent = android.content.Intent(this, PlayerActivity::class.java)
                            lockIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
                            startActivity(lockIntent)
                            runOnUiThread {
                                try { startLockTask() } catch (_: Exception) {}
                            }
                        } catch (_: Exception) {}
                    }
                    "restart" -> {
                        try {
                            val intent = packageManager.getLaunchIntentForPackage(packageName)
                            intent?.addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK or android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                            finishAffinity()
                        } catch (_: Exception) {}
                    }
                }
            } catch (e: Exception) {
                flog("E", "Cmd", "executeRemoteCommand error: ${e.message}")
            }
        }
    }

    private fun rotateScreen() {
        val current = prefs?.getInt("screen_rotation", 0) ?: 0
        val next = when (current) {
            0 -> 90
            90 -> 0
            else -> 0
        }
        prefs?.edit()?.putInt("screen_rotation", next)?.apply()
        requestedOrientation = if (next == 0)
            android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        else
            android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    }

    private fun sendHeartbeatOff() {
        try {
            val deviceId = prefs?.getString("device_id", "") ?: ""
            if (deviceId.isEmpty()) return
            val body = JSONObject().apply {
                put("device_id", deviceId); put("status", "offline")
                put("player_version", getVersionName())
            }
            httpPost("${getApiUrl()}/api/device/heartbeat", body.toString())
        } catch (_: Exception) {}
    }

    private var lastScreenshotTime = 0L
    private fun sendScreenshot() {
        try {
            val now = System.currentTimeMillis()
            if (now - lastScreenshotTime < 2000) return
            lastScreenshotTime = now
            val deviceId = prefs?.getString("device_id", "") ?: ""
            if (deviceId.isEmpty()) return
            val rl = rootLayout ?: return
            val bitmap = android.graphics.Bitmap.createBitmap(rl.width, rl.height, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            rl.draw(canvas)
            val baos = java.io.ByteArrayOutputStream()
            bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 60, baos)
            val base64 = android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP)
            bitmap.recycle()
            val body = JSONObject().apply {
                put("device_id", deviceId); put("screenshot", "data:image/jpeg;base64,$base64")
            }
            lifecycleScope.launch(Dispatchers.IO) { httpPost("${getApiUrl()}/api/device/screenshot", body.toString()) }
        } catch (_: Exception) {}
    }

    // ===================== HELPERS =====================

    private fun saveCache(items: List<MediaItem>, zones: List<ZoneData>) {
        try {
            val p = prefs ?: return
            val arr = org.json.JSONArray()
            for (item in items) {
                val obj = org.json.JSONObject()
                obj.put("id", item.id)
                obj.put("name", item.name)
                obj.put("type", item.type)
                obj.put("fileUrl", item.fileUrl)
                obj.put("duration", item.duration)
                obj.put("campaignId", item.campaignId ?: "")
                obj.put("playlistId", item.playlistId ?: "")
                arr.put(obj)
            }
            val zonesArr = org.json.JSONArray()
            for (z in zones) {
                val obj = org.json.JSONObject()
                obj.put("name", z.name)
                obj.put("x", z.x.toDouble())
                obj.put("y", z.y.toDouble())
                obj.put("width", z.width.toDouble())
                obj.put("height", z.height.toDouble())
                obj.put("type", z.type)
                obj.put("widgetType", z.widgetType)
                val cfg = org.json.JSONObject()
                for ((k, v) in z.widgetConfig) cfg.put(k, v)
                obj.put("widgetConfig", cfg)
                zonesArr.put(obj)
            }
            p.edit()
                .putString("cache_media", arr.toString())
                .putString("cache_zones", zonesArr.toString())
                .putLong("cache_time", System.currentTimeMillis())
                .apply()
            Log.i(tag, "Cache saved: ${items.size} items, ${zones.size} zones")
        } catch (e: Exception) {
            Log.e(tag, "saveCache failed: ${e.message}")
        }
    }

    private fun loadCache(): List<MediaItem> {
        val items = mutableListOf<MediaItem>()
        try {
            val p = prefs ?: return items
            val str = p.getString("cache_media", null) ?: return items
            val arr = org.json.JSONArray(str)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                items.add(MediaItem(
                    id = obj.optString("id", ""),
                    name = obj.optString("name", ""),
                    type = obj.optString("type", "image"),
                    fileUrl = obj.optString("fileUrl", ""),
                    duration = obj.optInt("duration", 10),
                    campaignId = obj.optString("campaignId", "").ifEmpty { null },
                    playlistId = obj.optString("playlistId", "").ifEmpty { null },
                    defaultOrientation = obj.optString("defaultOrientation", "auto")
                ))
            }
            val cacheTime = p.getLong("cache_time", 0)
            val age = (System.currentTimeMillis() - cacheTime) / (1000 * 60 * 60)
            Log.i(tag, "Cache loaded: ${items.size} items, age ${age}h")
        } catch (e: Exception) {
            Log.e(tag, "loadCache failed: ${e.message}")
        }
        return items
    }

    private fun loadZonesCache(): List<ZoneData> {
        val zones = mutableListOf<ZoneData>()
        try {
            val p = prefs ?: return zones
            val str = p.getString("cache_zones", null) ?: return zones
            val arr = org.json.JSONArray(str)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val cfg = mutableMapOf<String, String>()
                val cfgObj = obj.optJSONObject("widgetConfig")
                if (cfgObj != null) { for (k in cfgObj.keys()) cfg[k] = cfgObj.optString(k, "") }
                zones.add(ZoneData(
                    obj.optString("name", ""),
                    obj.optDouble("x", 0.0).toFloat(),
                    obj.optDouble("y", 0.0).toFloat(),
                    obj.optDouble("width", 100.0).toFloat(),
                    obj.optDouble("height", 100.0).toFloat(),
                    obj.optString("type", "campaign"),
                    obj.optString("widgetType", ""),
                    cfg
                ))
            }
        } catch (e: Exception) {
            Log.e(tag, "loadZonesCache failed: ${e.message}")
        }
        return zones
    }

    private fun getApiUrl(): String = prefs?.getString("api_base_url", null) ?: BuildConfig.API_BASE_URL

    private fun getDeviceUuid(): String {
        var uuid = prefs?.getString("device_uuid", null)
        if (uuid == null) {
            uuid = UUID.randomUUID().toString()
            prefs?.edit()?.putString("device_uuid", uuid)?.commit()
        }
        return uuid ?: ""
    }

    private fun getVersionName(): String = try {
        packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0.0"
    } catch (_: Exception) { "1.0.0" }

    private fun showStatus(msg: String) {
        flog("I", tag, "STATUS: $msg")
        lifecycleScope.launch(Dispatchers.Main) {
            statusText?.text = msg
            statusText?.visibility = View.VISIBLE
        }
    }

    private fun hideStatus() {
        lifecycleScope.launch(Dispatchers.Main) {
            statusText?.visibility = View.GONE
        }
    }

    // ===================== FILE LOGGER =====================
    // Writes logs to filesDir/player.log for the Logs screen
    class FileLogger(private val filesDir: String) {
        private val logFile: File get() = File(filesDir, "player.log")
        private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

        fun log(level: String, tag: String, message: String) {
            val timestamp = dateFormat.format(Date())
            val line = "$timestamp $level $tag: $message"
            try {
                FileWriter(logFile, true).use { fw ->
                    PrintWriter(fw).use { pw ->
                        pw.println(line)
                    }
                }
            } catch (_: Exception) {}
            // Also print to logcat
            when (level) {
                "E" -> Log.e(tag, message)
                "W" -> Log.w(tag, message)
                else -> Log.i(tag, message)
            }
        }

        fun e(tag: String, msg: String) = log("E", tag, msg)
        fun w(tag: String, msg: String) = log("W", tag, msg)
        fun i(tag: String, msg: String) = log("I", tag, msg)
    }

    private fun flog(level: String, tag: String, message: String) {
        fileLogger?.log(level, tag, message)
    }

    // ===================== HTTP GET =====================
    private fun httpGet(urlStr: String): String {
        return try {
            val conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 20000
            conn.readTimeout = 20000
            val code = conn.responseCode
            flog("I", tag, "httpGet: $urlStr → HTTP $code")
            val body = if (code in 200..299) {
                BufferedReader(InputStreamReader(conn.inputStream)).readText()
            } else {
                val err = conn.errorStream?.let { BufferedReader(InputStreamReader(it)).readText() } ?: "{}"
                flog("W", tag, "httpGet error: HTTP $code — $err")
                err
            }
            conn.disconnect()
            body
        } catch (e: Exception) {
            flog("E", tag, "httpGet EXCEPTION: ${e.message}")
            throw e
        }
    }

    private fun httpPost(urlStr: String, jsonBody: String): String {
        return try {
            val conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            flog("I", tag, "httpPost: $urlStr")
            conn.outputStream.use { os ->
                os.write(jsonBody.toByteArray(Charsets.UTF_8))
                os.flush()
            }
            val code = conn.responseCode
            flog("I", tag, "httpPost: HTTP $code")
            val body = if (code in 200..299) {
                BufferedReader(InputStreamReader(conn.inputStream)).readText()
            } else {
                val err = conn.errorStream?.let { BufferedReader(InputStreamReader(it)).readText() } ?: "{}"
                flog("W", tag, "httpPost error: HTTP $code — $err")
                err
            }
            conn.disconnect()
            body
        } catch (e: Exception) {
            flog("E", tag, "httpPost EXCEPTION: ${e.message}")
            throw e
        }
    }
}