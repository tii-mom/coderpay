package cn.coderpay.watcher.utils

import androidx.compose.runtime.mutableStateListOf
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object LogTracker {
    val logs = mutableStateListOf<String>()
    private val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    fun log(message: String) {
        val time = dateFormat.format(Date())
        val formattedLog = "[$time] $message"
        // Capped list at 100 items for memory efficiency
        if (logs.size > 100) {
            logs.removeAt(0)
        }
        logs.add(formattedLog)
        println(formattedLog)
    }

    fun clear() {
        logs.clear()
    }
}
