package com.byemidias.player.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.byemidias.player.data.models.CachedCampaign
import com.byemidias.player.data.models.CachedMedia
import com.byemidias.player.data.models.CachedPlaylist
import com.byemidias.player.data.models.DeviceConfig

@Database(
    entities = [
        CachedPlaylist::class,
        CachedMedia::class,
        CachedCampaign::class,
        DeviceConfig::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun playlistDao(): PlaylistDao
    abstract fun mediaDao(): MediaDao
    abstract fun campaignDao(): CampaignDao
    abstract fun configDao(): ConfigDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "byemidias_player.db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
