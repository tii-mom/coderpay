package cn.coderpay.watcher.utils

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object SignatureHelper {
    fun calculateSignature(deviceCode: String, timestamp: Long, deviceSecret: String): String {
        if (deviceSecret.isEmpty()) return ""
        val data = "$deviceCode:$timestamp"
        return hmacSha256(data, deviceSecret)
    }

    fun calculateSignature(deviceCode: String, timestamp: Long, deviceSecret: String, payload: String): String {
        if (deviceSecret.isEmpty()) return ""
        val data = "$deviceCode:$timestamp:$payload"
        return hmacSha256(data, deviceSecret)
    }

    fun heartbeatPayload(
        deviceCode: String,
        wechatListener: String,
        alipayListener: String,
        notificationPermission: Boolean,
        batteryOptimization: String
    ): String {
        val permission = if (notificationPermission) "1" else "0"
        return listOf("heartbeat", deviceCode, wechatListener, alipayListener, permission, batteryOptimization).joinToString(":")
    }

    fun eventPayload(
        deviceCode: String,
        payType: String,
        amountCents: Long,
        receivedAt: String,
        notificationHash: String
    ): String {
        return listOf("event", deviceCode, payType, amountCents.toString(), receivedAt, notificationHash).joinToString(":")
    }

    private fun hmacSha256(data: String, key: String): String {
        return try {
            val sha256HMAC = Mac.getInstance("HmacSHA256")
            val secretKey = SecretKeySpec(key.toByteArray(Charsets.UTF_8), "HmacSHA256")
            sha256HMAC.init(secretKey)
            val bytes = sha256HMAC.doFinal(data.toByteArray(Charsets.UTF_8))
            bytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            ""
        }
    }
}
