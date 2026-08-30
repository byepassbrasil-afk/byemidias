package com.byemidias.player.ui.qr

import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.byemidias.player.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.net.HttpURLConnection
import java.net.URL

class QrDeviceActivity : ComponentActivity() {

    private val tag = "QrDevice"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            setContentView(R.layout.activity_qr_device)
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

            val prefs = getSharedPreferences("byemidias", MODE_PRIVATE)
            val deviceId = prefs.getString("device_id", "") ?: ""
            val apiUrl = prefs.getString("api_base_url", null)
                ?: com.byemidias.player.BuildConfig.API_BASE_URL

            val qrImage = findViewById<ImageView>(R.id.qrImageView)
            val deviceIdText = findViewById<TextView>(R.id.qrDeviceIdText)
            val backBtn = findViewById<Button>(R.id.qrBackBtn)

            deviceIdText.text = deviceId.ifEmpty { "(sem device_id — ative primeiro)" }

            backBtn.setOnClickListener { finish() }

            if (deviceId.isEmpty()) return

            // Fetch QR code PNG from server (no ZXing/QR library needed on device)
            val finalUrl = apiUrl
            val finalDeviceId = deviceId
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val conn = URL("$finalUrl/api/device/$finalDeviceId/qr").openConnection() as HttpURLConnection
                    conn.connectTimeout = 15000
                    conn.readTimeout = 15000
                    val code = conn.responseCode
                    if (code in 200..299) {
                        val bmp = BufferedInputStream(conn.inputStream).use { BitmapFactory.decodeStream(it) }
                        conn.disconnect()
                        withContext(Dispatchers.Main) {
                            if (bmp != null) qrImage.setImageBitmap(bmp)
                            else { deviceIdText.text = "Erro ao decodificar QR"; Log.e(tag, "BitmapFactory returned null") }
                        }
                    } else {
                        conn.disconnect()
                        withContext(Dispatchers.Main) {
                            deviceIdText.text = "Erro HTTP $code ao gerar QR"
                        }
                    }
                } catch (e: Exception) {
                    Log.e(tag, "QR fetch error: ${e.message}", e)
                    withContext(Dispatchers.Main) {
                        deviceIdText.text = "Erro ao carregar QR: ${e.message}"
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "onCreate crash: ${e.message}", e)
        }
    }
}
