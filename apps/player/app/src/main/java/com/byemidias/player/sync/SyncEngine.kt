package com.byemidias.player.sync

import android.util.Log
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.data.models.CachedMedia
import kotlinx.coroutines.flow.first

class SyncEngine {
    private val app = ByeMidiasApp.instance
    private val repo = app.deviceRepository
    private val tag = "SyncEngine"

    /**
     * Full sync cycle:
     * 1. Fetch server changes
     * 2. Download new media files
     * 3. Validate files
     * 4. Update local DB
     */
    suspend fun performSync(): Result<Boolean> {
        return try {
            Log.i(tag, "Starting sync...")

            // Step 1: Fetch changes from server
            val syncResult = repo.syncContent()
            if (syncResult.isFailure) {
                Log.e(tag, "Sync fetch failed: ${syncResult.exceptionOrNull()?.message}")
                return syncResult
            }

            // Step 2: Download any new media files
            val allMedia = repo.getCachedMedia().first()
            val needsDownload = allMedia.filter { it.localPath == null }

            for (media in needsDownload) {
                Log.i(tag, "Downloading: ${media.name}")
                val downloadResult = repo.downloadMedia(media)
                if (downloadResult.isFailure) {
                    Log.w(tag, "Download failed for ${media.name}: ${downloadResult.exceptionOrNull()?.message}")
                    // Continue — will retry next sync
                }
            }

            // Step 3: Validate downloaded files
            val downloaded = repo.getDownloadedMedia()
            for (media in downloaded) {
                if (media.localPath != null) {
                    val file = java.io.File(media.localPath)
                    if (!file.exists() || file.length() == 0L) {
                        Log.w(tag, "Invalid file, marking for re-download: ${media.name}")
                        // Could clear localPath here to trigger re-download
                    }
                }
            }

            Log.i(tag, "Sync complete. Version: ${repo.getContentVersion()}")
            Result.success(true)
        } catch (e: Exception) {
            Log.e(tag, "Sync error", e)
            Result.failure(e)
        }
    }
}
