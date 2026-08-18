package com.byemidias.player.workers

import android.content.Context
import android.util.Log
import androidx.work.*
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.sync.SyncEngine
import java.util.concurrent.TimeUnit

class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val tag = "SyncWorker"

    override suspend fun doWork(): Result {
        val app = applicationContext as ByeMidiasApp
        val repo = app.deviceRepository

        if (!repo.isActivated()) {
            Log.w(tag, "Device not activated, skipping sync")
            return Result.success()
        }

        return try {
            val syncEngine = SyncEngine()
            val result = syncEngine.performSync()
            if (result.isSuccess) {
                Log.i(tag, "Sync completed successfully")
                Result.success()
            } else {
                Log.w(tag, "Sync failed: ${result.exceptionOrNull()?.message}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(tag, "Sync error", e)
            Result.retry()
        }
    }

    companion object {
        private const val WORK_NAME = "sync_periodic"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(
                15, TimeUnit.MINUTES,
                5, TimeUnit.MINUTES
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

        fun runOnce(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>().build()
            WorkManager.getInstance(context).enqueue(request)
        }
    }
}
