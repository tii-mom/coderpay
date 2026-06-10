package cn.coderpay.watcher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Base64
import androidx.activity.compose.BackHandler
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
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

private val CpBackground = Color(0xFF070A12)
private val CpPanel = Color(0xFF111827)
private val CpPanelSoft = Color(0xFF1E293B)
private val CpBorder = Color(0xFF334155)
private val CpBlue = Color(0xFF3B82F6)
private val CpBlueDark = Color(0xFF2563EB)
private val CpGreen = Color(0xFF10B981)
private val CpGreenDark = Color(0xFF064E3B)
private val CpAmber = Color(0xFFF59E0B)
private val CpRed = Color(0xFFEF4444)
private val CpText = Color(0xFFF8FAFC)
private val CpMuted = Color(0xFF94A3B8)
private val CpSubtle = Color(0xFF64748B)
private val CpTerminal = Color(0xFF020617)

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
        var isBound by remember { mutableStateOf(settings.isBound) }
        var activeConsoleTab by remember { mutableStateOf<String?>(null) }
        var isPairing by remember { mutableStateOf(false) }
        var pairingMessage by remember { mutableStateOf<String?>(null) }
        
        var isNotificationPermissionGranted by remember { mutableStateOf(isNotificationServiceEnabled()) }
        var isBatteryOptimizedIgnored by remember { mutableStateOf(isBatteryOptimizationIgnored()) }

        val scope = rememberCoroutineScope()
        val listState = rememberLazyListState()
        val pageScrollState = rememberScrollState()

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
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CpGreen,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(18.dp),
                    contentPadding = PaddingValues(vertical = 14.dp)
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
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CpBlueDark,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(18.dp),
                    contentPadding = PaddingValues(vertical = 14.dp)
                ) {
                    Text("测试支付宝 ¥0.02", fontSize = 12.sp)
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
        batteryIgnored: Boolean,
        deviceCode: String
    ) {
        val healthy = isBound && notificationEnabled && batteryIgnored
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
                    HealthTile("通知", if (notificationEnabled) "可读取" else "未授权", notificationEnabled, Modifier.weight(1f))
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
    private fun PanelCard(content: @Composable () -> Unit) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CpPanel),
            shape = RoundedCornerShape(20.dp)
        ) {
            content()
        }
    }

    @Composable
    private fun SectionTitle(title: String, caption: String) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = CpText
            )
            Text(
                text = caption,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = CpSubtle
            )
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
                    containerColor = if (enabled) CpGreen else CpAmber
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
        var loading by remember { mutableStateOf(true) }
        var error by remember { mutableStateOf<String?>(null) }
        var data by remember { mutableStateOf<MobileConsoleResponse?>(null) }
        val scope = rememberCoroutineScope()
        var actionMessage by remember { mutableStateOf<String?>(null) }
        var rechargeAmount by remember { mutableStateOf("50") }
        var rechargePayType by remember { mutableStateOf("alipay") }
        var activeRecharge by remember { mutableStateOf<MobileRechargeData?>(null) }
        var codePayType by remember { mutableStateOf("wechat") }
        var codeMode by remember { mutableStateOf("any") }
        var codeAmount by remember { mutableStateOf("9.90") }
        var uploadedCodeUrl by remember { mutableStateOf("") }
        var alipayUserId by remember { mutableStateOf("") }
        var codeToDelete by remember { mutableStateOf<cn.coderpay.watcher.api.MobilePaymentCode?>(null) }

        fun signedParts(): Triple<String, String, String> {
            val timestamp = System.currentTimeMillis().toString()
            val sign = cn.coderpay.watcher.utils.SignatureHelper.calculateSignature(
                settings.deviceCode,
                timestamp.toLong(),
                settings.deviceSecret
            )
            return Triple(settings.deviceCode, timestamp, sign)
        }

        val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            if (uri == null) return@rememberLauncherForActivityResult
            scope.launch(Dispatchers.IO) {
                try {
                    val type = contentResolver.getType(uri) ?: "image/png"
                    val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: ByteArray(0)
                    val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                    val (deviceCode, timestamp, sign) = signedParts()
                    val response = RetrofitClient.getService(this@MainActivity).uploadMobilePaymentCode(
                        deviceCode,
                        timestamp,
                        sign,
                        MobilePaymentCodeUploadRequest(type, base64)
                    )
                    withContext(Dispatchers.Main) {
                        if (response.isSuccessful && response.body() != null) {
                            uploadedCodeUrl = response.body()!!.url
                            actionMessage = "收款码图片已上传，可继续创建通道。"
                        } else {
                            actionMessage = "图片上传失败：${response.code()}"
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        actionMessage = "图片读取或上传失败：${e.message ?: "未知错误"}"
                    }
                }
            }
        }

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
                            error = "移动控制台加载失败：${response.code()}"
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

        fun refreshAfterAction(message: String) {
            actionMessage = message
            refresh()
        }

        LaunchedEffect(Unit) { refresh() }
        BackHandler(onBack = onClose)

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
                    if (codeToDelete != null) {
                        AlertDialog(
                            onDismissRequest = { codeToDelete = null },
                            title = { Text("删除收款码") },
                            text = { Text("删除后该二维码不会再参与订单调度。此操作不可撤销。") },
                            confirmButton = {
                                TextButton(onClick = {
                                    val target = codeToDelete!!
                                    codeToDelete = null
                                    scope.launch(Dispatchers.IO) {
                                        val (deviceCode, timestamp, sign) = signedParts()
                                        val response = RetrofitClient.getService(this@MainActivity).deleteMobilePaymentCode(deviceCode, timestamp, sign, target.id)
                                        withContext(Dispatchers.Main) {
                                            refreshAfterAction(if (response.isSuccessful) "收款码已删除。" else "删除失败：${response.code()}")
                                        }
                                    }
                                }) { Text("确认删除") }
                            },
                            dismissButton = {
                                TextButton(onClick = { codeToDelete = null }) { Text("取消") }
                            }
                        )
                    }
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
                                    BillingSummary(data!!)
                                }
                                item {
                                    PanelCard {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            SectionTitle("创建充值单", "Recharge")
                                            OutlinedTextField(
                                                value = rechargeAmount,
                                                onValueChange = { rechargeAmount = it },
                                                label = { Text("充值金额") },
                                                modifier = Modifier.fillMaxWidth(),
                                                singleLine = true
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                listOf("alipay" to "支付宝", "wechat" to "微信").forEach { (key, label) ->
                                                    Button(
                                                        onClick = { rechargePayType = key },
                                                        modifier = Modifier.weight(1f),
                                                        colors = ButtonDefaults.buttonColors(containerColor = if (rechargePayType == key) CpBlueDark else CpPanelSoft),
                                                        shape = RoundedCornerShape(12.dp)
                                                    ) { Text(label, fontSize = 11.sp) }
                                                }
                                            }
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                listOf("50", "100", "300").forEach { amount ->
                                                    Button(
                                                        onClick = { rechargeAmount = amount },
                                                        modifier = Modifier.weight(1f),
                                                        colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft),
                                                        shape = RoundedCornerShape(12.dp)
                                                    ) { Text("¥$amount", fontSize = 11.sp) }
                                                }
                                            }
                                            Button(
                                                onClick = {
                                                    val amount = rechargeAmount.toDoubleOrNull()
                                                    if (amount == null || amount <= 0) {
                                                        actionMessage = "请输入有效充值金额。"
                                                        return@Button
                                                    }
                                                    scope.launch(Dispatchers.IO) {
                                                        val (deviceCode, timestamp, sign) = signedParts()
                                                        val response = RetrofitClient.getService(this@MainActivity).createMobileRecharge(
                                                            deviceCode,
                                                            timestamp,
                                                            sign,
                                                            MobileRechargeRequest(amount, rechargePayType)
                                                        )
                                                        withContext(Dispatchers.Main) {
                                                            if (response.isSuccessful && response.body()?.data != null) {
                                                                activeRecharge = response.body()!!.data
                                                                actionMessage = "充值单已创建，请按二维码支付 ¥${activeRecharge!!.real_amount}。"
                                                            } else {
                                                                actionMessage = "充值单创建失败：${response.code()}"
                                                            }
                                                        }
                                                    }
                                                },
                                                modifier = Modifier.fillMaxWidth(),
                                                colors = ButtonDefaults.buttonColors(containerColor = CpGreen),
                                                shape = RoundedCornerShape(14.dp)
                                            ) { Text("创建充值单") }
                                        }
                                    }
                                }
                                if (activeRecharge != null) {
                                    item {
                                        RechargeCard(activeRecharge!!, onRefresh = {
                                            scope.launch(Dispatchers.IO) {
                                                val (deviceCode, timestamp, sign) = signedParts()
                                                val response = RetrofitClient.getService(this@MainActivity).getMobileRecharge(deviceCode, timestamp, sign, activeRecharge!!.recharge_id)
                                                withContext(Dispatchers.Main) {
                                                    actionMessage = if (response.isSuccessful) "充值单状态：${response.body()?.status}" else "充值状态查询失败：${response.code()}"
                                                    if (response.body()?.status == "success") refresh()
                                                }
                                            }
                                        })
                                    }
                                }
                                item {
                                    PanelCard {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            SectionTitle("订阅套餐", "Plans")
                                            Text("Pro 适合稳定运营，Max 适合高并发和更低费率。余额不足时请先充值。", fontSize = 11.sp, color = CpMuted)
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                listOf("pro" to "开通 Pro", "max" to "开通 Max").forEach { (planId, label) ->
                                                    Button(
                                                        onClick = {
                                                            scope.launch(Dispatchers.IO) {
                                                                val (deviceCode, timestamp, sign) = signedParts()
                                                                val response = RetrofitClient.getService(this@MainActivity).subscribeMobilePlan(deviceCode, timestamp, sign, MobileSubscribeRequest(planId))
                                                                withContext(Dispatchers.Main) {
                                                                    refreshAfterAction(if (response.isSuccessful) "$label 成功。" else "$label 失败：${response.code()}")
                                                                }
                                                            }
                                                        },
                                                        modifier = Modifier.weight(1f),
                                                        colors = ButtonDefaults.buttonColors(containerColor = CpBlueDark),
                                                        shape = RoundedCornerShape(12.dp)
                                                    ) { Text(label, fontSize = 11.sp) }
                                                }
                                            }
                                        }
                                    }
                                }
                                items(data!!.billingRecords) { record ->
                                    NativeListCard(
                                        title = if (record.type == "charge") "技术费充入" else "交易佣金扣除",
                                        primary = "${if (record.type == "charge") "+" else "-"}¥${formatAmount(record.amount)}",
                                        secondary = record.description,
                                        meta = "余额 ¥${formatAmount(record.balance)} · ${formatDate(record.createdAt)}",
                                        color = if (record.type == "charge") CpGreen else CpRed
                                    )
                                }
                                if (data!!.billingRecords.isEmpty()) item { EmptyCard("暂无账单流水", "发生充值、订阅或订单服务费扣减后会显示在这里。") }
                            }
                            "orders" -> {
                                item { MetricRow("订单流水", "${data!!.orders.size}", "最近 30 笔订单") }
                                items(data!!.orders) { order ->
                                    OrderCard(order)
                                }
                                if (data!!.orders.isEmpty()) item { EmptyCard("暂无订单", "开发者服务端创建订单后，最近订单会同步到这里。") }
                            }
                            "codes" -> {
                                item { MetricRow("收款码", "${data!!.paymentCodes.size}", "微信 / 支付宝收款码") }
                                item {
                                    PanelCard {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            SectionTitle("上传并创建收款码", "Create")
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                listOf("wechat" to "微信", "alipay" to "支付宝").forEach { (key, label) ->
                                                    Button(
                                                        onClick = { codePayType = key },
                                                        modifier = Modifier.weight(1f),
                                                        colors = ButtonDefaults.buttonColors(containerColor = if (codePayType == key) CpBlueDark else CpPanelSoft),
                                                        shape = RoundedCornerShape(12.dp)
                                                    ) { Text(label, fontSize = 11.sp) }
                                                }
                                            }
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                listOf("any" to "通用码", "fixed" to "固定金额").forEach { (key, label) ->
                                                    Button(
                                                        onClick = { codeMode = key },
                                                        modifier = Modifier.weight(1f),
                                                        colors = ButtonDefaults.buttonColors(containerColor = if (codeMode == key) CpBlueDark else CpPanelSoft),
                                                        shape = RoundedCornerShape(12.dp)
                                                    ) { Text(label, fontSize = 11.sp) }
                                                }
                                            }
                                            if (codeMode == "fixed") {
                                                OutlinedTextField(
                                                    value = codeAmount,
                                                    onValueChange = { codeAmount = it },
                                                    label = { Text("固定金额") },
                                                    modifier = Modifier.fillMaxWidth(),
                                                    singleLine = true
                                                )
                                            }
                                            if (codePayType == "alipay") {
                                                OutlinedTextField(
                                                    value = alipayUserId,
                                                    onValueChange = { alipayUserId = it },
                                                    label = { Text("支付宝 PID（选填）") },
                                                    modifier = Modifier.fillMaxWidth(),
                                                    singleLine = true
                                                )
                                            }
                                            Text(
                                                text = if (uploadedCodeUrl.isBlank()) "尚未选择二维码图片" else "二维码图片已上传",
                                                fontSize = 11.sp,
                                                color = if (uploadedCodeUrl.isBlank()) CpAmber else CpGreen
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Button(
                                                    onClick = { imagePicker.launch("image/*") },
                                                    modifier = Modifier.weight(1f),
                                                    colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft),
                                                    shape = RoundedCornerShape(12.dp)
                                                ) { Text("选择图片") }
                                                Button(
                                                    onClick = {
                                                        if (uploadedCodeUrl.isBlank()) {
                                                            actionMessage = "请先选择并上传二维码图片。"
                                                            return@Button
                                                        }
                                                        val amount = if (codeMode == "fixed") codeAmount.toDoubleOrNull() ?: 0.0 else 0.0
                                                        scope.launch(Dispatchers.IO) {
                                                            val (deviceCode, timestamp, sign) = signedParts()
                                                            val response = RetrofitClient.getService(this@MainActivity).createMobilePaymentCode(
                                                                deviceCode,
                                                                timestamp,
                                                                sign,
                                                                MobilePaymentCodeCreateRequest(
                                                                    codePayType,
                                                                    codeMode,
                                                                    amount,
                                                                    uploadedCodeUrl,
                                                                    settings.deviceCode.let { data!!.devices.find { d -> d.deviceCode == it }?.id },
                                                                    alipayUserId.ifBlank { null }
                                                                )
                                                            )
                                                            withContext(Dispatchers.Main) {
                                                                if (response.isSuccessful) {
                                                                    uploadedCodeUrl = ""
                                                                    refreshAfterAction("收款码创建成功。")
                                                                } else {
                                                                    actionMessage = "收款码创建失败：${response.code()}"
                                                                }
                                                            }
                                                        }
                                                    },
                                                    modifier = Modifier.weight(1f),
                                                    colors = ButtonDefaults.buttonColors(containerColor = CpGreen),
                                                    shape = RoundedCornerShape(12.dp)
                                                ) { Text("创建通道") }
                                            }
                                        }
                                    }
                                }
                                items(data!!.paymentCodes) { code ->
                                    PaymentCodeCard(
                                        code = code,
                                        onToggle = {
                                            scope.launch(Dispatchers.IO) {
                                                val (deviceCode, timestamp, sign) = signedParts()
                                                val next = if (code.status == "active") "inactive" else "active"
                                                val response = RetrofitClient.getService(this@MainActivity).updateMobilePaymentCode(
                                                    deviceCode,
                                                    timestamp,
                                                    sign,
                                                    code.id,
                                                    MobilePaymentCodeUpdateRequest(status = next)
                                                )
                                                withContext(Dispatchers.Main) {
                                                    refreshAfterAction(if (response.isSuccessful) "收款码状态已更新。" else "状态更新失败：${response.code()}")
                                                }
                                            }
                                        },
                                        onDelete = { codeToDelete = code }
                                    )
                                }
                                if (data!!.paymentCodes.isEmpty()) item { EmptyCard("暂无收款码", "请先在控制台上传微信或支付宝收款码，并绑定当前监听设备。") }
                            }
                            "devices" -> {
                                item { MetricRow("设备通道", "${data!!.devices.count { it.online }}/${data!!.devices.size}", "在线设备 / 全部设备") }
                                item {
                                    PanelCard {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            SectionTitle("当前设备安全", "Security")
                                            Text("重置密钥会使旧设备签名立即失效。操作后本机将保存新密钥并继续连接。", fontSize = 11.sp, color = CpMuted, lineHeight = 16.sp)
                                            Button(
                                                onClick = {
                                                    scope.launch(Dispatchers.IO) {
                                                        val (deviceCode, timestamp, sign) = signedParts()
                                                        val response = RetrofitClient.getService(this@MainActivity).resetMobileDeviceSecret(deviceCode, timestamp, sign)
                                                        withContext(Dispatchers.Main) {
                                                            if (response.isSuccessful && !response.body()?.deviceSecret.isNullOrBlank()) {
                                                                settings.deviceSecret = response.body()!!.deviceSecret!!
                                                                refreshAfterAction("设备密钥已重置。")
                                                            } else {
                                                                actionMessage = "设备密钥重置失败：${response.code()}"
                                                            }
                                                        }
                                                    }
                                                },
                                                modifier = Modifier.fillMaxWidth(),
                                                colors = ButtonDefaults.buttonColors(containerColor = CpAmber),
                                                shape = RoundedCornerShape(12.dp)
                                            ) { Text("重置当前设备密钥") }
                                        }
                                    }
                                }
                                items(data!!.devices) { device ->
                                    NativeListCard(
                                        title = device.name,
                                        primary = device.deviceCode,
                                        secondary = if (device.online) "在线" else "离线",
                                        meta = "通知 ${if (device.notificationPermission) "已开" else "未开"} · 电池 ${device.batteryOptimization ?: "未知"}",
                                        color = if (device.online) CpGreen else CpAmber
                                    )
                                }
                            }
                            "exceptions" -> {
                                item { MetricRow("异常中心", "${data!!.exceptions.count { it.status == "active" }}", "活跃异常 / 最近 30 条") }
                                items(data!!.exceptions) { exception ->
                                    NativeListCard(
                                        title = exception.title,
                                        primary = exception.type,
                                        secondary = if (exception.status == "active") "待处理" else "已处理",
                                        meta = "${exception.refId} · ${formatDate(exception.createdAt)}",
                                        color = if (exception.status == "active") CpAmber else CpSubtle
                                    )
                                }
                                if (data!!.exceptions.isEmpty()) item { EmptyCard("暂无异常", "未匹配到账、过期到账、Webhook失败和设备离线会显示在这里。") }
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
                                item { BillingSummary(data!!) }
                                item { MetricRow("订单", "${data!!.orders.size}", "最近订单") }
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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            tabs.forEach { (key, label) ->
                Button(
                    onClick = { onSelect(key) },
                    modifier = Modifier.weight(1f).height(38.dp),
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
                Text("当前套餐：${data.user.packageType}。余额用于订阅和交易手续费；低于或等于0元时将停止创建新订单。", fontSize = 11.sp, color = CpSubtle, lineHeight = 16.sp)
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
                    colors = ButtonDefaults.buttonColors(containerColor = CpBlueDark),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("刷新充值状态") }
            }
        }
    }

    @Composable
    private fun DataUriImage(dataUri: String) {
        val bitmap = remember(dataUri) {
            try {
                val base64 = dataUri.substringAfter("base64,", "")
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } catch (_: Exception) {
                null
            }
        }
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "payment qr",
                modifier = Modifier
                    .size(220.dp)
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .padding(10.dp)
            )
        } else {
            Text("二维码图片解析失败。", fontSize = 11.sp, color = CpRed)
        }
    }

    @Composable
    private fun PaymentCodeCard(
        code: MobilePaymentCode,
        onToggle: () -> Unit,
        onDelete: () -> Unit
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CpPanel),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${payTypeLabel(code.type)} ${if (code.codeType == "fixed") "固定金额" else "通用码"}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CpText)
                        Text("绑定设备 ${code.deviceId ?: "未绑定"} · ${formatDate(code.createdAt)}", fontSize = 10.sp, color = CpSubtle, maxLines = 1)
                    }
                    Text(if (code.amount > 0) "¥${formatAmount(code.amount)}" else "任意金额", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = if (code.status == "active") CpGreen else CpSubtle)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onToggle,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = if (code.status == "active") CpAmber else CpGreen),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text(if (code.status == "active") "停用" else "启用", fontSize = 11.sp) }
                    Button(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CpRed),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("删除", fontSize = 11.sp) }
                }
            }
        }
    }

    @Composable
    private fun MetricRow(title: String, value: String, caption: String) {
        PanelCard {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CpText)
                    Text(caption, fontSize = 10.sp, color = CpSubtle)
                }
                Text(value, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
            }
        }
    }

    @Composable
    private fun NativeListCard(title: String, primary: String, secondary: String, meta: String, color: Color) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CpPanel),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CpText, maxLines = 1)
                    Text(secondary, fontSize = 11.sp, color = color, fontWeight = FontWeight.SemiBold)
                    Text(meta, fontSize = 10.sp, color = CpSubtle, maxLines = 1)
                }
                Text(primary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = color)
            }
        }
    }

    @Composable
    private fun OrderCard(order: cn.coderpay.watcher.api.MobileOrder) {
        val color = statusColor(order.status)
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CpPanel),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(order.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CpText, maxLines = 1)
                        Text("${payTypeLabel(order.payType)} · ${statusLabel(order.status)}", fontSize = 11.sp, color = color, fontWeight = FontWeight.SemiBold)
                        Text(order.id, fontSize = 10.sp, color = CpSubtle, maxLines = 1)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("¥${formatAmount(order.realAmount)}", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = color)
                        if (order.realAmount != order.amount) {
                            Text("原价 ¥${formatAmount(order.amount)}", fontSize = 10.sp, color = CpAmber)
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CpPanelSoft, RoundedCornerShape(12.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("过期时间", fontSize = 10.sp, color = CpSubtle, fontWeight = FontWeight.Bold)
                        Text(formatOptionalDate(order.expiresAt), fontSize = 11.sp, color = CpMuted, fontFamily = FontFamily.Monospace)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(if (order.paymentCodeId == null) "未锁定码" else "已锁定码", fontSize = 10.sp, color = CpSubtle, fontWeight = FontWeight.Bold)
                        Text(order.paymentCodeId?.take(8) ?: "--", fontSize = 11.sp, color = CpMuted, fontFamily = FontFamily.Monospace)
                    }
                }

                if (order.status == "manual_review") {
                    Text(
                        text = "该订单存在并发冲突或需要人工核验，系统不会自动猜测匹配。",
                        fontSize = 11.sp,
                        color = Color(0xFFC084FC),
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }

    @Composable
    private fun EmptyCard(title: String, caption: String = "") {
        PanelCard {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = CpText)
                if (caption.isNotBlank()) {
                    Text(caption, fontSize = 11.sp, color = CpMuted, lineHeight = 16.sp)
                }
            }
        }
    }

    private fun formatAmount(value: Double): String = "%.2f".format(value)

    private fun formatDate(value: String): String = value.replace("T", " ").take(16)

    private fun formatOptionalDate(value: String?): String = value?.replace("T", " ")?.take(16) ?: "--"

    private fun payTypeLabel(value: String): String = when (value) {
        "wechat" -> "微信"
        "alipay" -> "支付宝"
        else -> value
    }

    private fun statusLabel(value: String): String = when (value) {
        "pending" -> "待支付"
        "success" -> "已成功"
        "paid" -> "已到账"
        "expired" -> "已过期"
        "failed" -> "失败"
        "manual_review" -> "人工审核"
        else -> value
    }

    private fun statusColor(value: String): Color = when (value) {
        "success", "paid" -> CpGreen
        "pending" -> CpAmber
        "failed", "expired" -> CpRed
        else -> CpSubtle
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
