package com.byemidias.player.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.ui.player.PlayerActivity
import com.byemidias.player.workers.HeartbeatWorker
import com.byemidias.player.workers.SyncWorker

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {

            val app = context.applicationContext as ByeMidiasApp

            // Start workers
            HeartbeatWorker.schedule(context)
            SyncWorker.schedule(context)

            // Launch player if activated
            if (app.deviceRepository.isActivated()) {
                val playerIntent = Intent(context, PlayerActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                context.startActivity(playerIntent)
            }
        }
    }
}
