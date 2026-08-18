package com.byemidias.player.data.models

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_playlists")
data class CachedPlaylist(
    @PrimaryKey val id: String,
    val name: String,
    val description: String?,
    val items: String, // JSON array of playlist items
    val contentVersion: Int,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_media")
data class CachedMedia(
    @PrimaryKey val id: String,
    val name: String,
    val type: String,
    val fileUrl: String,
    val localPath: String?,
    val duration: Int?,
    val fileSize: Long?,
    val width: Int?,
    val height: Int?,
    val contentVersion: Int,
    val downloadedAt: Long? = null,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_campaigns")
data class CachedCampaign(
    @PrimaryKey val id: String,
    val name: String,
    val playlistId: String,
    val status: String,
    val startDate: String?,
    val endDate: String?,
    val startTime: String?,
    val endTime: String?,
    val daysOfWeek: String, // JSON array
    val priority: Int,
    val contentVersion: Int,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "device_config")
data class DeviceConfig(
    @PrimaryKey val key: String,
    val value: String,
    val updatedAt: Long = System.currentTimeMillis()
)
