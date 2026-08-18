package com.byemidias.player

import android.app.Application
import com.byemidias.player.data.database.AppDatabase
import com.byemidias.player.data.repository.DeviceRepository

class ByeMidiasApp : Application() {

    val database: AppDatabase by lazy { AppDatabase.getInstance(this) }
    val deviceRepository: DeviceRepository by lazy { DeviceRepository(this, database) }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: ByeMidiasApp
            private set
    }
}
