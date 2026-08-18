package com.byemidias.player.data.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.byemidias.player.data.models.CachedCampaign
import kotlinx.coroutines.flow.Flow

@Dao
interface CampaignDao {
    @Query("SELECT * FROM cached_campaigns WHERE status = 'active'")
    fun getActive(): Flow<List<CachedCampaign>>

    @Query("SELECT * FROM cached_campaigns WHERE id = :id")
    suspend fun getById(id: String): CachedCampaign?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(campaign: CachedCampaign)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(campaigns: List<CachedCampaign>)

    @Query("DELETE FROM cached_campaigns WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM cached_campaigns")
    suspend fun deleteAll()
}
