package cn.coderpay.watcher.service

import android.app.Notification
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import cn.coderpay.watcher.data.AppDatabase
import cn.coderpay.watcher.data.LocalEvent
import cn.coderpay.watcher.utils.LogTracker
import cn.coderpay.watcher.utils.SettingsManager
import cn.coderpay.watcher.worker.EventSyncer
import cn.coderpay.watcher.worker.WorkerHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.security.MessageDigest

class NotificationService : NotificationListenerService() {

    companion object {
        /** True when the system has actually bound and connected this listener. */
        @Volatile
        var isListenerConnected: Boolean = false
            private set
    }

    private lateinit var settings: SettingsManager
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    override fun onCreate() {
        super.onCreate()
        settings = SettingsManager(applicationContext)
        LogTracker.log("监听服务已实例化，等待系统绑定通知监听...")
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        isListenerConnected = true
        LogTracker.log("✅ 通知监听服务已被系统成功绑定，可以正常接收通知。")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        isListenerConnected = false
        LogTracker.log("⚠️ 通知监听服务已被系统断开！请检查通知使用权设置，尝试关闭后重新打开。")
        // Request rebind from the system
        requestRebind(android.content.ComponentName(applicationContext, NotificationService::class.java))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        LogTracker.log("监听服务后台状态心跳唤醒。")
        return super.onStartCommand(intent, flags, startId)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        val extras = sbn.notification.extras
        val title = extras.getString(Notification.EXTRA_TITLE, "")
        val text = extras.getCharSequence(Notification.EXTRA_TEXT, "").toString()

        val isWeChat = packageName == "com.tencent.mm"
        val isAlipay = packageName == "com.eg.android.AlipayGphone"

        if (!isWeChat && !isAlipay) return

        val payType = if (isWeChat) "wechat" else "alipay"
        
        // Parse payment confirmation keywords
        if (isWeChatConfirm(title, text, isWeChat) || isAlipayConfirm(title, text, isAlipay)) {
            val amount = NotificationParser.extractAmount("$title $text")
            if (amount != null && amount > 0) {
                processPaymentArrival(payType, amount, text, sbn.postTime)
            } else {
                LogTracker.log("通知识别：${payType} 通知关键词已匹配，但金额解析失败。标题: ${title.take(24)} 内容: ${text.take(48)}")
            }
        } else {
            LogTracker.log("通知忽略：收到 ${payType} 通知，但未匹配到账关键词。标题: ${title.take(24)} 内容: ${text.take(48)}")
        }
    }

    private fun isWeChatConfirm(title: String, text: String, isWeChat: Boolean): Boolean {
        if (!isWeChat) return false
        return NotificationParser.isWeChatConfirm(title, text, settings.wechatRegex)
    }

    private fun isAlipayConfirm(title: String, text: String, isAlipay: Boolean): Boolean {
        if (!isAlipay) return false
        return NotificationParser.isAlipayConfirm(title, text, settings.alipayRegex)
    }

    private fun processPaymentArrival(payType: String, amount: Double, text: String, postTime: Long) {
        if (!settings.isBound) {
            LogTracker.log("拦截到 ${payType} 到账 ¥${amount}元，但由于当前客户端未绑定设备，已忽略上传。")
            return
        }

        val rawText = "${payType}_${amount}_${text}_${postTime}"
        val notificationHash = md5(rawText)

        // Launch in background
        val context = applicationContext
        val db = AppDatabase.getDatabase(context)

        serviceScope.launch {
            try {
                val exists = db.localEventDao().exists(notificationHash)
                if (exists) {
                    LogTracker.log("重置去重：检测到重复上报事件 ${notificationHash.take(8)}，自动忽略。")
                    return@launch
                }

                val event = LocalEvent(
                    notificationHash = notificationHash,
                    payType = payType,
                    amount = amount,
                    receivedAt = postTime,
                    rawText = text,
                    isUploaded = false
                )

                db.localEventDao().insertEvent(event)
                LogTracker.log("通知拦截：成功匹配到账通知！类型: ${payType}, 金额: ¥${amount}元，去重 ID: ${notificationHash.take(8)}")
                
                EventSyncer.syncPending(context)
                WorkerHelper.triggerSync(context)
            } catch (e: Exception) {
                LogTracker.log("数据存储出错: ${e.message}")
            }
        }
    }

    private fun md5(str: String): String {
        val digest = MessageDigest.getInstance("MD5")
        val bytes = digest.digest(str.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Noop
    }

    override fun onDestroy() {
        isListenerConnected = false
        LogTracker.log("通知监听服务已销毁，连接状态已置为未绑定。")
        serviceScope.cancel()
        super.onDestroy()
    }
}
