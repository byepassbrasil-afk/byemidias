package com.byemidias.player.data.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.byemidias.player.data.models.CachedMedia
import kotlinx.coroutines.flow.Flow

@Dao
interface MediaDao {
    @Query("SELECT * FROM cached_media")
    fun getAll(): Flow<List<CachedMedia>>

    @Query("SELECT * FROM cached_media WHERE id = :id")
    suspend fun getById(id: String): CachedMedia?

    @Query("SELECT * FROM cached_media WHERE localPath IS NOT NULL")
    suspend fun getDownloaded(): List<CachedMedia>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(media: CachedMedia)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(mediaList: List<CachedMedia>)

    @Query("UPDATE cached_media SET localPath = :localPath, downloadedAt = :downloadedAt WHERE id = :id")
    suspend fun updateLocalPath(id: String, localPath: String, downloadedAt: Long)

    @Query("DELETE FROM cached_media WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM cached_media")
    suspend fun deleteAll()
}
