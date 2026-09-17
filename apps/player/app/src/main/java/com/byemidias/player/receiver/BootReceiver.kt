package com.byemidias.player.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.byemidias.player.ui.player.PlayerActivity

/**
 * Disparado quando o dispositivo/TV termina o boot ou acorda.
 * Inicia automaticamente o PlayerActivity para que o sistema sempre rode após ligar.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        val shouldStart = when (action) {
            Intent.ACTION_BOOT_COMPLETED -> true                       // boot normal
            Intent.ACTION_LOCKED_BOOT_COMPLETED -> true               // boot direto (TV/lock screen)
            "android.intent.action.QUICKBOOT_POWERON" -> true         // quick boot
            "android.intent.action.MEDIA_MOUNTED" -> false           // só monta storage
            else -> false
        }
        if (!shouldStart) return

        Log.i("BootReceiver", "$action received — launching PlayerActivity")

        // Pequeno delay pra garantir que o sistema terminou de inicializar
        // (algumas TVs ficam lentas no boot e o startActivity falha cedo demais)
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                val prefs = context.getSharedPreferences("byemidias", Context.MODE_PRIVATE)
                val hasSetup = prefs.contains("device_orientation")
                val targetClass = if (hasSetup) {
                    PlayerActivity::class.java
                } else {
                    // Sem setup → abre SetupActivity (que vai chamar PlayerActivity ao terminar)
                    try {
                        Class.forName("com.byemidias.player.ui.setup.SetupActivity")
                    } catch (_: Exception) {
                        null
                    } ?: PlayerActivity::class.java
                }

                val launch = Intent(context, targetClass).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    // Em Android 12+ precisa definir explicitamente
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                context.startActivity(launch)
                Log.i("BootReceiver", "PlayerActivity launched successfully")
            } catch (e: Exception) {
                Log.e("BootReceiver", "Failed to launch: ${e.message}", e)
            }
        }, 3000) // 3 segundos de margem pro boot estabilizar
    }
}
