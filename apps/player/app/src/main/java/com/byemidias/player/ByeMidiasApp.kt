package com.byemidias.player

import android.app.Application
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.*

class ByeMidiasApp : Application() {

    val sessionStartTime by lazy { System.currentTimeMillis() }

    override fun onCreate() {
        super.onCreate()
        instance = this

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val sw = StringWriter()
            throwable.printStackTrace(PrintWriter(sw))
            val crashLog = """
                |=== CRASH ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())} ===
                |Thread: ${thread.name}
                |Exception: ${throwable.javaClass.name}
                |Message: ${throwable.message}
                |Stack:
                |$sw
            """.trimMargin()

            Log.e("CRASH", crashLog)

            try {
                val file = File(filesDir, "crash.log")
                file.writeText(crashLog)
            } catch (_: Exception) {}

            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    companion object {
        lateinit var instance: ByeMidiasApp
            private set
        var defaultHandler: Thread.UncaughtExceptionHandler? = null

        init {
            defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        }
    }
}
