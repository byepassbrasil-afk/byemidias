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
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ScrollView
import android.widget.TextView
import android.widget.VideoView
import android.widget.LinearLayout
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.BuildConfig
import com.byemidias.player.R
import com.byemidias.player.service.PlayerService
import com.byemidias.player.ui.config.ConfigActivity
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class PlayerActivity : ComponentActivity() {

    private val tag = "Player"
    private var prefs: SharedPreferences? = null

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

    private var videoView: VideoView? = null
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
    private val TAP_THRESHOLD = 6
    private val TAP_TIMEOUT = 2000L

    data class MediaItem(
        val id: String,
        val name: String,
        val type: String,
        val fileUrl: String,
        val duration: Int,
        val campaignId: String?,
        val playlistId: String?
    )

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
            Log.i(tag, "onCreate START")

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

            prefs = getSharedPreferences("byemidias", MODE_PRIVATE)

            try {
                applyRotationFromPrefs()
            } catch (e: Exception) {
                Log.e(tag, "applyRotation failed: ${e.message}")
            }

            try {
                requestNotificationPermission()
            } catch (e: Exception) {
                Log.e(tag, "requestNotificationPermission failed: ${e.message}")
            }

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
        try {
            ensureServiceRunning()
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
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
        if (level >= ComponentCallbacks2.TRIM_MEMORY_MODERATE) {
            try { ensureServiceRunning() } catch (_: Exception) {}
        }
    }

    private fun applyRotationFromPrefs() {
        val p = prefs ?: return
        val rotation = p.getInt("screen_rotation", 0)
        val mirrorH = p.getBoolean("mirror_horizontal", false)
        val mirrorV = p.getBoolean("mirror_vertical", false)
        val rl = rootLayout ?: return
        runOnUiThread {
            when (rotation) {
                90 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                270 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                180 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                0 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                -1 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            }
            rl.scaleX = if (mirrorH) -1f else 1f
            rl.scaleY = if (mirrorV) -1f else 1f
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

    private fun ensureServiceRunning() {
        try {
            val serviceIntent = Intent(this, PlayerService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e(tag, "Failed to start service: ${e.message}")
        }
    }

    // ===================== ACTIVATION =====================

    private fun showActivation() {
        try {
            setContentView(R.layout.activity_activation)

            val codeInput = findViewById<EditText>(R.id.codeInput) ?: return
            val activateBtn = findViewById<Button>(R.id.activateBtn) ?: return
            val errorText = findViewById<TextView>(R.id.errorText) ?: return
            val activateStatus = findViewById<TextView>(R.id.activateStatusText) ?: return

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

    // ===================== PLAYER =====================

    private fun startPlayer() {
        try {
            setContentView(R.layout.activity_player)
            rootLayout = findViewById(R.id.root)
            statusText = findViewById(R.id.statusText)

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

            startForegroundService()

            lifecycleScope.launch(Dispatchers.IO) {
                sendHeartbeatOn()
                syncAndPlay()
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
        try { videoView?.let { rootLayout?.removeView(it) } } catch (_: Exception) {}
        try { imageView?.let { rootLayout?.removeView(it) } } catch (_: Exception) {}
        for (v in activeZoneViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        for (v in clockTextViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        for (v in weatherTextViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        for (v in widgetTextViews) try { rootLayout?.removeView(v) } catch (_: Exception) {}
        videoView = null; imageView = null
        activeZoneViews.clear(); clockTextViews.clear(); weatherTextViews.clear(); widgetTextViews.clear()
    }

    private fun createMediaViewsForZone(zone: ZoneData) {
        runOnUiThread {
            try {
                val rl = rootLayout ?: return@runOnUiThread
                videoView?.let { rl.removeView(it) }
                imageView?.let { rl.removeView(it) }

                val dm = resources.displayMetrics
                val screenW = dm.widthPixels; val screenH = dm.heightPixels
                val zoneW = (zone.width / 100f * screenW).toInt()
                val zoneH = (zone.height / 100f * screenH).toInt()
                val zoneX = (zone.x / 100f * screenW).toInt()
                val zoneY = (zone.y / 100f * screenH).toInt()

                val vv = VideoView(this)
                vv.visibility = View.GONE
                val lpV = FrameLayout.LayoutParams(zoneW, zoneH)
                lpV.leftMargin = zoneX; lpV.topMargin = zoneY
                rl.addView(vv, lpV)
                videoView = vv

                val iv = ImageView(this)
                iv.visibility = View.GONE
                iv.scaleType = ImageView.ScaleType.CENTER_CROP
                iv.adjustViewBounds = false
                val lpI = FrameLayout.LayoutParams(zoneW, zoneH)
                lpI.leftMargin = zoneX; lpI.topMargin = zoneY
                rl.addView(iv, lpI)
                imageView = iv
            } catch (e: Exception) {
                Log.e(tag, "createMediaViewsForZone error: ${e.message}")
            }
        }
    }

    private fun startForegroundService() {
        try {
            val serviceIntent = Intent(this, PlayerService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e(tag, "startForegroundService failed: ${e.message}")
        }
    }

    private fun startPeriodicSync() {
        syncHandler?.removeCallbacksAndMessages(null)
        syncHandler = Handler(Looper.getMainLooper())
        val runnable = object : Runnable {
            override fun run() {
                needsResync = true
                syncHandler?.postDelayed(this, syncIntervalSeconds * 1000L)
            }
        }
        syncHandler?.postDelayed(runnable, syncIntervalSeconds * 1000L)
    }

    private suspend fun syncAndPlay() {
        var isFirstSync = true
        while (true) {
            try {
                if (isFirstSync || mediaList.isEmpty()) {
                    showStatus("Sincronizando...")
                }
                val result = fetchMedia()
                val items = result.first
                val zones = result.second
                if (items.isEmpty()) {
                    showStatus("Sem midia vinculada. Aguardando campanha...")
                    delay(5000)
                    continue
                }
                mediaList.clear()
                mediaList.addAll(items)
                currentIndex = 0

                layoutZones = zones
                if (layoutZones.isNotEmpty()) {
                    buildZoneLayout()
                    val campaignZone = layoutZones.firstOrNull { it.type == "campaign" }
                    if (campaignZone != null) createMediaViewsForZone(campaignZone)
                } else {
                    videoView = findViewById(R.id.videoView)
                    imageView = findViewById(R.id.imageView)
                }

                hideStatus()
                isFirstSync = false
                startPeriodicSync()
                playLoop()
            } catch (e: Exception) {
                Log.e(tag, "Sync failed", e)
                showStatus("Erro sync: ${e.message?.take(60)}")
                delay(5000)
            }
        }
    }

    private suspend fun fetchMedia(): Pair<List<MediaItem>, List<ZoneData>> = withContext(Dispatchers.IO) {
        val deviceId = prefs?.getString("device_id", "") ?: ""
        val apiUrl = getApiUrl()

        val url = "$apiUrl/api/device/sync?device_id=$deviceId&content_version=$currentContentVersion"
        val response = httpGet(url)
        val json = JSONObject(response)

        if (json.has("error")) {
            val errorMsg = json.getString("error")
            if (errorMsg.contains("não encontrado") || errorMsg.contains("404")) {
                prefs?.edit()?.remove("device_id")?.commit()
                withContext(Dispatchers.Main) { showActivation() }
                return@withContext Pair(emptyList(), emptyList())
            }
            return@withContext Pair(emptyList(), emptyList())
        }

        val items = mutableListOf<MediaItem>()
        val playlists = json.optJSONArray("playlists") ?: return@withContext Pair(emptyList(), emptyList())
        val mediaArray = json.optJSONArray("media") ?: return@withContext Pair(emptyList(), emptyList())

        val respCampaignId = json.optString("campaign_id", "")
        currentCampaignId = if (!respCampaignId.isNullOrEmpty()) respCampaignId else null

        syncIntervalSeconds = json.optInt("sync_interval_seconds", 30)

        if (json.optBoolean("screenshot_requested", false)) sendScreenshot()

        val mediaMap = mutableMapOf<String, JSONObject>()
        for (i in 0 until mediaArray.length()) {
            val m = mediaArray.getJSONObject(i)
            mediaMap[m.getString("id")] = m
        }

        for (i in 0 until playlists.length()) {
            val playlist = playlists.getJSONObject(i)
            val playlistId = playlist.optString("id", "")
            val playlistItems = playlist.optJSONArray("items") ?: continue
            for (j in 0 until playlistItems.length()) {
                val item = playlistItems.getJSONObject(j)
                val mediaId = item.optString("media_id", "")
                if (mediaId.isEmpty()) continue
                val media = mediaMap[mediaId] ?: continue
                val duration = item.optInt("duration", 0).coerceAtLeast(media.optInt("duration", 0)).coerceAtLeast(5)
                items.add(MediaItem(mediaId, media.optString("name", ""), media.optString("type", "image"),
                    media.optString("file_url", ""), duration, respCampaignId, playlistId))
            }
        }

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
        while (mediaList.isNotEmpty()) {
            if (needsResync) { needsResync = false; break }
            if (currentIndex >= mediaList.size) currentIndex = 0
            val item = mediaList[currentIndex]
            try {
                when {
                    item.type == "video" -> playVideo(item)
                    item.type == "image" || item.type == "gif" -> playImage(item)
                    else -> delay(item.duration * 1000L)
                }
                logPlayback(item)
            } catch (e: Exception) {
                Log.e(tag, "Play error: ${item.name}", e)
                delay(2000)
            }
            currentIndex++
        }
    }

    private suspend fun playVideo(item: MediaItem) {
        val vv = videoView ?: run { delay(item.duration * 1000L); return }
        val latch = java.util.concurrent.CountDownLatch(1)
        withContext(Dispatchers.Main) {
            imageView?.visibility = View.GONE
            vv.visibility = View.VISIBLE
            vv.setOnPreparedListener { mp -> mp.isLooping = false; mp.start() }
            vv.setOnCompletionListener { latch.countDown() }
            vv.setOnErrorListener { _, _, _ -> latch.countDown(); true }
            vv.setVideoURI(Uri.parse(item.fileUrl))
        }
        withContext(Dispatchers.IO) { latch.await(item.duration.toLong() + 30, java.util.concurrent.TimeUnit.SECONDS) }
    }

    private suspend fun playImage(item: MediaItem) {
        val iv = imageView ?: run { delay(item.duration * 1000L); return }
        try {
            val bitmap = withContext(Dispatchers.IO) { URL(item.fileUrl).openStream().use { BitmapFactory.decodeStream(it) } }
            if (bitmap != null) {
                withContext(Dispatchers.Main) {
                    videoView?.visibility = View.GONE
                    iv.visibility = View.VISIBLE
                    iv.scaleType = ImageView.ScaleType.CENTER_CROP
                    iv.setImageBitmap(bitmap)
                }
            }
        } catch (e: Exception) { Log.e(tag, "Image load failed: ${item.name}") }
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
                val serverVersion = json.optLong("content_version", 0)
                if (serverVersion > currentContentVersion && currentContentVersion > 0) {
                    currentContentVersion = serverVersion; needsResync = true
                    }
                    applyDeviceSettings(json)
                }
            } catch (_: Exception) {}
        }
    }

    // ===================== HTTP =====================

    private fun httpGet(urlStr: String): String {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"; conn.connectTimeout = 15000; conn.readTimeout = 15000
        conn.setRequestProperty("Accept", "application/json"); conn.connect()
        val code = conn.responseCode
        val body = if (code in 200..299) BufferedReader(InputStreamReader(conn.inputStream)).readText()
        else { val err = conn.errorStream; if (err != null) BufferedReader(InputStreamReader(err)).readText() else "{}" }
        conn.disconnect(); return body
    }

    private fun httpPost(urlStr: String, jsonBody: String): String {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"; conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json"); conn.doOutput = true
        conn.connectTimeout = 15000; conn.readTimeout = 15000; conn.connect()
        conn.outputStream.use { os -> os.write(jsonBody.toByteArray(Charsets.UTF_8)); os.flush() }
        val code = conn.responseCode
        val body = if (code in 200..299) BufferedReader(InputStreamReader(conn.inputStream)).readText()
        else { val err = conn.errorStream; if (err != null) BufferedReader(InputStreamReader(err)).readText() else "{}" }
        conn.disconnect(); return body
    }

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
            val serverVersion = json.optLong("content_version", 0)
            if (serverVersion > currentContentVersion && currentContentVersion > 0) {
                currentContentVersion = serverVersion; needsResync = true
            } else if (currentContentVersion == 0L) {
                currentContentVersion = serverVersion
            }

            if (json.optBoolean("restart", false)) {
                runOnUiThread {
                    try {
                        val intent = packageManager.getLaunchIntentForPackage(packageName)
                        intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent); finish()
                    } catch (_: Exception) {}
                }
            }

            val rotation = json.optInt("screen_rotation", 0)
            val mirrorH = json.optBoolean("mirror_horizontal", false)
            val mirrorV = json.optBoolean("mirror_vertical", false)

            if (rotation != lastAppliedRotation || mirrorH != lastAppliedMirrorH || mirrorV != lastAppliedMirrorV) {
                lastAppliedRotation = rotation; lastAppliedMirrorH = mirrorH; lastAppliedMirrorV = mirrorV
                runOnUiThread {
                    when (rotation) {
                        90 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                        270 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                        180 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                        else -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    }
                    rootLayout?.scaleX = if (mirrorH) -1f else 1f
                    rootLayout?.scaleY = if (mirrorV) -1f else 1f
                }
            }
        } catch (_: Exception) {}
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
        Log.i(tag, msg)
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
}
