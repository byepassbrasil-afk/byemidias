package com.byemidias.player.data.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.byemidias.player.data.models.CachedPlaylist
import kotlinx.coroutines.flow.Flow

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM cached_playlists")
    fun getAll(): Flow<List<CachedPlaylist>>

    @Query("SELECT * FROM cached_playlists WHERE id = :id")
    suspend fun getById(id: String): CachedPlaylist?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(playlist: CachedPlaylist)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(playlists: List<CachedPlaylist>)

    @Query("DELETE FROM cached_playlists WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM cached_playlists")
    suspend fun deleteAll()
}
