package cn.coderpay.watcher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.coderpay.watcher.api.HeartbeatRequest
import cn.coderpay.watcher.api.RetrofitClient
import cn.coderpay.watcher.data.AppDatabase
import cn.coderpay.watcher.data.LocalEvent
import cn.coderpay.watcher.service.ForegroundKeepAliveService
import cn.coderpay.watcher.service.NotificationService
import cn.coderpay.watcher.utils.LogTracker
import cn.coderpay.watcher.utils.SettingsManager
import cn.coderpay.watcher.worker.EventSyncer
import cn.coderpay.watcher.worker.WorkerHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private lateinit var settings: SettingsManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = SettingsManager(applicationContext)

        // If already bound, auto-start foreground service to ensure it runs
        if (settings.isBound) {
            ForegroundKeepAliveService.startService(this)
        }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF3B82F6), // Blue 500
                    background = Color(0xFF0F172A), // Slate 900
                    surface = Color(0xFF1E293B) // Slate 800
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    WatcherDashboard()
                }
            }
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun WatcherDashboard() {
        var serverUrl by remember { mutableStateOf(settings.serverUrl) }
        var deviceCode by remember { mutableStateOf(settings.deviceCode) }
        var isBound by remember { mutableStateOf(settings.isBound) }
        
        var isNotificationPermissionGranted by remember { mutableStateOf(isNotificationServiceEnabled()) }
        var isBatteryOptimizedIgnored by remember { mutableStateOf(isBatteryOptimizationIgnored()) }

        val scope = rememberCoroutineScope()
        val listState = rememberLazyListState()

        // Sync logs scroll
        LaunchedEffect(LogTracker.logs.size) {
            if (LogTracker.logs.isNotEmpty()) {
                listState.animateScrollToItem(LogTracker.logs.size - 1)
            }
        }

        // Poll permissions in Lifecycle check
        LaunchedEffect(Unit) {
            while (true) {
                isNotificationPermissionGranted = isNotificationServiceEnabled()
                isBatteryOptimizedIgnored = isBatteryOptimizationIgnored()
                kotlinx.coroutines.delay(2000)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "CoderPay",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "到账监听探针",
                        fontSize = 11.sp,
                        color = Color.Gray
                    )
                }

                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (isBound) Color(0xFF064E3B) else Color(0xFF7F1D1D)
                    ),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = if (isBound) "服务同步中" else "未绑定设备",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            // Connection Settings Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "云端连接配置",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        label = { Text("云端服务 URL") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isBound
                    )

                    OutlinedTextField(
                        value = deviceCode,
                        onValueChange = { deviceCode = it },
                        label = { Text("设备绑定授权码 (deviceCode)") },
                        placeholder = { Text("例: dev-3918") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isBound
                    )

                    if (!isBound) {
                        Button(
                            onClick = {
                                if (serverUrl.isBlank() || deviceCode.isBlank()) {
                                    LogTracker.log("配对失败：URL 和授权码不能为空。")
                                    return@Button
                                }
                                scope.launch(Dispatchers.IO) {
                                    LogTracker.log("正在与云端服务器握手对位...")
                                    try {
                                        // Save temporarily to let Retrofit evaluate baseUrl
                                        settings.serverUrl = serverUrl
                                        settings.deviceCode = deviceCode

                                        val timestamp = System.currentTimeMillis()
                                        val secret = settings.deviceSecret
                                        val sign = if (secret.isNotEmpty()) {
                                            cn.coderpay.watcher.utils.SignatureHelper.calculateSignature(deviceCode, timestamp, secret)
                                        } else null

                                        val request = HeartbeatRequest(
                                            deviceCode = deviceCode,
                                            wechatListener = "running",
                                            alipayListener = "running",
                                            notificationPermission = isNotificationServiceEnabled(),
                                            batteryOptimization = if (isBatteryOptimizationIgnored()) "ignored" else "optimized",
                                            timestamp = timestamp,
                                            sign = sign
                                        )

                                        val response = RetrofitClient.getService(this@MainActivity).sendHeartbeat(request)
                                        val body = response.body()
                                        if (response.isSuccessful && body?.status == "success") {
                                            settings.isBound = true
                                            isBound = true
                                            body.deviceSecret?.let {
                                                if (it.isNotEmpty()) settings.deviceSecret = it
                                            }
                                            body.wechatRegex?.let {
                                                if (it.isNotEmpty()) settings.wechatRegex = it
                                            }
                                            body.alipayRegex?.let {
                                                if (it.isNotEmpty()) settings.alipayRegex = it
                                            }
                                            withContext(Dispatchers.Main) {
                                                ForegroundKeepAliveService.startService(this@MainActivity)
                                            }
                                            LogTracker.log("绑定成功！已拉起后台常驻保活，心跳正常建立。")
                                        } else {
                                            settings.clearBinding()
                                            LogTracker.log("绑定失败：云端响应拒绝 - ${response.errorBody()?.string() ?: "授权码无效"}")
                                        }
                                    } catch (e: Exception) {
                                        settings.clearBinding()
                                        LogTracker.log("通信失败：连接超时，请检查服务地址。${e.message}")
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("保存并连接探针")
                        }
                    } else {
                        Button(
                            onClick = {
                                settings.clearBinding()
                                isBound = false
                                ForegroundKeepAliveService.stopService(this@MainActivity)
                                LogTracker.log("已主动解除设备绑定。前台守护服务终止。")
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                        ) {
                            Text("解除设备绑定")
                        }
                    }
                }
            }

            // Permissions Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "手机运行权限体检",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("通知栏读取监听权限", fontSize = 12.sp, color = Color.LightGray)
                        Button(
                            onClick = { openNotificationSettings() },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isNotificationPermissionGranted) Color(0xFF10B981) else Color(0xFFF59E0B)
                            ),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (isNotificationPermissionGranted) "已开启" else "需授权",
                                fontSize = 10.sp,
                                color = Color.White
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("电池省电限制忽略 (保活)", fontSize = 12.sp, color = Color.LightGray)
                        Button(
                            onClick = { requestIgnoreBatteryOptimization() },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isBatteryOptimizedIgnored) Color(0xFF10B981) else Color(0xFFF59E0B)
                            ),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (isBatteryOptimizedIgnored) "已豁免" else "需设置",
                                fontSize = 10.sp,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            // Test Trigger Widget
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = {
                        scope.launch(Dispatchers.IO) {
                            val time = System.currentTimeMillis()
                            val mockText = "[微信支付] 微信收款 0.01 元 (测试匹配)"
                            val hash = "mock_hash_" + time
                            val db = AppDatabase.getDatabase(this@MainActivity)
                            val event = LocalEvent(
                                notificationHash = hash,
                                payType = "wechat",
                                amount = 0.01,
                                receivedAt = time,
                                rawText = mockText,
                                isUploaded = false
                            )
                            db.localEventDao().insertEvent(event)
                            LogTracker.log("联调模拟：成功伪造一笔微信付款 ¥0.01，存入本地，激发推送队列。")
                            EventSyncer.syncPending(this@MainActivity)
                            WorkerHelper.triggerSync(this@MainActivity)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Text("测试微信 ¥0.01", fontSize = 12.sp)
                }

                Button(
                    onClick = {
                        scope.launch(Dispatchers.IO) {
                            val time = System.currentTimeMillis()
                            val mockText = "[支付宝] 收钱码收款 0.02 元 (测试匹配)"
                            val hash = "mock_hash_" + time
                            val db = AppDatabase.getDatabase(this@MainActivity)
                            val event = LocalEvent(
                                notificationHash = hash,
                                payType = "alipay",
                                amount = 0.02,
                                receivedAt = time,
                                rawText = mockText,
                                isUploaded = false
                            )
                            db.localEventDao().insertEvent(event)
                            LogTracker.log("联调模拟：成功伪造一笔支付宝付款 ¥0.02，存入本地，激发推送队列。")
                            EventSyncer.syncPending(this@MainActivity)
                            WorkerHelper.triggerSync(this@MainActivity)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) {
                    Text("测试支付宝 ¥0.02", fontSize = 12.sp)
                }
            }

            // Logger Console Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF020617)) // Deep dark black
            ) {
                Column(
                    modifier = Modifier.padding(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "运行调试控制台 (Terminal Logs)",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF38BDF8) // Sky blue
                        )

                        TextButton(
                            onClick = { LogTracker.clear() },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("清空", fontSize = 10.sp, color = Color.Gray)
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        state = listState,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(LogTracker.logs) { log ->
                            Text(
                                text = log,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = if (log.contains("成功") || log.contains("核销")) Color.Green 
                                        else if (log.contains("失败") || log.contains("异常") || log.contains("错误")) Color.Red 
                                        else Color.LightGray,
                                lineHeight = 13.sp
                            )
                        }
                    }
                }
            }
        }
    }

    private fun isNotificationServiceEnabled(): Boolean {
        val cn = ComponentName(this, NotificationService::class.java)
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(cn.flattenToString())
    }

    private fun openNotificationSettings() {
        try {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            startActivity(intent)
        } catch (e: Exception) {
            val intent = Intent(Settings.ACTION_SETTINGS)
            startActivity(intent)
            LogTracker.log("跳转设置失败，请手动打开系统设置开启通知访问权限。")
        }
    }

    private fun isBatteryOptimizationIgnored(): Boolean {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(packageName)
        } else true
    }

    private fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } catch (e: Exception) {
                val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                startActivity(intent)
                LogTracker.log("跳转失败，请手动前往设置关闭省电优化以保活。")
            }
        }
    }
}
