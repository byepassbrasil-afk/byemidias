package com.byemidias.player.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import com.byemidias.player.R
import com.byemidias.player.ui.player.PlayerActivity

class PlayerService : Service() {

    private val tag = "PlayerService"
    private val channelId = "byemidias_player"
    private val notificationId = 1001
    private val handler = Handler(Looper.getMainLooper())
    private var restartCheckRunnable: Runnable? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startAutoRestartCheck()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return try {
            val notification = buildNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(notificationId, notification)
            }
            Log.i(tag, "Foreground service started (API ${Build.VERSION.SDK_INT})")
            START_STICKY
        } catch (e: Exception) {
            Log.e(tag, "Failed to start foreground: ${e.message}", e)
            try {
                val notification = buildNotification()
                startForeground(notificationId, notification)
                START_STICKY
            } catch (e2: Exception) {
                Log.e(tag, "Fallback foreground also failed: ${e2.message}", e2)
                START_NOT_STICKY
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Auto-restart: checks every 5 seconds if PlayerActivity is running.
     * If not running (user closed it, crash, etc.), restarts it automatically.
     * This ensures the player is always accessible.
     */
    private fun startAutoRestartCheck() {
        restartCheckRunnable = object : Runnable {
            override fun run() {
                try {
                    checkAndRestartPlayer()
                } catch (_: Exception) {}
                handler.postDelayed(this, 5000)
            }
        }
        handler.postDelayed(restartCheckRunnable!!, 5000)
    }

    private fun checkAndRestartPlayer() {
        try {
            val activityManager = getSystemService(ACTIVITY_SERVICE) as android.app.ActivityManager
            val runningTasks = activityManager.getRunningTasks(10)
            val isPlayerRunning = runningTasks.any { task ->
                task.topActivity?.className?.contains("PlayerActivity") == true
            }

            if (!isPlayerRunning) {
                Log.i(tag, "PlayerActivity not running — restarting...")
                val restartIntent = Intent(this, PlayerActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                startActivity(restartIntent)
                Log.i(tag, "PlayerActivity restart triggered")
            }
        } catch (e: Exception) {
            Log.e(tag, "Auto-restart check failed: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "ByeMidias Player",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantém o player ativo em segundo plano"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, PlayerActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val icon = try {
            R.drawable.ic_notification
        } catch (_: Exception) {
            android.R.drawable.ic_media_play
        }

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
                .setContentTitle("ByeMidias Player")
                .setContentText("Reproduzindo mídia — toque para abrir")
                .setSmallIcon(icon)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("ByeMidias Player")
                .setContentText("Reproduzindo mídia — toque para abrir")
                .setSmallIcon(icon)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        restartCheckRunnable?.let { handler.removeCallbacks(it) }
        handler.removeCallbacksAndMessages(null)
        Log.i(tag, "Foreground service destroyed")
    }
}
