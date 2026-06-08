package cn.coderpay.watcher.utils

import android.content.Context
import android.os.Build

class SettingsManager(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(
        "coderpay_watcher_prefs",
        Context.MODE_PRIVATE
    )

    var serverUrl: String
        get() = prefs.getString("server_url", "https://3api.shop") ?: "https://3api.shop"
        set(value) = prefs.edit().putString("server_url", value).apply()

    var deviceCode: String
        get() = prefs.getString("device_code", "") ?: ""
        set(value) = prefs.edit().putString("device_code", value).apply()

    var deviceSecret: String
        get() = prefs.getString("device_secret", "") ?: ""
        set(value) = prefs.edit().putString("device_secret", value).apply()

    var wechatRegex: String
        get() = prefs.getString("wechat_regex", "微信支付收款|微信收款|收到付款|微信支付.*元") ?: "微信支付收款|微信收款|收到付款|微信支付.*元"
        set(value) = prefs.edit().putString("wechat_regex", value).apply()

    var alipayRegex: String
        get() = prefs.getString("alipay_regex", "支付宝成功收款|收钱码收款|成功往账户转入|你已成功收款|支付宝.*元.*(收款|到账)") ?: "支付宝成功收款|收钱码收款|成功往账户转入|你已成功收款|支付宝.*元.*(收款|到账)"
        set(value) = prefs.edit().putString("alipay_regex", value).apply()

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
            .putString("device_secret", "")
            .putBoolean("is_bound", false)
            .apply()
    }
}
