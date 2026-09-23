package com.byemidias.player.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.byemidias.player.ui.player.PlayerActivity

class ScreenOnReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SCREEN_ON -> {
                Log.i(TAG, "Screen ON — launching PlayerActivity")
                launchPlayer(context)
            }
            Intent.ACTION_USER_PRESENT -> {
                Log.i(TAG, "User present — launching PlayerActivity")
                launchPlayer(context)
            }
            Intent.ACTION_BOOT_COMPLETED -> {
                Log.i(TAG, "Boot completed — launching PlayerActivity")
                launchPlayer(context)
            }
            "android.intent.action.QUICKBOOT_POWERON" -> {
                Log.i(TAG, "Quick boot ON — launching PlayerActivity")
                launchPlayer(context)
            }
        }
    }

    private fun launchPlayer(context: Context) {
        try {
            val launch = Intent(context, PlayerActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(launch)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch PlayerActivity: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "ScreenOnReceiver"
    }
}
