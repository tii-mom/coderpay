package cn.coderpay.watcher.worker

import android.content.Context
import cn.coderpay.watcher.api.EventRequest
import cn.coderpay.watcher.api.RetrofitClient
import cn.coderpay.watcher.data.AppDatabase
import cn.coderpay.watcher.utils.LogTracker
import cn.coderpay.watcher.utils.SettingsManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object EventSyncer {
    suspend fun syncPending(context: Context): Boolean {
        val appContext = context.applicationContext
        val settings = SettingsManager(appContext)

        if (!settings.isBound || settings.deviceCode.isEmpty()) {
            LogTracker.log("同步跳过：设备尚未绑定，等待云端授权。")
            return true
        }

        val db = AppDatabase.getDatabase(appContext)
        val pendingEvents = db.localEventDao().getPendingEvents()

        if (pendingEvents.isEmpty()) {
            LogTracker.log("同步检查：暂无待上传到账事件。")
            return true
        }

        LogTracker.log("离线事件同步：检测到 ${pendingEvents.size} 个未同步的订单到账事件，正在开始上传...")
        val apiService = RetrofitClient.getService(appContext)
        var hasFailed = false

        for (event in pendingEvents) {
            try {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val isoDate = sdf.format(Date(event.receivedAt))

                val timestamp = System.currentTimeMillis()
                val secret = settings.deviceSecret
                val sign = if (secret.isNotEmpty()) {
                    cn.coderpay.watcher.utils.SignatureHelper.calculateSignature(settings.deviceCode, timestamp, secret)
                } else null

                val request = EventRequest(
                    deviceCode = settings.deviceCode,
                    payType = event.payType,
                    amount = event.amount,
                    receivedAt = isoDate,
                    notificationHash = event.notificationHash,
                    rawNotification = event.rawText,
                    timestamp = timestamp,
                    sign = sign
                )

                val response = apiService.uploadEvent(request)
                if (response.isSuccessful && response.body()?.status == "success") {
                    val result = response.body()!!
                    db.localEventDao().markEventAsUploaded(event.notificationHash)
                    LogTracker.log("同步成功：事件 ${event.amount.toFixed(2)} 元已同步核销。匹配状态: ${result.matchStatus}")
                } else {
                    hasFailed = true
                    LogTracker.log("同步失败：接口响应错误 - HTTP ${response.code()} ${response.errorBody()?.string() ?: "未知错误"}")
                }
            } catch (e: Exception) {
                hasFailed = true
                LogTracker.log("同步异常：上传 ${event.amount.toFixed(2)} 元订单到账出错 - ${e.message}")
            }
        }

        return !hasFailed
    }

    private fun Double.toFixed(digits: Int): String {
        return String.format(Locale.US, "%.${digits}f", this)
    }
}
