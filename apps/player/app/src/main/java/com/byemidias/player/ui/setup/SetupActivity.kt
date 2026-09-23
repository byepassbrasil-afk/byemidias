package com.byemidias.player.ui.setup

import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.activity.ComponentActivity
import com.byemidias.player.R
import com.byemidias.player.ui.player.PlayerActivity
import com.byemidias.player.ui.config.ConfigActivity

class SetupActivity : ComponentActivity() {

    private val tag = "Setup"
    private lateinit var prefs: SharedPreferences
    private var setupStatus: TextView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("byemidias", MODE_PRIVATE)

        // If setup is already done, skip to PlayerActivity
        if (prefs.contains("device_orientation")) {
            val intent = Intent(this, PlayerActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            startActivity(intent)
            finish()
            return
        }

        setContentView(R.layout.activity_setup)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setupStatus = findViewById(R.id.setupStatusText)
        val btnHorizontal = findViewById<Button>(R.id.btnLayoutHorizontal)
        val btnVertical = findViewById<Button>(R.id.btnLayoutVertical)
        val btnOpenConfig = findViewById<Button>(R.id.btnOpenConfig)

        btnHorizontal.setOnClickListener {
            applyLayoutChoice("landscape", 0, "Horizontal 16:9")
        }
        btnVertical.setOnClickListener {
            applyLayoutChoice("portrait", 90, "Vertical 9:16")
        }
        btnOpenConfig.setOnClickListener {
            val intent = Intent(this, ConfigActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        }
    }

    /**
     * Apply the layout choice and proceed to the player.
     *  - "landscape" + rotation=0 → keep activity as-is (TV horizontal)
     *  - "portrait" + rotation=90 → rotate the content 90° (TV vertical / totem)
     */
    private fun applyLayoutChoice(orientation: String, rotation: Int, label: String) {
        Log.i(tag, "User chose: $label (orientation=$orientation, rotation=$rotation)")

        // Save to SharedPreferences
        prefs.edit()
            .putString("device_orientation", orientation)
            .putInt("screen_rotation", rotation)
            .apply()

        // Try to set activity orientation (works on standard Android, ignored on Google TV)
        try {
            when (rotation) {
                90 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                270 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                180 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                0 -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                else -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            }
        } catch (_: Exception) {}

        setupStatus?.text = "✓ $label configurado! Abrindo player..."
        setupStatus?.visibility = View.VISIBLE

        // Open the player (which will apply the visual rotation)
        val intent = Intent(this, PlayerActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(intent)
        finish()
    }
}
