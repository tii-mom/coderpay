package cn.coderpay.watcher.utils

import androidx.compose.runtime.mutableStateListOf
import android.os.Handler
import android.os.Looper
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object LogTracker {
    val logs = mutableStateListOf<String>()
    private val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    private val mainHandler = Handler(Looper.getMainLooper())

    fun log(message: String) {
        val time = dateFormat.format(Date())
        val formattedLog = "[$time] $message"
        val append = {
            // Capped list at 100 items for memory efficiency
            if (logs.size > 100) {
                logs.removeAt(0)
            }
            logs.add(formattedLog)
            println(formattedLog)
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            append()
        } else {
            mainHandler.post { append() }
        }
    }

    fun clear() {
        logs.clear()
    }
}
