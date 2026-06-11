package cn.coderpay.watcher.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import cn.coderpay.watcher.R
import cn.coderpay.watcher.MainActivity
import cn.coderpay.watcher.api.HeartbeatRequest
import cn.coderpay.watcher.api.RetrofitClient
import cn.coderpay.watcher.utils.LogTracker
import cn.coderpay.watcher.service.NotificationService
import cn.coderpay.watcher.utils.SettingsManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ForegroundKeepAliveService : Service() {

    private var heartbeatJob: Job? = null
    private val serviceScope = CoroutineScope(Dispatchers.Main)
    private lateinit var settings: SettingsManager

    companion object {
        private const val CHANNEL_ID = "CP_Watcher_KeepAlive"
        private const val NOTIFICATION_ID = 8808

        fun startService(context: Context) {
            val startIntent = Intent(context, ForegroundKeepAliveService::class.java)
            ContextCompat.startForegroundService(context, startIntent)
        }

        fun stopService(context: Context) {
            val stopIntent = Intent(context, ForegroundKeepAliveService::class.java)
            context.stopService(stopIntent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        settings = SettingsManager(applicationContext)
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification("探针就绪：后台到账监听守护运行中..."))
        startHeartbeatLoop()
        LogTracker.log("保活守护服务已启动，后台常驻中。")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    private fun startHeartbeatLoop() {
        heartbeatJob?.cancel()
        heartbeatJob = serviceScope.launch {
            while (true) {
                if (settings.isBound && settings.deviceCode.isNotEmpty()) {
                    sendHeartbeatToServer()
                } else {
                    updateNotification("探针挂挂起：等待设备绑定授权...")
                }
                delay(60 * 1000) // Heartbeat cycle: 60 seconds
            }
        }
    }

    private suspend fun sendHeartbeatToServer() {
        try {
            val isNotificationGranted = isNotificationServiceEnabled()
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoringBattery = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pm.isIgnoringBatteryOptimizations(packageName)
            } else true

            val timestamp = System.currentTimeMillis()
            val secret = settings.deviceSecret
            val sign = if (secret.isNotEmpty()) {
                cn.coderpay.watcher.utils.SignatureHelper.calculateSignature(settings.deviceCode, timestamp, secret)
            } else null

            val request = HeartbeatRequest(
                deviceCode = settings.deviceCode,
                wechatListener = "running",
                alipayListener = "running",
                notificationPermission = isNotificationGranted,
                batteryOptimization = if (isIgnoringBattery) "ignored" else "optimized",
                timestamp = timestamp,
                sign = sign
            )

            val apiService = RetrofitClient.getService(applicationContext)
            val response = apiService.sendHeartbeat(request)
            val body = response.body()
            
            if (response.isSuccessful && body?.status == "success") {
                body.deviceSecret?.let {
                    if (it.isNotEmpty()) settings.deviceSecret = it
                }
                body.wechatRegex?.let {
                    if (it.isNotEmpty()) settings.wechatRegex = it
                }
                body.alipayRegex?.let {
                    if (it.isNotEmpty()) settings.alipayRegex = it
                }
                val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                val isListenerBound = NotificationService.isListenerConnected
                val risk = mutableListOf<String>()
                if (!isNotificationGranted) risk.add("通知未授权")
                if (!isListenerBound) risk.add("监听未绑定")
                if (!isIgnoringBattery) risk.add("电池未豁免")
                val content = if (risk.isEmpty()) {
                    "监听运行中｜通知已授权｜监听已绑定｜电池已豁免｜$time"
                } else {
                    "监听风险：${risk.joinToString(" / ")}｜$time"
                }
                updateNotification(content)
                LogTracker.log("探针心跳上报成功。状态: 在线，电池忽略: $isIgnoringBattery, 通知授权: $isNotificationGranted, 监听绑定: $isListenerBound")
                if (isNotificationGranted && !isListenerBound) {
                    LogTracker.log("⚠️ 通知权限已开启但监听服务未被系统绑定！请在系统设置中关闭再重新开启 CoderPay 通知使用权。")
                }
            } else {
                LogTracker.log("心跳错误：云端通信返回码 - ${response.code()}")
            }
        } catch (e: Exception) {
            LogTracker.log("心跳异常：网络请求连接超时 - ${e.message}")
        }
    }

    private fun isNotificationServiceEnabled(): Boolean {
        val cn = android.content.ComponentName(this, NotificationService::class.java)
        val flat = android.provider.Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(cn.flattenToString())
    }

    private fun createNotification(content: String): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CoderPay 守护中")
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(content: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, createNotification(content))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.keep_alive_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    override fun onDestroy() {
        heartbeatJob?.cancel()
        LogTracker.log("保活守护服务已被销毁注销。")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
