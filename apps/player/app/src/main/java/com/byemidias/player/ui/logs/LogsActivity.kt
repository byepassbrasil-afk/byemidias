package com.byemidias.player.ui.logs

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.byemidias.player.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.text.SimpleDateFormat
import java.util.*

class LogsActivity : ComponentActivity() {

    private val tag = "Logs"
    private val logEntries = mutableListOf<LogEntry>()
    private lateinit var adapter: LogAdapter
    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentFilter = "all"

    data class LogEntry(
        val timestamp: String,
        val level: String,
        val tag: String,
        val message: String
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_logs)

        val recyclerView = findViewById<RecyclerView>(R.id.logRecyclerView)
        val countText = findViewById<TextView>(R.id.logCountText)
        val backBtn = findViewById<Button>(R.id.backBtn)
        val clearBtn = findViewById<Button>(R.id.clearBtn)

        // Tab buttons
        val tabAll = findViewById<Button>(R.id.tabAll)
        val tabError = findViewById<Button>(R.id.tabError)
        val tabInfo = findViewById<Button>(R.id.tabInfo)
        val tabCrash = findViewById<Button>(R.id.tabCrash)
        val tabSync = findViewById<Button>(R.id.tabSync)

        adapter = LogAdapter(logEntries)
        recyclerView.layoutManager = LinearLayoutManager(this, LinearLayoutManager.VERTICAL, true)
        recyclerView.adapter = adapter

        backBtn.setOnClickListener { finish() }

        clearBtn.setOnClickListener {
            logEntries.clear()
            // Clear logcat
            try {
                Runtime.getRuntime().exec(arrayOf("logcat", "-c"))
            } catch (_: Exception) {}
            // Clear crash log
            try {
                File(filesDir, "crash.log").writeText("")
            } catch (_: Exception) {}
            updateAdapter()
            updateCountText()
        }

        fun selectTab(tab: String) {
            currentFilter = tab
            tabAll.setBackgroundColor(if (tab == "all") 0xFF3B82F6.toInt() else 0xFF374151.toInt())
            tabAll.setTextColor(if (tab == "all") 0xFFFFFFFF.toInt() else 0xFF9CA3AF.toInt())
            tabError.setBackgroundColor(if (tab == "error") 0xFFEF4444.toInt() else 0xFF374151.toInt())
            tabError.setTextColor(if (tab == "error") 0xFFFFFFFF.toInt() else 0xFF9CA3AF.toInt())
            tabInfo.setBackgroundColor(if (tab == "info") 0xFF10B981.toInt() else 0xFF374151.toInt())
            tabInfo.setTextColor(if (tab == "info") 0xFFFFFFFF.toInt() else 0xFF9CA3AF.toInt())
            tabCrash.setBackgroundColor(if (tab == "crash") 0xFFF59E0B.toInt() else 0xFF374151.toInt())
            tabCrash.setTextColor(if (tab == "crash") 0xFFFFFFFF.toInt() else 0xFF9CA3AF.toInt())
            tabSync.setBackgroundColor(if (tab == "sync") 0xFF8B5CF6.toInt() else 0xFF374151.toInt())
            tabSync.setTextColor(if (tab == "sync") 0xFFFFFFFF.toInt() else 0xFF9CA3AF.toInt())
            updateAdapter()
            updateCountText()
        }

        tabAll.setOnClickListener { selectTab("all") }
        tabError.setOnClickListener { selectTab("error") }
        tabInfo.setOnClickListener { selectTab("info") }
        tabCrash.setOnClickListener { selectTab("crash") }
        tabSync.setOnClickListener { selectTab("sync") }

        // Load initial logs
        loadLogs()
    }

    private fun loadLogs() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                // Read crash log
                val crashFile = File(filesDir, "crash.log")
                if (crashFile.exists()) {
                    val crashContent = crashFile.readText()
                    if (crashContent.isNotBlank()) {
                        crashContent.split("=== CRASH").filter { it.isNotBlank() }.forEach { crash ->
                            val lines = crash.trim().split("\n")
                            val timestamp = lines.getOrNull(0)?.replace("|", "")?.trim() ?: "?"
                            val msg = lines.drop(1).joinToString("\n").take(300)
                            withContext(Dispatchers.Main) {
                                logEntries.add(LogEntry(timestamp, "E", "CRASH", msg))
                            }
                        }
                    }
                }

                // Read player.log file (written by PlayerActivity FileLogger)
                val playerLogFile = File(filesDir, "player.log")
                if (playerLogFile.exists()) {
                    val lines = playerLogFile.readLines()
                    lines.takeLast(500).forEach { line ->
                        val entry = parseFileLogLine(line)
                        if (entry != null) {
                            synchronized(logEntries) {
                                logEntries.add(entry)
                            }
                        }
                    }
                }

                // Also try logcat as backup (ignore errors on Android 11+)
                try {
                    val process = Runtime.getRuntime().exec(arrayOf(
                        "logcat", "-d", "-t", "300"
                    ))
                    val reader = BufferedReader(InputStreamReader(process.inputStream))
                    var line: String?
                    val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
                    val parseFormat = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)

                    while (reader.readLine().also { line = it } != null) {
                        line?.let { l ->
                            val entry = parseLogcatLine(l, dateFormat, parseFormat)
                            if (entry != null) {
                                synchronized(logEntries) {
                                    logEntries.add(entry)
                                }
                            }
                        }
                    }
                    reader.close()
                } catch (_: Exception) {}

                // Keep only last 1000 entries
                synchronized(logEntries) {
                    val sorted = logEntries.sortedByDescending { it.timestamp }
                        .distinctBy { "${it.tag}:${it.message.take(50)}" }
                        .take(1000)
                        .sortedByDescending {
                            try {
                                SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).parse(it.timestamp)?.time ?: 0L
                            } catch (_: Exception) { 0L }
                        }
                    logEntries.clear()
                    logEntries.addAll(sorted)
                }

                withContext(Dispatchers.Main) {
                    updateAdapter()
                    updateCountText()
                }

                // Auto-refresh every 3s
                startAutoRefresh()

            } catch (e: Exception) {
                Log.e(tag, "Failed to load logs: ${e.message}")
                withContext(Dispatchers.Main) {
                    findViewById<TextView>(R.id.logCountText).text = "Erro ao carregar logs: ${e.message}"
                }
            }
        }
    }

    private fun parseLogcatLine(line: String, dateFormat: SimpleDateFormat, parseFormat: SimpleDateFormat): LogEntry? {
        try {
            // Format: MM-DD HH:mm:ss.SSS  Tag  Level  Message
            // Example: 01-15 12:30:45.123 Player I Message here
            val parts = line.trim().split("\\s+".toRegex())
            if (parts.size < 4) return null

            val datePart = parts[0] // "01-15"
            val timePart = parts[1] // "12:30:45.123"
            val fullTimeStr = "2026-${datePart} ${timePart}"

            val tag = parts.getOrNull(2) ?: return null
            val levelChar = parts.getOrNull(3) ?: return null
            val message = parts.drop(4).joinToString(" ").take(500)

            val level = when (levelChar) {
                "E" -> "E"
                "W" -> "W"
                "I" -> "I"
                "D" -> "D"
                else -> return null // Skip unknown levels
            }

            return LogEntry(fullTimeStr, level, tag, message)
        } catch (_: Exception) {
            return null
        }
    }

    /** Parse lines from player.log file.
     * Format: "2026-08-28 12:30:45.123 I Fetch: fetchMedia: URL=https://..."
     */
    private fun parseFileLogLine(line: String): LogEntry? {
        try {
            val trimmed = line.trim()
            if (trimmed.isEmpty()) return null
            // Pattern: "yyyy-MM-dd HH:mm:ss.SSS Level Tag: Message"
            val match = Regex("""^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+([EWI])\s+(\w+):\s*(.*)$""").find(trimmed)
            if (match != null) {
                val (timestamp, level, tag, message) = match.destructured
                return LogEntry(timestamp, level, tag, message.take(500))
            }
            return null
        } catch (_: Exception) {
            return null
        }
    }

    private fun startAutoRefresh() {
        mainHandler.postDelayed(object : Runnable {
            override fun run() {
                if (!isFinishing) {
                    refreshLogs()
                    mainHandler.postDelayed(this, 3000)
                }
            }
        }, 3000)
    }

    private fun refreshLogs() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val newEntries = mutableListOf<LogEntry>()

                // Read new entries from player.log
                try {
                    val playerLogFile = File(filesDir, "player.log")
                    if (playerLogFile.exists()) {
                        val lines = playerLogFile.readLines()
                        lines.takeLast(100).forEach { line ->
                            val entry = parseFileLogLine(line)
                            if (entry != null) {
                                val alreadyExists = synchronized(logEntries) {
                                    logEntries.any { it.tag == entry.tag && it.message == entry.message }
                                }
                                if (!alreadyExists) {
                                    newEntries.add(entry)
                                }
                            }
                        }
                    }
                } catch (_: Exception) {}

                // Also try logcat
                try {
                    val process = Runtime.getRuntime().exec(arrayOf("logcat", "-d", "-t", "50"))
                    val reader = BufferedReader(InputStreamReader(process.inputStream))
                    val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
                    val parseFormat = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)

                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        line?.let { l ->
                            val entry = parseLogcatLine(l, dateFormat, parseFormat)
                            if (entry != null) {
                                val alreadyExists = synchronized(logEntries) {
                                    logEntries.any { it.tag == entry.tag && it.message == entry.message }
                                }
                                if (!alreadyExists) {
                                    newEntries.add(entry)
                                }
                            }
                        }
                    }
                    reader.close()
                } catch (_: Exception) {}

                if (newEntries.isNotEmpty()) {
                    synchronized(logEntries) {
                        logEntries.addAll(newEntries)
                        val sorted = logEntries.sortedByDescending {
                            try {
                                SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).parse(it.timestamp)?.time ?: 0L
                            } catch (_: Exception) { 0L }
                        }.take(1000)
                        logEntries.clear()
                        logEntries.addAll(sorted)
                    }
                    withContext(Dispatchers.Main) {
                        updateAdapter()
                        updateCountText()
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun updateAdapter() {
        val filtered = when (currentFilter) {
            "error" -> logEntries.filter { it.level == "E" || it.level == "W" }
            "info" -> logEntries.filter { it.level == "I" }
            "crash" -> logEntries.filter { it.tag == "CRASH" }
            "sync" -> logEntries.filter {
                it.tag in listOf("Sync", "Fetch", "Heartbeat") ||
                it.message.contains("sync", ignoreCase = true) ||
                it.message.contains("fetch", ignoreCase = true)
            }
            else -> logEntries.toList()
        }
        adapter.update(filtered)
    }

    private fun updateCountText() {
        val total = logEntries.size
        val filtered = when (currentFilter) {
            "error" -> logEntries.count { it.level == "E" || it.level == "W" }
            "info" -> logEntries.count { it.level == "I" }
            "crash" -> logEntries.count { it.tag == "CRASH" }
            "sync" -> logEntries.count {
                it.tag in listOf("Sync", "Fetch", "Heartbeat") ||
                it.message.contains("sync", ignoreCase = true) ||
                it.message.contains("fetch", ignoreCase = true)
            }
            else -> total
        }
        val text = if (currentFilter == "all") "$total entradas" else "$filtered/$total entradas"
        findViewById<TextView>(R.id.logCountText).text = text
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacksAndMessages(null)
    }

    // ===================== ADAPTER =====================

    class LogAdapter(private val entries: List<LogEntry>) : RecyclerView.Adapter<LogAdapter.ViewHolder>() {

        private var currentEntries = entries.toList()

        fun update(newEntries: List<LogEntry>) {
            currentEntries = newEntries.toList()
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_log, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(currentEntries[position])
        }

        override fun getItemCount() = currentEntries.size

        class ViewHolder(itemView: android.view.View) : RecyclerView.ViewHolder(itemView) {
            private val levelView: TextView = itemView.findViewById(R.id.logLevel)
            private val tagView: TextView = itemView.findViewById(R.id.logTag)
            private val timeView: TextView = itemView.findViewById(R.id.logTime)
            private val msgView: TextView = itemView.findViewById(R.id.logMessage)

            fun bind(entry: LogEntry) {
                timeView.text = entry.timestamp.takeLast(19)
                tagView.text = entry.tag
                msgView.text = entry.message

                val (bgColor, textColor) = when (entry.level) {
                    "E" -> 0xFF7F1D1D.toInt() to 0xFFFCA5A5.toInt()
                    "W" -> 0xFF78350F.toInt() to 0xFFFCD34D.toInt()
                    "I" -> 0xFF064E3B.toInt() to 0xFF6EE7B7.toInt()
                    else -> 0xFF111827.toInt() to 0xFFE5E7EB.toInt()
                }
                levelView.text = entry.level
                levelView.setBackgroundColor(bgColor)
                levelView.setTextColor(textColor)

                tagView.setTextColor(when (entry.tag) {
                    "CRASH" -> 0xFFF59E0B.toInt()
                    "Player" -> 0xFF60A5FA.toInt()
                    "Config" -> 0xFFA78BFA.toInt()
                    "PlayerService" -> 0xFF34D399.toInt()
                    else -> 0xFF9CA3AF.toInt()
                })
            }
        }
    }
}
