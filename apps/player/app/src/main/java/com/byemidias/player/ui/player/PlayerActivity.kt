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
import android.widget.TextView
import android.widget.VideoView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.BuildConfig
import com.byemidias.player.R
import com.byemidias.player.service.PlayerService
import com.byemidias.player.ui.config.ConfigActivity
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class PlayerActivity : ComponentActivity() {

    private val tag = "Player"
    private lateinit var prefs: SharedPreferences

    private lateinit var rootLayout: FrameLayout
    private lateinit var statusText: TextView

    private var mediaList = mutableListOf<MediaItem>()
    private var currentIndex = 0
    private var currentCampaignId: String? = null
    private var currentPlaylistId: String? = null
    private var currentContentVersion: Int = 0
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
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

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

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                Log.i(tag, "Back button pressed — ignored (DOOH player)")
            }
        })

        prefs = getSharedPreferences("byemidias", MODE_PRIVATE)
        applyRotationFromPrefs()

        requestNotificationPermission()

        val deviceId = prefs.getString("device_id", null)
        if (deviceId.isNullOrEmpty()) {
            showActivation()
        } else {
            startPlayer()
        }
    }

    override fun onResume() {
        super.onResume()
        applyRotationFromPrefs()
        lifecycleScope.launch(Dispatchers.IO) {
            sendHeartbeatOn()
        }
    }

    override fun onStop() {
        super.onStop()
        Log.i(tag, "onStop — sending offline")
        lifecycleScope.launch(Dispatchers.IO) {
            sendHeartbeatOff()
        }
        ensureServiceRunning()
    }

    override fun onDestroy() {
        super.onDestroy()
        clockHandler?.removeCallbacksAndMessages(null)
        syncHandler?.removeCallbacksAndMessages(null)
        lifecycleScope.launch(Dispatchers.IO) {
            sendHeartbeatOff()
        }
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        Log.i(tag, "onTrimMemory level=$level")
        if (level >= ComponentCallbacks2.TRIM_MEMORY_MODERATE) {
            ensureServiceRunning()
        }
    }

    private fun applyRotationFromPrefs() {
        val rotation = prefs.getInt("screen_rotation", 0)
        val mirrorH = prefs.getBoolean("mirror_horizontal", false)
        val mirrorV = prefs.getBoolean("mirror_vertical", false)
        if (::rootLayout.isInitialized) {
            runOnUiThread {
                when (rotation) {
                    90 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    270 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                    180 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                    0 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    -1 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                }
                rootLayout.scaleX = if (mirrorH) -1f else 1f
                rootLayout.scaleY = if (mirrorV) -1f else 1f
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

    private fun scheduleRestart() {
        try {
            val intent = Intent(this, PlayerActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
            alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, pendingIntent)
            Log.i(tag, "Restart scheduled via AlarmManager")
        } catch (e: Exception) {
            Log.e(tag, "Failed to schedule restart: ${e.message}")
        }
    }

    // ===================== ACTIVATION =====================

    private fun showActivation() {
        setContentView(R.layout.activity_activation)

        val codeInput = findViewById<EditText>(R.id.codeInput)
        val activateBtn = findViewById<Button>(R.id.activateBtn)
        val errorText = findViewById<TextView>(R.id.errorText)
        val activateStatus = findViewById<TextView>(R.id.activateStatusText)

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
                    Log.i(tag, "Activating with URL: $apiUrl")

                    val body = JSONObject().apply {
                        put("device_uuid", getDeviceUuid())
                        put("activation_code", code)
                        put("model", android.os.Build.MODEL)
                        put("manufacturer", android.os.Build.MANUFACTURER)
                    }

                    val result = httpPost("$apiUrl/api/device/activate", body.toString())
                    Log.i(tag, "Activation response: ${result.take(200)}")

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

                    Log.i(tag, "Activation success, device_id: $deviceId")
                    val saved = prefs.edit().putString("device_id", deviceId).commit()
                    Log.i(tag, "Prefs saved: $saved")

                    if (!saved) {
                        withContext(Dispatchers.Main) {
                            errorText.text = "Erro ao salvar dados"
                            errorText.visibility = View.VISIBLE
                            activateBtn.isEnabled = true
                            activateStatus.visibility = View.GONE
                        }
                        return@launch
                    }

                    withContext(Dispatchers.Main) {
                        startPlayer()
                    }
                } catch (e: Exception) {
                    Log.e(tag, "Activation failed", e)
                    withContext(Dispatchers.Main) {
                        errorText.text = "Erro: ${e.message}"
                        errorText.visibility = View.VISIBLE
                        activateBtn.isEnabled = true
                        activateStatus.visibility = View.GONE
                    }
                }
            }
        }
    }

    // ===================== PLAYER =====================

    private fun startPlayer() {
        setContentView(R.layout.activity_player)
        rootLayout = findViewById(R.id.root)
        statusText = findViewById(R.id.statusText)

        rootLayout.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_DOWN) {
                val now = System.currentTimeMillis()
                if (now - lastTapTime > TAP_TIMEOUT) {
                    tapCount = 0
                }
                tapCount++
                lastTapTime = now
                if (tapCount >= TAP_THRESHOLD) {
                    tapCount = 0
                    Log.i(tag, "6x tap detected — opening ConfigActivity")
                    val intent = Intent(this, ConfigActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
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
    }

    private fun startClockUpdates() {
        clockHandler = Handler(Looper.getMainLooper())
        val runnable = object : Runnable {
            override fun run() {
                val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                val dateStr = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date())
                val timeStr = sdf.format(Date())
                for (tv in clockTextViews) {
                    val format = tv.tag as? String ?: "HH:mm:ss"
                    val display = if (format == "date") dateStr else timeStr
                    tv.text = display
                }
                clockHandler?.postDelayed(this, 1000)
            }
        }
        clockHandler?.post(runnable)
    }

    private fun buildZoneLayout() {
        runOnUiThread {
            clearZoneViews()

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
                        lp.leftMargin = zoneLeft
                        lp.topMargin = zoneTop
                        rootLayout.addView(tv, lp)
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
                        lp.leftMargin = zoneLeft
                        lp.topMargin = zoneTop
                        rootLayout.addView(tv, lp)
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
                        lp.leftMargin = zoneLeft
                        lp.topMargin = zoneTop
                        rootLayout.addView(tv, lp)
                        widgetTextViews.add(tv)
                    }
                    "logo" -> {
                        val iv = ImageView(this)
                        iv.scaleType = ImageView.ScaleType.FIT_CENTER
                        val bgColor = zone.widgetConfig["bg_color"] ?: "#000000"
                        iv.setBackgroundColor(Color.parseColor(bgColor))
                        val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                        lp.leftMargin = zoneLeft
                        lp.topMargin = zoneTop
                        rootLayout.addView(iv, lp)
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
                        val bgColor = zone.widgetConfig["color"] ?: "#6B21A8"
                        val opacity = (zone.widgetConfig["opacity"]?.toFloatOrNull() ?: 0.5f) / 100f
                        v.setBackgroundColor(Color.parseColor(bgColor))
                        v.alpha = opacity
                        val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                        lp.leftMargin = zoneLeft
                        lp.topMargin = zoneTop
                        rootLayout.addView(v, lp)
                    }
                    else -> {
                        val v = View(this)
                        v.setBackgroundColor(Color.parseColor("#1F2937"))
                        val lp = FrameLayout.LayoutParams(zoneW, zoneH)
                        lp.leftMargin = zoneLeft
                        lp.topMargin = zoneTop
                        rootLayout.addView(v, lp)
                    }
                }
            }
        }
    }

    private fun fetchWeather(tv: TextView, city: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val url = "https://wttr.in/${city}?format=%t+%C&lang=pt"
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 10000
                conn.readTimeout = 10000
                val code = conn.responseCode
                if (code in 200..299) {
                    val temp = BufferedReader(InputStreamReader(conn.inputStream)).readText().trim()
                    withContext(Dispatchers.Main) { tv.text = temp }
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(tag, "Weather fetch failed: ${e.message}")
            }
        }
    }

    private fun clearZoneViews() {
        videoView?.let { rootLayout.removeView(it) }
        imageView?.let { rootLayout.removeView(it) }
        for (v in activeZoneViews) rootLayout.removeView(v)
        for (v in clockTextViews) rootLayout.removeView(v)
        for (v in weatherTextViews) rootLayout.removeView(v)
        for (v in widgetTextViews) rootLayout.removeView(v)
        videoView = null
        imageView = null
        activeZoneViews.clear()
        clockTextViews.clear()
        weatherTextViews.clear()
        widgetTextViews.clear()
    }

    private fun createMediaViewsForZone(zone: ZoneData) {
        runOnUiThread {
            videoView?.let { rootLayout.removeView(it) }
            imageView?.let { rootLayout.removeView(it) }

            val dm = resources.displayMetrics
            val screenW = dm.widthPixels
            val screenH = dm.heightPixels
            val zoneW = (zone.width / 100f * screenW).toInt()
            val zoneH = (zone.height / 100f * screenH).toInt()
            val zoneX = (zone.x / 100f * screenW).toInt()
            val zoneY = (zone.y / 100f * screenH).toInt()

            val vv = VideoView(this)
            vv.visibility = View.GONE
            val lpV = FrameLayout.LayoutParams(zoneW, zoneH)
            lpV.leftMargin = zoneX
            lpV.topMargin = zoneY
            rootLayout.addView(vv, lpV)
            videoView = vv

            val iv = ImageView(this)
            iv.visibility = View.GONE
            iv.scaleType = ImageView.ScaleType.CENTER_CROP
            iv.adjustViewBounds = false
            val lpI = FrameLayout.LayoutParams(zoneW, zoneH)
            lpI.leftMargin = zoneX
            lpI.topMargin = zoneY
            rootLayout.addView(iv, lpI)
            imageView = iv
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
            Log.i(tag, "Foreground service started")
        } catch (e: Exception) {
            Log.e(tag, "Failed to start foreground service", e)
        }
    }

    private fun startPeriodicSync() {
        syncHandler?.removeCallbacksAndMessages(null)
        syncHandler = Handler(Looper.getMainLooper())
        val runnable = object : Runnable {
            override fun run() {
                Log.i(tag, "Periodic sync check (interval=${syncIntervalSeconds}s)")
                needsResync = true
                syncHandler?.postDelayed(this, syncIntervalSeconds * 1000L)
            }
        }
        syncHandler?.postDelayed(runnable, syncIntervalSeconds * 1000L)
    }

    private suspend fun syncAndPlay() {
        while (true) {
            try {
                showStatus("Sincronizando...")
                val result = fetchMedia()
                val items = result.first
                val zones = result.second
                if (items.isEmpty()) {
                    showStatus("Sem midia vinculada. Aguardando campanha...")
                    delay(30000)
                    continue
                }
                mediaList.clear()
                mediaList.addAll(items)
                currentIndex = 0

                layoutZones = zones
                if (layoutZones.isNotEmpty()) {
                    buildZoneLayout()
                    val campaignZone = layoutZones.firstOrNull { it.type == "campaign" }
                    if (campaignZone != null) {
                        createMediaViewsForZone(campaignZone)
                    }
                } else {
                    videoView = findViewById(R.id.videoView)
                    imageView = findViewById(R.id.imageView)
                }

                hideStatus()
                startPeriodicSync()
                playLoop()
            } catch (e: Exception) {
                Log.e(tag, "Sync failed", e)
                showStatus("Erro sync: ${e.message?.take(60)}")
                delay(10000)
            }
        }
    }

    private suspend fun fetchMedia(): Pair<List<MediaItem>, List<ZoneData>> = withContext(Dispatchers.IO) {
        val deviceId = prefs.getString("device_id", "") ?: ""
        val apiUrl = getApiUrl()

        val url = "$apiUrl/api/device/sync?device_id=$deviceId&content_version=$currentContentVersion"
        val response = httpGet(url)
        Log.i(tag, "Sync response: ${response.take(500)}")

        val json = JSONObject(response)

        if (json.has("error")) {
            val errorMsg = json.getString("error")
            Log.e(tag, "Sync error: $errorMsg")
            if (errorMsg.contains("não encontrado") || errorMsg.contains("404")) {
                prefs.edit().remove("device_id").commit()
                withContext(Dispatchers.Main) {
                    showActivation()
                }
                return@withContext Pair(emptyList(), emptyList())
            }
            return@withContext Pair(emptyList(), emptyList())
        }

        val items = mutableListOf<MediaItem>()
        val playlists = json.optJSONArray("playlists") ?: return@withContext Pair(emptyList(), emptyList())
        val mediaArray = json.optJSONArray("media") ?: return@withContext Pair(emptyList(), emptyList())

        val respCampaignId = json.optString("campaign_id", "")
        if (!respCampaignId.isNullOrEmpty()) {
            currentCampaignId = respCampaignId
        } else {
            currentCampaignId = null
        }

        syncIntervalSeconds = json.optInt("sync_interval_seconds", 30)
        Log.i(tag, "Sync interval set to ${syncIntervalSeconds}s")

        if (json.optBoolean("screenshot_requested", false)) {
            Log.i(tag, "Screenshot requested by server — capturing")
            sendScreenshot()
        }

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
                val duration = item.optInt("duration", 0)
                    .coerceAtLeast(media.optInt("duration", 0))
                    .coerceAtLeast(5)

                items.add(MediaItem(
                    id = mediaId,
                    name = media.optString("name", ""),
                    type = media.optString("type", "image"),
                    fileUrl = media.optString("file_url", ""),
                    duration = duration,
                    campaignId = respCampaignId,
                    playlistId = playlistId
                ))
            }
        }

        Log.i(tag, "Fetched ${items.size} media items")

        val respVersion = json.optInt("content_version", 0)
        if (respVersion > 0) currentContentVersion = respVersion

        val zonesArray = json.optJSONArray("layout_zones")
        val zones = mutableListOf<ZoneData>()
        if (zonesArray != null) {
            for (i in 0 until zonesArray.length()) {
                val z = zonesArray.getJSONObject(i)
                val widgetConfig = mutableMapOf<String, String>()
                val wci = z.optJSONObject("widget_config")
                if (wci != null) {
                    for (key in wci.keys()) {
                        widgetConfig[key] = wci.optString(key, "")
                    }
                }
                zones.add(ZoneData(
                    name = z.optString("name", ""),
                    x = z.optDouble("x", 0.0).toFloat(),
                    y = z.optDouble("y", 0.0).toFloat(),
                    width = z.optDouble("width", 100.0).toFloat(),
                    height = z.optDouble("height", 100.0).toFloat(),
                    type = z.optString("type", "campaign"),
                    widgetType = z.optString("widget_type", ""),
                    widgetConfig = widgetConfig
                ))
            }
        }

        Pair(items, zones)
    }

    private suspend fun playLoop() {
        while (mediaList.isNotEmpty()) {
            if (needsResync) {
                Log.i(tag, "Resync flag detected, breaking play loop")
                needsResync = false
                break
            }
            if (currentIndex >= mediaList.size) currentIndex = 0
            val item = mediaList[currentIndex]
            Log.i(tag, "Playing ${currentIndex + 1}/${mediaList.size}: ${item.name} (${item.type}, ${item.duration}s)")

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
        val vv = videoView ?: run {
            Log.w(tag, "No videoView available, skipping video")
            delay(item.duration * 1000L)
            return
        }

        val latch = java.util.concurrent.CountDownLatch(1)

        withContext(Dispatchers.Main) {
            imageView?.visibility = View.GONE
            vv.visibility = View.VISIBLE

            vv.setOnPreparedListener { mp ->
                mp.isLooping = false
                mp.start()
            }
            vv.setOnCompletionListener { latch.countDown() }
            vv.setOnErrorListener { _, what, extra ->
                Log.e(tag, "Video error: what=$what extra=$extra")
                latch.countDown()
                true
            }

            vv.setVideoURI(Uri.parse(item.fileUrl))
        }

        withContext(Dispatchers.IO) {
            latch.await(item.duration.toLong() + 30, java.util.concurrent.TimeUnit.SECONDS)
        }
    }

    private suspend fun playImage(item: MediaItem) {
        val iv = imageView ?: run {
            Log.w(tag, "No imageView available, skipping image")
            delay(item.duration * 1000L)
            return
        }
        withContext(Dispatchers.Main) {
            videoView?.visibility = View.GONE
            iv.visibility = View.VISIBLE
            iv.scaleType = ImageView.ScaleType.CENTER_CROP
        }

        try {
            val bitmap = withContext(Dispatchers.IO) {
                URL(item.fileUrl).openStream().use { BitmapFactory.decodeStream(it) }
            }
            if (bitmap != null) {
                withContext(Dispatchers.Main) {
                    iv.setImageBitmap(bitmap)
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "Image load failed: ${item.name}", e)
        }

        delay(item.duration * 1000L)
    }

    // ===================== PLAYBACK LOG =====================

    private fun logPlayback(item: MediaItem) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val deviceId = prefs.getString("device_id", "") ?: ""
                if (deviceId.isEmpty()) return@launch
                val apiUrl = getApiUrl()
                val uptime = ((System.currentTimeMillis() - ByeMidiasApp.instance.sessionStartTime) / 1000).toInt()
                val body = JSONObject().apply {
                    put("device_id", deviceId)
                    put("status", "playing")
                    put("player_version", getVersionName())
                    put("uptime_seconds", uptime)
                    put("media_id", item.id)
                    if (item.campaignId != null) put("campaign_id", item.campaignId)
                    if (item.playlistId != null) put("playlist_id", item.playlistId)
                }
                val result = httpPost("$apiUrl/api/device/heartbeat", body.toString())
                if (result.isNotEmpty()) {
                    val json = JSONObject(result)
                    val serverVersion = json.optInt("content_version", 0)
                    if (serverVersion > currentContentVersion && currentContentVersion > 0) {
                        Log.i(tag, "Content changed via playback log: $currentContentVersion -> $serverVersion")
                        currentContentVersion = serverVersion
                        needsResync = true
                    }
                    applyDeviceSettings(json)
                }
            } catch (e: Exception) {
                Log.e(tag, "Playback log failed", e)
            }
        }
    }

    // ===================== HTTP =====================

    private fun httpGet(urlStr: String): String {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.setRequestProperty("Accept", "application/json")
        conn.connect()
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

    // ===================== HEARTBEAT =====================

    private fun sendHeartbeatOn() {
        try {
            val deviceId = prefs.getString("device_id", "") ?: ""
            if (deviceId.isEmpty()) {
                Log.w(tag, "Heartbeat skipped: empty device_id")
                return
            }
            val apiUrl = getApiUrl()
            val uptime = ((System.currentTimeMillis() - ByeMidiasApp.instance.sessionStartTime) / 1000).toInt()
            val body = JSONObject().apply {
                put("device_id", deviceId)
                put("status", "online")
                put("player_version", getVersionName())
                put("uptime_seconds", uptime)
            }
            Log.i(tag, "Sending heartbeat ON to $apiUrl with device_id=$deviceId")
            val result = httpPost("$apiUrl/api/device/heartbeat", body.toString())
            Log.i(tag, "Heartbeat ON response: ${result.take(200)}")
            if (result.isNotEmpty()) {
                val json = JSONObject(result)
                applyDeviceSettings(json)
            }
        } catch (e: Exception) {
            Log.e(tag, "Heartbeat ON failed: ${e.message}", e)
        }
    }

    private fun applyDeviceSettings(json: JSONObject) {
        try {
            val serverVersion = json.optInt("content_version", 0)
            if (serverVersion > currentContentVersion && currentContentVersion > 0) {
                Log.i(tag, "Content changed: $currentContentVersion -> $serverVersion, flagging resync")
                currentContentVersion = serverVersion
                needsResync = true
            } else if (currentContentVersion == 0) {
                currentContentVersion = serverVersion
            }

            if (json.optBoolean("restart", false)) {
                Log.i(tag, "Restart requested by server")
                runOnUiThread {
                    val intent = packageManager.getLaunchIntentForPackage(packageName)
                    intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                    finish()
                }
            }

            val rotation = json.optInt("screen_rotation", 0)
            val mirrorH = json.optBoolean("mirror_horizontal", false)
            val mirrorV = json.optBoolean("mirror_vertical", false)

            if (rotation != lastAppliedRotation || mirrorH != lastAppliedMirrorH || mirrorV != lastAppliedMirrorV) {
                lastAppliedRotation = rotation
                lastAppliedMirrorH = mirrorH
                lastAppliedMirrorV = mirrorV
                runOnUiThread {
                    when (rotation) {
                        90 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                        270 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                        180 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                        0 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    }
                    rootLayout.scaleX = if (mirrorH) -1f else 1f
                    rootLayout.scaleY = if (mirrorV) -1f else 1f
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "applyDeviceSettings error: ${e.message}")
        }
    }

    private fun sendHeartbeatOff() {
        try {
            val deviceId = prefs.getString("device_id", "") ?: ""
            if (deviceId.isEmpty()) return
            val apiUrl = getApiUrl()
            val body = JSONObject().apply {
                put("device_id", deviceId)
                put("status", "offline")
                put("player_version", getVersionName())
            }
            httpPost("$apiUrl/api/device/heartbeat", body.toString())
            Log.i(tag, "Heartbeat OFF sent")
        } catch (e: Exception) {
            Log.e(tag, "Heartbeat OFF failed: ${e.message}")
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

    private var lastScreenshotTime = 0L
    private fun sendScreenshot() {
        try {
            val now = System.currentTimeMillis()
            if (now - lastScreenshotTime < 2000) return
            lastScreenshotTime = now

            val deviceId = prefs.getString("device_id", "") ?: ""
            if (deviceId.isEmpty()) return

            if (!::rootLayout.isInitialized) return
            val view = rootLayout
            val bitmap = android.graphics.Bitmap.createBitmap(view.width, view.height, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            view.draw(canvas)

            val baos = java.io.ByteArrayOutputStream()
            bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 60, baos)
            val base64 = android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP)
            bitmap.recycle()

            val apiUrl = getApiUrl()
            val body = JSONObject().apply {
                put("device_id", deviceId)
                put("screenshot", "data:image/jpeg;base64,$base64")
            }
            lifecycleScope.launch(Dispatchers.IO) {
                httpPost("$apiUrl/api/device/screenshot", body.toString())
                Log.i(tag, "Screenshot sent (${base64.length / 1024}KB)")
            }
        } catch (e: Exception) {
            Log.e(tag, "Screenshot failed: ${e.message}")
        }
    }

    // ===================== HELPERS =====================

    private fun getApiUrl(): String {
        return prefs.getString("api_base_url", null) ?: BuildConfig.API_BASE_URL
    }

    private fun getDeviceUuid(): String {
        var uuid = prefs.getString("device_uuid", null)
        if (uuid == null) {
            uuid = java.util.UUID.randomUUID().toString()
            prefs.edit().putString("device_uuid", uuid).commit()
        }
        return uuid
    }

    private fun getVersionName(): String {
        return try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0.0"
        } catch (e: Exception) { "1.0.0" }
    }

    private fun showStatus(msg: String) {
        Log.i(tag, msg)
        lifecycleScope.launch(Dispatchers.Main) {
            statusText.text = msg
            statusText.visibility = View.VISIBLE
        }
    }

    private fun hideStatus() {
        lifecycleScope.launch(Dispatchers.Main) {
            statusText.visibility = View.GONE
        }
    }
}
