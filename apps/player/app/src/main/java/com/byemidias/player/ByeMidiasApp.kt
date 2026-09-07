package com.byemidias.player

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.byemidias.player.ui.player.PlayerActivity
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.*

class ByeMidiasApp : Application() {

    val sessionStartTime by lazy { System.currentTimeMillis() }

    /** Set to true when user presses "Sair" in ConfigActivity — prevents kiosk restart. */
    @Volatile
    var kioskExitRequested = false

    private var activityCount = 0

    override fun onCreate() {
        super.onCreate()
        instance = this

        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) { activityCount++ }
            override fun onActivityDestroyed(activity: Activity) {
                activityCount--
                if (activityCount <= 0 && !kioskExitRequested) {
                    activityCount = 0
                    Log.i("ByeMidiasApp", "Last activity destroyed — restarting PlayerActivity (kiosk)")
                    try {
                        val launch = Intent(this@ByeMidiasApp, PlayerActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        }
                        startActivity(launch)
                    } catch (e: Exception) {
                        Log.e("ByeMidiasApp", "Kiosk restart failed: ${e.message}")
                    }
                }
            }
        })

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
