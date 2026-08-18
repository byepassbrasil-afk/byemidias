package com.byemidias.player.data.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.byemidias.player.data.models.DeviceConfig

@Dao
interface ConfigDao {
    @Query("SELECT value FROM device_config WHERE `key` = :key")
    suspend fun getValue(key: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun set(config: DeviceConfig)

    @Query("SELECT * FROM device_config")
    suspend fun getAll(): List<DeviceConfig>

    @Query("DELETE FROM device_config WHERE `key` = :key")
    suspend fun delete(key: String)

    @Query("DELETE FROM device_config")
    suspend fun deleteAll()
}
