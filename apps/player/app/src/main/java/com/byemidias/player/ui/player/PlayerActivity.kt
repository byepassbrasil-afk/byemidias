package com.byemidias.player.ui.player

import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.widget.ImageView
import android.widget.VideoView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.R
import com.byemidias.player.data.models.CachedCampaign
import com.byemidias.player.data.models.CachedMedia
import com.byemidias.player.data.models.CachedPlaylist
import com.byemidias.player.ui.activation.ActivationActivity
import com.byemidias.player.workers.HeartbeatWorker
import com.byemidias.player.workers.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class PlayerActivity : ComponentActivity() {

    private val app by lazy { application as ByeMidiasApp }
    private val repo by lazy { app.deviceRepository }

    private lateinit var videoView: VideoView
    private lateinit var imageView: ImageView

    private var currentPlaylist: CachedPlaylist? = null
    private var currentItemIndex = 0
    private var isPlaying = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fullscreen immersive
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        setContentView(R.layout.activity_player)

        videoView = findViewById(R.id.videoView)
        imageView = findViewById(R.id.imageView)

        // Check activation
        if (!repo.isActivated()) {
            startActivity(android.content.Intent(this, ActivationActivity::class.java))
            finish()
            return
        }

        // Start background workers
        HeartbeatWorker.schedule(this)
        SyncWorker.schedule(this)

        // Start playback loop
        startPlaybackLoop()
    }

    private fun startPlaybackLoop() {
        lifecycleScope.launch {
            while (true) {
                try {
                    val campaigns = repo.getCachedActiveCampaigns().first()
                    val activeCampaign = getActiveCampaign(campaigns)

                    if (activeCampaign != null) {
                        val playlists = repo.getCachedPlaylists().first()
                        val playlist = playlists.find { it.id == activeCampaign.playlistId }

                        if (playlist != null && playlist != currentPlaylist) {
                            currentPlaylist = playlist
                            currentItemIndex = 0
                        }
                    }

                    if (currentPlaylist != null) {
                        playNextItem()
                    } else {
                        // No content — show fallback
                        showFallback()
                        delay(5000)
                    }
                } catch (e: Exception) {
                    showFallback()
                    delay(5000)
                }
            }
        }
    }

    private suspend fun playNextItem() {
        val playlist = currentPlaylist ?: return
        val items = try {
            com.google.gson.JsonParser.parseString(playlist.items).asJsonArray
        } catch (e: Exception) {
            return
        }

        if (items.size() == 0) return

        if (currentItemIndex >= items.size()) {
            currentItemIndex = 0
        }

        val item = items[currentItemIndex].asJsonObject
        val mediaId = item.get("media_id")?.asString ?: return
        val duration = item.get("duration")?.asInt ?: 10

        val allMedia = repo.getCachedMedia().first()
        val media = allMedia.find { it.id == mediaId }

        if (media != null) {
            withContext(Dispatchers.Main) {
                when (media.type) {
                    "image", "gif" -> playImage(media)
                    "video" -> playVideo(media, duration)
                    else -> {
                        delay(duration * 1000L)
                    }
                }
            }
        } else {
            delay(duration * 1000L)
        }

        currentItemIndex++
    }

    private suspend fun playImage(media: CachedMedia) {
        imageView.visibility = android.view.View.VISIBLE
        videoView.visibility = android.view.View.GONE

        val path = media.localPath ?: media.fileUrl
        val uri = if (media.localPath != null) {
            Uri.parse(media.localPath)
        } else {
            Uri.parse(media.fileUrl)
        }

        try {
            val bitmap = withContext(Dispatchers.IO) {
                if (media.localPath != null) {
                    android.graphics.BitmapFactory.decodeFile(media.localPath)
                } else {
                    val url = java.net.URL(media.fileUrl)
                    android.graphics.BitmapFactory.decodeStream(url.openStream())
                }
            }
            imageView.setImageBitmap(bitmap)
        } catch (e: Exception) {
            imageView.setImageResource(android.R.drawable.ic_menu_gallery)
        }

        val duration = media.duration ?: 10
        delay(duration * 1000L)
    }

    private suspend fun playVideo(media: CachedMedia, fallbackDuration: Int) {
        imageView.visibility = android.view.View.GONE
        videoView.visibility = android.view.View.VISIBLE

        val uri = if (media.localPath != null) {
            Uri.parse(media.localPath)
        } else {
            Uri.parse(media.fileUrl)
        }

        videoView.setVideoURI(uri)

        return withContext(Dispatchers.IO) {
            val completed = java.util.concurrent.CountDownLatch(1)

            videoView.setOnPreparedListener { mp ->
                mp.isLooping = false
                videoView.start()
            }

            videoView.setOnCompletionListener {
                completed.countDown()
            }

            videoView.setOnErrorListener { _, _, _ ->
                completed.countDown()
                true
            }

            videoView.setVideoURI(uri)
            videoView.start()

            // Wait for video or timeout
            completed.await(fallbackDuration.toLong() + 5, java.util.concurrent.TimeUnit.SECONDS)
        }
    }

    private fun showFallback() {
        imageView.visibility = android.view.View.VISIBLE
        videoView.visibility = android.view.View.GONE
        imageView.setImageResource(android.R.drawable.ic_menu_gallery)
    }

    private suspend fun getActiveCampaign(campaigns: List<CachedCampaign>): CachedCampaign? {
        val now = java.time.LocalDateTime.now()
        val today = now.dayOfWeek.value % 7 // 0=Sun
        val currentTime = now.toLocalTime()

        return campaigns
            .filter { campaign ->
                // Check day of week
                val days = try {
                    com.google.gson.JsonParser.parseString(campaign.daysOfWeek).asJsonArray.map { it.asInt }
                } catch (e: Exception) {
                    listOf(1, 2, 3, 4, 5, 6, 0)
                }

                if (today !in days) return@filter false

                // Check date range
                if (campaign.startDate != null && now.toLocalDate().toString() < campaign.startDate) return@filter false
                if (campaign.endDate != null && now.toLocalDate().toString() > campaign.endDate) return@filter false

                // Check time range
                if (campaign.startTime != null) {
                    val start = java.time.LocalTime.parse(campaign.startTime)
                    if (currentTime.isBefore(start)) return@filter false
                }
                if (campaign.endTime != null) {
                    val end = java.time.LocalTime.parse(campaign.endTime)
                    if (currentTime.isAfter(end)) return@filter false
                }

                true
            }
            .minByOrNull { it.priority }
    }

    override fun onDestroy() {
        super.onDestroy()
        videoView.stopPlayback()
    }
}
