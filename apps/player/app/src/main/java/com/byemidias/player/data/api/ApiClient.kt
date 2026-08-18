package com.byemidias.player.data.api

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiClient(
    private val baseUrl: String,
    private val supabaseUrl: String,
    private val supabaseKey: String
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMediaType = "application/json".toMediaType()

    /**
     * Activate device with activation code
     */
    suspend fun activateDevice(
        deviceUuid: String,
        activationCode: String,
        model: String?,
        manufacturer: String?,
        osVersion: String?,
        playerVersion: String?,
        resolution: String?
    ): Result<JsonObject> = withContext(Dispatchers.IO) {
        try {
            val body = JsonObject().apply {
                addProperty("device_uuid", deviceUuid)
                addProperty("activation_code", activationCode)
                addProperty("model", model)
                addProperty("manufacturer", manufacturer)
                addProperty("os_version", osVersion)
                addProperty("player_version", playerVersion)
                addProperty("resolution", resolution)
            }

            val request = Request.Builder()
                .url("$baseUrl/device/activate")
                .post(body.toString().toRequestBody(jsonMediaType))
                .addHeader("Content-Type", "application/json")
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: "{}"
            Result.success(JsonParser.parseString(responseBody).asJsonObject)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Send heartbeat
     */
    suspend fun sendHeartbeat(
        deviceId: String,
        status: String,
        playerVersion: String?,
        storageAvailable: Long?,
        currentContent: String?,
        currentPlaylist: String?,
        errorMessage: String?
    ): Result<JsonObject> = withContext(Dispatchers.IO) {
        try {
            val body = JsonObject().apply {
                addProperty("device_id", deviceId)
                addProperty("status", status)
                addProperty("player_version", playerVersion)
                addProperty("storage_available", storageAvailable)
                addProperty("current_content", currentContent)
                addProperty("current_playlist", currentPlaylist)
                addProperty("error_message", errorMessage)
            }

            val request = Request.Builder()
                .url("$baseUrl/device/heartbeat")
                .post(body.toString().toRequestBody(jsonMediaType))
                .addHeader("Content-Type", "application/json")
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: "{}"
            Result.success(JsonParser.parseString(responseBody).asJsonObject)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get device config / sync data
     */
    suspend fun getDeviceSync(
        deviceId: String,
        contentVersion: Int
    ): Result<JsonObject> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/device/sync?device_id=$deviceId&content_version=$contentVersion")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: "{}"
            Result.success(JsonParser.parseString(responseBody).asJsonObject)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get active campaigns for device
     */
    suspend fun getActiveCampaigns(deviceId: String): Result<JsonObject> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/campaigns/active?device_id=$deviceId")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: "{}"
            Result.success(JsonParser.parseString(responseBody).asJsonObject)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get playlist by ID
     */
    suspend fun getPlaylist(playlistId: String): Result<JsonObject> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/playlists/$playlistId")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: "{}"
            Result.success(JsonParser.parseString(responseBody).asJsonObject)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get player version info
     */
    suspend fun getPlayerVersion(): Result<JsonObject> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/player/version")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: "{}"
            Result.success(JsonParser.parseString(responseBody).asJsonObject)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Log playback event
     */
    suspend fun logPlayback(
        deviceId: String,
        mediaId: String?,
        campaignId: String?
    ): Result<JsonObject> = withContext(Dispatchers.IO) {
        try {
            val body = JsonObject().apply {
                addProperty("device_id", deviceId)
                addProperty("media_id", mediaId)
                addProperty("campaign_id", campaignId)
            }

            val request = Request.Builder()
                .url("$baseUrl/playback/log")
                .post(body.toString().toRequestBody(jsonMediaType))
                .addHeader("Content-Type", "application/json")
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: "{}"
            Result.success(JsonParser.parseString(responseBody).asJsonObject)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
