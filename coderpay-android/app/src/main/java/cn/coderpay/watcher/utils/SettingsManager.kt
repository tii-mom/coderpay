package cn.coderpay.watcher.utils

import android.content.Context
import android.os.Build

class SettingsManager(context: Context) {
    private val prefs = context.getSharedPreferences("coderpay_watcher_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "https://3api.shop") ?: "https://3api.shop"
        set(value) = prefs.edit().putString("server_url", value).apply()

    var deviceCode: String
        get() = prefs.getString("device_code", "") ?: ""
        set(value) = prefs.edit().putString("device_code", value).apply()

    var deviceName: String
        get() = prefs.getString("device_name", Build.MODEL) ?: Build.MODEL
        set(value) = prefs.edit().putString("device_name", value).apply()

    var pairingCode: String
        get() = prefs.getString("pairing_code", "") ?: ""
        set(value) = prefs.edit().putString("pairing_code", value).apply()

    var isBound: Boolean
        get() = prefs.getBoolean("is_bound", false)
        set(value) = prefs.edit().putBoolean("is_bound", value).apply()

    fun clearBinding() {
        prefs.edit()
            .putString("device_code", "")
            .putBoolean("is_bound", false)
            .apply()
    }
}
