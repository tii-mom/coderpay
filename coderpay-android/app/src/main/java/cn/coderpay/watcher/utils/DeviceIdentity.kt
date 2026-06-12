package cn.coderpay.watcher.utils

import android.content.Context
import android.os.Build
import android.provider.Settings
import java.security.MessageDigest

object DeviceIdentity {
    fun androidVersion(): String = Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString()

    fun appVersion(context: Context): String {
        return try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            info.versionName ?: ""
        } catch (_: Exception) {
            ""
        }
    }

    fun fingerprint(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        val raw = listOf(
            androidId,
            Build.MANUFACTURER ?: "",
            Build.MODEL ?: "",
            Build.DEVICE ?: ""
        ).joinToString(":")
        return sha256(raw)
    }

    private fun sha256(value: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
