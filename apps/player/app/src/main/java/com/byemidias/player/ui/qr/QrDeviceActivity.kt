package com.byemidias.player.ui.qr

import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.ComponentActivity
import com.byemidias.player.R
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

class QrDeviceActivity : ComponentActivity() {

    private val tag = "QrDevice"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            setContentView(R.layout.activity_qr_device)
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

            val prefs = getSharedPreferences("byemidias", MODE_PRIVATE)
            val deviceId = prefs.getString("device_id", "") ?: ""

            val qrImage = findViewById<ImageView>(R.id.qrImageView)
            val deviceIdText = findViewById<TextView>(R.id.qrDeviceIdText)
            val backBtn = findViewById<Button>(R.id.qrBackBtn)

            deviceIdText.text = deviceId

            if (deviceId.isEmpty()) {
                deviceIdText.text = "(dispositivo ainda não ativado)"
                backBtn.text = "VOLTAR"
                backBtn.setOnClickListener { finish() }
                return
            }

            // Generate QR code
            try {
                val qrBitmap = generateQrBitmap(deviceId, 600)
                qrImage.setImageBitmap(qrBitmap)
            } catch (e: Exception) {
                Log.e(tag, "QR generate error: ${e.message}", e)
                deviceIdText.text = "Erro ao gerar QR: ${e.message}"
            }

            backBtn.setOnClickListener { finish() }
        } catch (e: Exception) {
            Log.e(tag, "onCreate crash: ${e.message}", e)
        }
    }

    private fun generateQrBitmap(content: String, size: Int): Bitmap {
        val hints = mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            EncodeHintType.MARGIN to 2,
            EncodeHintType.CHARACTER_SET to "UTF-8",
        )
        val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
        val width = matrix.width
        val height = matrix.height
        val pixels = IntArray(width * height)
        for (y in 0 until height) {
            val offset = y * width
            for (x in 0 until width) {
                pixels[offset + x] = if (matrix.get(x, y)) Color.BLACK else Color.WHITE
            }
        }
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
        return bitmap
    }
}
