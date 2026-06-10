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
import java.util.regex.Pattern

class NotificationService : NotificationListenerService() {

    private lateinit var settings: SettingsManager
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    // Regex pattern matching money values like 10, 10.0, 10.00, ¥10.00, ￥10.00
    private val amountPattern = Pattern.compile("[¥￥]?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*(?:元)?")
    private val semanticAmountPatterns = listOf(
        Pattern.compile("(?:收款|到账|转入|付款)[^\\d¥￥]{0,12}[¥￥]?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*(?:元)?"),
        Pattern.compile("[¥￥]?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*(?:元)?[^，。；\\s]{0,12}(?:收款|到账|转入|付款)"),
        Pattern.compile("(?:收款|到账|转入|付款)[^\\d]{0,12}(\\d+(?:\\.\\d{1,2})?)\\s*元"),
        Pattern.compile("(\\d+(?:\\.\\d{1,2})?)\\s*元[^，。；\\s]{0,12}(?:收款|到账|转入|付款)")
    )

    override fun onCreate() {
        super.onCreate()
        settings = SettingsManager(applicationContext)
        LogTracker.log("监听服务已实例化，开始监测系统通知...")
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
            val amount = extractAmount("$title $text")
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
        val content = "$title $text"
        val regexStr = settings.wechatRegex
        return try {
            val pattern = Pattern.compile(regexStr)
            pattern.matcher(content).find()
        } catch (e: Exception) {
            content.contains("微信支付收款") || 
            content.contains("微信收款") || 
            content.contains("收到付款") || 
            (content.contains("微信支付") && (content.contains("元") || content.contains("¥") || content.contains("￥")))
        }
    }

    private fun isAlipayConfirm(title: String, text: String, isAlipay: Boolean): Boolean {
        if (!isAlipay) return false
        val content = "$title $text"
        val regexStr = settings.alipayRegex
        return try {
            val pattern = Pattern.compile(regexStr)
            pattern.matcher(content).find()
        } catch (e: Exception) {
            content.contains("支付宝成功收款") || 
            content.contains("收钱码收款") || 
            content.contains("成功往账户转入") || 
            content.contains("你已成功收款") ||
            (content.contains("支付宝") && content.contains("元") && (content.contains("收款") || content.contains("到账")))
        }
    }

    private fun extractAmount(text: String): Double? {
        for (pattern in semanticAmountPatterns) {
            val semanticMatcher = pattern.matcher(text)
            if (semanticMatcher.find()) {
                return semanticMatcher.group(1)?.toDoubleOrNull()
            }
        }

        val matcher = amountPattern.matcher(text)
        var lastMatch: String? = null
        while (matcher.find()) {
            lastMatch = matcher.group(1)
        }
        return lastMatch?.toDoubleOrNull()
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
        serviceScope.cancel()
        super.onDestroy()
    }
}
