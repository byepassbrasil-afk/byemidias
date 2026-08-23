package com.byemidias.player

import android.app.Application

class ByeMidiasApp : Application() {
    val sessionStartTime by lazy { System.currentTimeMillis() }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: ByeMidiasApp
            private set
    }
}
