package cn.coderpay.watcher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ActivityNotFoundException
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.foundation.Image
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.coderpay.watcher.api.*
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
import cn.coderpay.watcher.screens.*
import cn.coderpay.watcher.screens.components.*

class MainActivity : ComponentActivity() {

    private lateinit var settings: SettingsManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = SettingsManager(applicationContext)

        // If already bound, auto-start foreground service to ensure it runs.
        // A bound flag without deviceSecret means local app data is inconsistent
        // with the server; let the UI recover by asking for a fresh bind code.
        if (settings.isBound && settings.deviceSecret.isNotBlank()) {
            ForegroundKeepAliveService.startService(this)
        }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = CpBlue,
                    background = CpBackground,
                    surface = CpPanel
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
        val missingLocalSecret = settings.isBound && settings.deviceSecret.isBlank()
        var isBound by remember { mutableStateOf(settings.isBound && !missingLocalSecret) }
        var activeConsoleTab by remember { mutableStateOf<String?>(null) }
        var isPairing by remember { mutableStateOf(false) }
        var pairingMessage by remember {
            mutableStateOf<String?>(
                if (missingLocalSecret) "本机设备密钥丢失。请在网页控制台设备详情中点击“重置设备密钥”，复制新的 dev_ 绑定码后重新连接。"
                else null
            )
        }
        var sandboxMessage by remember { mutableStateOf<String?>(null) }
        
        var isNotificationPermissionGranted by remember { mutableStateOf(isNotificationServiceEnabled()) }
        var isListenerBound by remember { mutableStateOf(NotificationService.isListenerConnected) }
        var isBatteryOptimizedIgnored by remember { mutableStateOf(isBatteryOptimizationIgnored()) }

        val scope = rememberCoroutineScope()
        val listState = rememberLazyListState()
        val pageScrollState = rememberScrollState()

        LaunchedEffect(missingLocalSecret) {
            if (missingLocalSecret) {
                settings.isBound = false
                LogTracker.log("检测到本机密钥丢失，已进入重新绑定模式。")
            }
        }

        if (activeConsoleTab != null) {
            NativeConsoleScreen(
                initialTab = activeConsoleTab!!,
                onClose = {
                    activeConsoleTab = null
                    LogTracker.log("已返回监听控制台。")
                }
            )
            return
        }

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
                isListenerBound = NotificationService.isListenerConnected
                isBatteryOptimizedIgnored = isBatteryOptimizationIgnored()
                kotlinx.coroutines.delay(2000)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(pageScrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            HeaderBar(isBound = isBound, deviceCode = deviceCode)
            OperationsHero(
                isBound = isBound,
                notificationEnabled = isNotificationPermissionGranted,
                listenerBound = isListenerBound,
                batteryIgnored = isBatteryOptimizedIgnored,
                deviceCode = deviceCode
            )

            PanelCard {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionTitle("设备绑定", if (isBound) "Connected" else "Pairing")

                    pairingMessage?.let { message ->
                        Text(
                            text = message,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(if (isBound) CpGreenDark else CpPanelSoft, RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            color = if (isBound) Color(0xFFA7F3D0) else CpMuted,
                            fontSize = 12.sp,
                            lineHeight = 17.sp
                        )
                    }

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
                                    pairingMessage = "云端服务 URL 和设备绑定码不能为空。"
                                    LogTracker.log("配对失败：URL 和授权码不能为空。")
                                    return@Button
                                }
                                isPairing = true
                                pairingMessage = "正在连接 CoderPay 云端，请稍候..."
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
                                                isBound = true
                                                isPairing = false
                                                pairingMessage = "绑定成功。设备已在线，后台监听服务已启动。"
                                                ForegroundKeepAliveService.startService(this@MainActivity)
                                            }
                                            LogTracker.log("绑定成功！已拉起后台常驻保活，心跳正常建立。")
                                        } else {
                                            val errorText = response.errorBody()?.string() ?: "授权码无效或已过期"
                                            val friendlyError = when {
                                                errorText.contains("Authentication credentials", ignoreCase = true) ->
                                                    "该设备码已经绑定过旧设备密钥。请在网页控制台的设备详情中点击“重置设备密钥”，复制新的 dev_ 绑定码后再连接。"
                                                errorText.contains("expired", ignoreCase = true) ->
                                                    "设备绑定码已过期。请在网页控制台重新添加安卓设备或重置设备密钥后再连接。"
                                                errorText.contains("Device not registered", ignoreCase = true) ||
                                                    errorText.contains("Invalid", ignoreCase = true) ->
                                                    "设备绑定码不存在。请从网页控制台复制最新的 dev_ 绑定码。"
                                                else -> errorText
                                            }
                                            settings.clearBinding()
                                            withContext(Dispatchers.Main) {
                                                isPairing = false
                                                pairingMessage = "绑定失败：$friendlyError"
                                            }
                                            LogTracker.log("绑定失败：云端响应拒绝 - $friendlyError")
                                        }
                                    } catch (e: Exception) {
                                        settings.clearBinding()
                                        withContext(Dispatchers.Main) {
                                            isPairing = false
                                            pairingMessage = "连接失败：请检查服务地址和网络。${e.message ?: ""}"
                                        }
                                        LogTracker.log("通信失败：连接超时，请检查服务地址。${e.message}")
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isPairing,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CpBlueDark,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text(if (isPairing) "正在连接..." else "保存并连接")
                        }
                    } else {
                        Button(
                            onClick = {
                                settings.clearBinding()
                                isBound = false
                                pairingMessage = "设备已解除绑定。"
                                ForegroundKeepAliveService.stopService(this@MainActivity)
                                LogTracker.log("已主动解除设备绑定。前台守护服务终止。")
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CpRed,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("解除设备绑定")
                        }
                    }
                }
            }

            PanelCard {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionTitle("运行权限", "Runtime")
                    PermissionRow(
                        title = "通知栏读取监听权限",
                        caption = "用于识别微信/支付宝到账通知",
                        enabled = isNotificationPermissionGranted,
                        enabledText = "已开启",
                        disabledText = "需授权",
                        onClick = { openNotificationSettings() }
                    )
                    PermissionRow(
                        title = "电池省电限制忽略",
                        caption = "保持后台心跳和事件上传",
                        enabled = isBatteryOptimizedIgnored,
                        enabledText = "已豁免",
                        disabledText = "需设置",
                        onClick = { requestIgnoreBatteryOptimization() }
                    )
                    PermissionStatusCard(
                        isBound = isBound,
                        notificationEnabled = isNotificationPermissionGranted,
                        listenerBound = isListenerBound,
                        batteryIgnored = isBatteryOptimizedIgnored
                    )
                }
            }

            PanelCard {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionTitle("移动控制台", "Native")
                    Text(
                        text = "原生查看充值、订单、收款码、设备和接入文档，不依赖网页 WebView。",
                        fontSize = 11.sp,
                        color = CpMuted,
                        lineHeight = 15.sp
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ConsoleShortcutButton(
                                text = "充值订阅",
                                modifier = Modifier.weight(1f),
                                onClick = { activeConsoleTab = "billing" }
                            )
                            ConsoleShortcutButton(
                                text = "订单流水",
                                modifier = Modifier.weight(1f),
                                onClick = { activeConsoleTab = "orders" }
                            )
                            ConsoleShortcutButton(
                                text = "收款码",
                                modifier = Modifier.weight(1f),
                                onClick = { activeConsoleTab = "codes" }
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ConsoleShortcutButton(
                                text = "设备通道",
                                modifier = Modifier.weight(1f),
                                onClick = { activeConsoleTab = "devices" }
                            )
                            ConsoleShortcutButton(
                                text = "接口文档",
                                modifier = Modifier.weight(1f),
                                onClick = { activeConsoleTab = "docs" }
                            )
                            ConsoleShortcutButton(
                                text = "控制台",
                                modifier = Modifier.weight(1f),
                                onClick = { activeConsoleTab = "overview" }
                            )
                        }
                    }
                }
            }

            SectionTitle("联调工具", "Sandbox")
            Text(
                text = "以下按钮只模拟本机到账事件，用于验证本地队列、签名和云端匹配；不会触发微信或支付宝真实通知。真实收款必须开启通知读取权限，并由微信/支付宝弹出到账通知。",
                fontSize = 11.sp,
                color = CpMuted,
                lineHeight = 16.sp
            )
            sandboxMessage?.let { message ->
                Text(
                    text = message,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CpPanelSoft, RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    color = if (message.contains("成功")) Color(0xFFA7F3D0) else CpAmber,
                    fontSize = 11.sp,
                    lineHeight = 16.sp
                )
            }
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
                            LogTracker.log("联调模拟：已写入一笔微信模拟到账 ¥0.01，开始尝试上传云端。")
                            val ok = EventSyncer.syncPending(this@MainActivity)
                            WorkerHelper.triggerSync(this@MainActivity)
                            withContext(Dispatchers.Main) {
                                sandboxMessage = if (ok) {
                                    "模拟微信到账成功：已写入本地队列，并已尝试上传云端。请在调试控制台查看匹配结果。"
                                } else {
                                    "模拟微信到账已写入本地队列，但上传云端失败；后台会继续重试，请查看调试控制台错误。"
                                }
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CpGreen,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(18.dp),
                    contentPadding = PaddingValues(vertical = 14.dp)
                ) {
                    Text("模拟微信到账", fontSize = 12.sp)
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
                            LogTracker.log("联调模拟：已写入一笔支付宝模拟到账 ¥0.02，开始尝试上传云端。")
                            val ok = EventSyncer.syncPending(this@MainActivity)
                            WorkerHelper.triggerSync(this@MainActivity)
                            withContext(Dispatchers.Main) {
                                sandboxMessage = if (ok) {
                                    "模拟支付宝到账成功：已写入本地队列，并已尝试上传云端。请在调试控制台查看匹配结果。"
                                } else {
                                    "模拟支付宝到账已写入本地队列，但上传云端失败；后台会继续重试，请查看调试控制台错误。"
                                }
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CpBlueDark,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(18.dp),
                    contentPadding = PaddingValues(vertical = 14.dp)
                ) {
                    Text("模拟支付宝到账", fontSize = 12.sp)
                }
            }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp),
                colors = CardDefaults.cardColors(containerColor = CpTerminal),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "运行调试控制台",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF38BDF8)
                        )

                        TextButton(
                            onClick = { LogTracker.clear() },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("清空", fontSize = 10.sp, color = CpSubtle)
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
                                color = if (log.contains("成功") || log.contains("核销")) CpGreen
                                        else if (log.contains("失败") || log.contains("异常") || log.contains("错误")) CpRed
                                        else CpMuted,
                                lineHeight = 13.sp
                            )
                        }
                    }
                }
            }
        }
    }

    @Composable
    private fun HeaderBar(isBound: Boolean, deviceCode: String) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "CoderPay",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = CpText
                )
                Text(
                    text = if (deviceCode.isNotBlank()) "Android 监听端 · $deviceCode" else "Android 到账监听端",
                    fontSize = 12.sp,
                    color = CpMuted
                )
            }

            StatusPill(
                text = if (isBound) "服务同步中" else "未绑定",
                color = if (isBound) CpGreenDark else Color(0xFF7F1D1D)
            )
        }
    }

    @Composable
    private fun OperationsHero(
        isBound: Boolean,
        notificationEnabled: Boolean,
        listenerBound: Boolean,
        batteryIgnored: Boolean,
        deviceCode: String
    ) {
        val healthy = isBound && notificationEnabled && listenerBound && batteryIgnored
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = if (healthy) Color(0xFF052E2B) else CpPanel),
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (healthy) "监听链路运行正常" else "完成配置后开始监听",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = CpText
                        )
                        Text(
                            text = if (deviceCode.isNotBlank()) "设备 $deviceCode 正在用于到账识别" else "绑定设备码后启用心跳和事件上传",
                            fontSize = 11.sp,
                            color = CpMuted,
                            lineHeight = 16.sp
                        )
                    }
                    StatusPill(
                        text = if (healthy) "READY" else "SETUP",
                        color = if (healthy) CpGreenDark else Color(0xFF78350F)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HealthTile("云端", if (isBound) "已绑定" else "未绑定", isBound, Modifier.weight(1f))
                    HealthTile("通知", if (notificationEnabled) "已授权" else "未授权", notificationEnabled, Modifier.weight(1f))
                    HealthTile("监听", if (listenerBound) "已连接" else "未连接", listenerBound, Modifier.weight(1f))
                    HealthTile("保活", if (batteryIgnored) "已豁免" else "需设置", batteryIgnored, Modifier.weight(1f))
                }
            }
        }
    }

    @Composable
    private fun HealthTile(title: String, value: String, ok: Boolean, modifier: Modifier = Modifier) {
        Column(
            modifier = modifier
                .background(if (ok) Color(0xFF064E3B) else CpPanelSoft, RoundedCornerShape(16.dp))
                .padding(horizontal = 10.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, fontSize = 10.sp, color = CpSubtle, fontWeight = FontWeight.Bold)
            Text(value, fontSize = 12.sp, color = if (ok) Color(0xFFA7F3D0) else CpText, fontWeight = FontWeight.ExtraBold)
        }
    }



    @Composable
    private fun PermissionRow(
        title: String,
        caption: String,
        enabled: Boolean,
        enabledText: String,
        disabledText: String,
        onClick: () -> Unit
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CpPanelSoft, RoundedCornerShape(14.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = CpText)
                Text(caption, fontSize = 10.sp, color = CpSubtle)
            }
            Button(
                onClick = onClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (enabled) CpGreen else CpAmberDark,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Text(
                    text = if (enabled) enabledText else disabledText,
                    fontSize = 10.sp,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }

    @Composable
    private fun PermissionStatusCard(
        isBound: Boolean,
        notificationEnabled: Boolean,
        listenerBound: Boolean,
        batteryIgnored: Boolean
    ) {
        val healthy = isBound && notificationEnabled && listenerBound && batteryIgnored
        val message = when {
            !isBound -> "先完成设备绑定。绑定成功后，App 才会上传心跳和到账事件。"
            !notificationEnabled && !batteryIgnored -> "还需要开启通知读取权限，并把 CoderPay 加入电池优化白名单，否则真实到账通知可能无法识别或后台被系统清理。"
            !notificationEnabled -> "还需要开启通知读取权限。未授权时，微信/支付宝真实到账通知不会被 App 读取。"
            !listenerBound -> "通知读取权限已开启，但系统尚未真正连接监听服务。请关闭再重新开启 CoderPay 通知使用权；vivo 还需要允许自启动和后台运行。"
            !batteryIgnored -> "还需要忽略电池省电限制。未豁免时，息屏或后台运行一段时间后可能停止心跳。"
            else -> "监听链路已具备上线运行条件。请保持前台守护通知常驻。"
        }
        val bg = if (healthy) Color(0xFF052E2B) else Color(0xFF2A1F0A)
        val textColor = if (healthy) Color(0xFFA7F3D0) else Color(0xFFFDE68A)
        Text(
            text = message,
            modifier = Modifier
                .fillMaxWidth()
                .background(bg, RoundedCornerShape(14.dp))
                .padding(12.dp),
            color = textColor,
            fontSize = 11.sp,
            lineHeight = 16.sp
        )
    }

    @Composable
    private fun StatusPill(text: String, color: Color) {
        Card(
            colors = CardDefaults.cardColors(containerColor = color),
            shape = RoundedCornerShape(24.dp)
        ) {
            Text(
                text = text,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }

    @Composable
    private fun ConsoleShortcutButton(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
        Button(
            onClick = onClick,
            modifier = modifier,
            colors = ButtonDefaults.buttonColors(
                containerColor = CpPanelSoft,
                contentColor = CpText
            ),
            shape = RoundedCornerShape(12.dp),
            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 10.dp)
        ) {
            Text(text = text, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }

    @Composable
    private fun NativeConsoleScreen(initialTab: String, onClose: () -> Unit) {
        var activeTab by remember { mutableStateOf(initialTab) }
        var clickedOrderId by remember { mutableStateOf<String?>(null) }
        var clickedBillingHistory by remember { mutableStateOf(false) }
        var loading by remember { mutableStateOf(true) }
        var error by remember { mutableStateOf<String?>(null) }
        var data by remember { mutableStateOf<MobileConsoleResponse?>(null) }
        val scope = rememberCoroutineScope()
        var actionMessage by remember { mutableStateOf<String?>(null) }

        fun refresh() {
            if (!settings.isBound || settings.deviceCode.isBlank() || settings.deviceSecret.isBlank()) {
                loading = false
                error = "当前手机还没有有效设备密钥。请返回监听页，用云端设备码完成绑定后，再进入移动控制台同步充值、订单、收款码和设备数据。"
                return
            }
            loading = true
            error = null
            scope.launch(Dispatchers.IO) {
                try {
                    val timestamp = System.currentTimeMillis()
                    val sign = cn.coderpay.watcher.utils.SignatureHelper.calculateSignature(
                        settings.deviceCode,
                        timestamp,
                        settings.deviceSecret
                    )
                    val response = RetrofitClient.getService(this@MainActivity).getMobileConsole(
                        settings.deviceCode,
                        timestamp.toString(),
                        sign
                    )
                    withContext(Dispatchers.Main) {
                        if (response.isSuccessful && response.body() != null) {
                            data = response.body()
                        } else {
                            error = cn.coderpay.watcher.utils.ApiErrorHelper.formatApiError(response, "移动控制台加载失败")
                        }
                        loading = false
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        error = "移动控制台连接失败：${e.message ?: "网络异常"}"
                        loading = false
                    }
                }
            }
        }

        LaunchedEffect(Unit) { refresh() }
        BackHandler(onBack = {
            when {
                clickedBillingHistory -> clickedBillingHistory = false
                clickedOrderId != null -> clickedOrderId = null
                activeTab == "orders" -> activeTab = "overview"
                activeTab == "exceptions" -> activeTab = "overview"
                else -> onClose()
            }
        })

        if (clickedBillingHistory) {
            BillingScreen(
                data = data!!,
                onRefresh = { refresh() },
                onBack = { clickedBillingHistory = false }
            )
            return
        }

        if (clickedOrderId != null) {
            OrderDetailScreen(orderId = clickedOrderId!!, onBack = { clickedOrderId = null })
            return
        }

        if (activeTab == "orders") {
            OrdersScreen(
                onOrderClick = { clickedOrderId = it },
                onBack = { activeTab = "overview" }
            )
            return
        }

        if (activeTab == "exceptions") {
            ExceptionsScreen(
                onBack = { activeTab = "overview" }
            )
            return
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(CpBackground)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("CoderPay", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
                    Text("移动控制台 · ${settings.deviceCode}", fontSize = 11.sp, color = CpMuted)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { refresh() },
                        colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                    ) { Text("刷新", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    Button(
                        onClick = onClose,
                        colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                    ) { Text("返回监听", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }
            }

            ConsoleTabs(activeTab = activeTab, onSelect = { activeTab = it })

            when {
                loading -> {
                    PanelCard {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            CircularProgressIndicator(color = CpBlue)
                            Text("正在同步云端数据...", fontSize = 12.sp, color = CpMuted)
                        }
                    }
                }
                error != null -> {
                    PanelCard {
                        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                text = if (!settings.isBound) "移动控制台未启用" else "加载失败",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (!settings.isBound) CpAmber else CpRed
                            )
                            Text(error ?: "", fontSize = 12.sp, color = CpMuted, lineHeight = 17.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Button(
                                    onClick = { refresh() },
                                    colors = ButtonDefaults.buttonColors(containerColor = CpBlueDark, contentColor = Color.White),
                                    shape = RoundedCornerShape(12.dp)
                                ) { Text("重新加载") }
                                Button(
                                    onClick = onClose,
                                    colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                                    shape = RoundedCornerShape(12.dp)
                                ) { Text("返回绑定") }
                            }
                        }
                    }
                }
                data != null -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (actionMessage != null) {
                            item {
                                PanelCard {
                                    Text(
                                        text = actionMessage!!,
                                        modifier = Modifier.padding(14.dp),
                                        fontSize = 12.sp,
                                        color = CpBlue
                                    )
                                }
                            }
                        }
                        when (activeTab) {
                            "billing" -> {
                                item {
                                    RechargeScreen(
                                        data = data!!,
                                        onRefresh = { refresh() },
                                        scope = scope,
                                        onActionMessage = { actionMessage = it },
                                        onViewBillingHistory = { clickedBillingHistory = true }
                                    )
                                }
                            }
                            "codes" -> {
                                item {
                                    PaymentCodesScreen(
                                        data = data!!,
                                        onRefresh = { refresh() },
                                        scope = scope,
                                        onActionMessage = { actionMessage = it }
                                    )
                                }
                            }
                            "devices" -> {
                                item {
                                    DevicesScreen(
                                        data = data!!,
                                        onRefresh = { refresh() },
                                        scope = scope,
                                        onActionMessage = { actionMessage = it },
                                        isNotificationPermissionGranted = isNotificationServiceEnabled(),
                                        isListenerBound = isNotificationServiceEnabled(),
                                        isBatteryOptimizedIgnored = isBatteryOptimizationIgnored()
                                    )
                                }
                            }
                            "docs" -> {
                                item {
                                    PanelCard {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            SectionTitle("接口文档", "Docs")
                                            Text("1. 在网页控制台创建应用并获取 app_id / app_secret。", fontSize = 12.sp, color = CpMuted)
                                            Text("2. 上传微信或支付宝收款码，绑定当前 Android 监听设备。", fontSize = 12.sp, color = CpMuted)
                                            Text("3. 商户服务端调用 /api/order/create 创建订单，用户付款后 App 自动上传到账事件。", fontSize = 12.sp, color = CpMuted)
                                            Text("4. 云端匹配成功后回调 notify_url，并更新订单状态。", fontSize = 12.sp, color = CpMuted)
                                        }
                                    }
                                }
                            }
                            else -> {
                                item {
                                    PanelCard {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            SectionTitle("充值订阅", "Billing")
                                            Text(data!!.user.email, fontSize = 12.sp, color = CpMuted)
                                            Text("¥${formatAmount(data!!.user.feeBalance)}", fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
                                            Text("当前套餐：${packageLabel(data!!.user.packageType)}。余额用于订阅和交易手续费；低于或等于0元时将停止创建新订单。", fontSize = 11.sp, color = CpSubtle, lineHeight = 16.sp)
                                        }
                                    }
                                }
                                item { MetricRow("订单", "${data!!.orderSummary?.total ?: 0}", "全部订单数") }
                                item { MetricRow("收款码", "${data!!.paymentCodes.size}", "已配置码") }
                                item { MetricRow("设备", "${data!!.devices.count { it.online }}/${data!!.devices.size}", "在线状态") }
                            }
                        }
                    }
                }
            }
        }
    }

    @Composable
    private fun ConsoleTabs(activeTab: String, onSelect: (String) -> Unit) {
        val tabs = listOf(
            "overview" to "总览",
            "billing" to "充值",
            "orders" to "订单",
            "codes" to "收款码",
            "devices" to "设备",
            "exceptions" to "异常",
            "docs" to "文档"
        )
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 2.dp)
        ) {
            items(tabs) { (key, label) ->
                Button(
                    onClick = { onSelect(key) },
                    modifier = Modifier.height(38.dp).widthIn(min = 72.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (activeTab == key) CpBlueDark else CpPanelSoft,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 2.dp, vertical = 0.dp)
                ) {
                    Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                }
            }
        }
    }

    @Composable
    private fun BillingSummary(data: MobileConsoleResponse) {
        PanelCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionTitle("充值订阅", "Billing")
                Text(data.user.email, fontSize = 12.sp, color = CpMuted)
                Text("¥${formatAmount(data.user.feeBalance)}", fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
                Text("当前套餐：${packageLabel(data.user.packageType)}。余额用于订阅和交易手续费；低于或等于0元时将停止创建新订单。", fontSize = 11.sp, color = CpSubtle, lineHeight = 16.sp)
            }
        }
    }

    @Composable
    private fun RechargeCard(recharge: MobileRechargeData, onRefresh: () -> Unit) {
        PanelCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionTitle("待支付充值单", recharge.recharge_id)
                Text("请支付 ¥${recharge.real_amount}，过期时间 ${formatDate(recharge.expired_at)}", fontSize = 12.sp, color = CpMuted)
                val imageUrl = recharge.payment_code?.imageUrl ?: ""
                if (imageUrl.startsWith("data:image/")) {
                    DataUriImage(imageUrl)
                } else {
                    Text("充值二维码未返回，请检查平台充值收款码配置。", fontSize = 11.sp, color = CpAmber)
                }
                Button(
                    onClick = onRefresh,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = CpBlueDark, contentColor = Color.White),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("刷新充值状态") }
            }
        }
    }

    private fun packageLabel(value: String): String = when (value) {
        "trial" -> "体验版"
        "pro" -> "专业版"
        "max" -> "高级版"
        else -> "体验版"
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
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            Toast.makeText(this, "当前系统无需单独设置电池优化。", Toast.LENGTH_SHORT).show()
            return
        }

        val intents = listOf(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            },
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            },
            Intent(Settings.ACTION_SETTINGS)
        )

        for ((index, intent) in intents.withIndex()) {
            try {
                startActivity(intent)
                LogTracker.log(
                    when (index) {
                        0 -> "已打开电池优化豁免申请，请允许 CoderPay 在后台运行。"
                        1 -> "已打开系统电池优化列表，请将 CoderPay 设置为不优化。"
                        2 -> "已打开应用详情页，请进入电池/耗电管理并允许后台运行。"
                        else -> "已打开系统设置，请手动搜索电池优化并放行 CoderPay。"
                    }
                )
                return
            } catch (_: ActivityNotFoundException) {
                // Try the next fallback intent.
            } catch (_: SecurityException) {
                // Some OEM systems block direct battery optimization intents.
            } catch (_: Exception) {
                // Keep fallback chain robust across OEM Android variants.
            }
        }

        Toast.makeText(this, "无法自动打开电池设置，请手动允许 CoderPay 后台运行。", Toast.LENGTH_LONG).show()
        LogTracker.log("电池设置跳转失败：请手动允许 CoderPay 后台运行，并关闭省电限制。")
    }
}
