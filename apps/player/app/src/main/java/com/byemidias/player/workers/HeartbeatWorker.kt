package com.byemidias.player.workers

import android.content.Context
import android.util.Log
import androidx.work.*
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.sync.SyncEngine
import java.util.concurrent.TimeUnit

class HeartbeatWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val tag = "HeartbeatWorker"

    override suspend fun doWork(): Result {
        val app = applicationContext as ByeMidiasApp
        val repo = app.deviceRepository

        if (!repo.isActivated()) {
            Log.w(tag, "Device not activated, skipping heartbeat")
            return Result.success()
        }

        return try {
            val result = repo.sendHeartbeat(status = "online")
            if (result.isSuccess) {
                Log.i(tag, "Heartbeat sent successfully")
                Result.success()
            } else {
                Log.w(tag, "Heartbeat failed: ${result.exceptionOrNull()?.message}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(tag, "Heartbeat error", e)
            Result.retry()
        }
    }

    companion object {
        private const val WORK_NAME = "heartbeat_periodic"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(
                30, TimeUnit.SECONDS,
                10, TimeUnit.SECONDS
            )
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
