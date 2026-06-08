package cn.coderpay.watcher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.coderpay.watcher.api.HeartbeatRequest
import cn.coderpay.watcher.api.MobileConsoleResponse
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
            // Header
            HeaderBar(isBound = isBound, deviceCode = deviceCode)

            // Connection Settings Card
            PanelCard {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionTitle("云端连接配置", "Cloud Pairing")

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
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CpBlueDark,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(14.dp)
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

            // Permissions Card
            PanelCard {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionTitle("手机运行权限体检", "Runtime Checklist")
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

            // Website Console Shortcuts
            PanelCard {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionTitle("官网核心功能", "Console")
                    Text(
                        text = "充值订阅、订单、收款码、设备和接口文档与官网实时同步。",
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

            // Logger Console Card
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
                            Text("加载失败", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = CpRed)
                            Text(error ?: "", fontSize = 12.sp, color = CpMuted, lineHeight = 17.sp)
                            Button(
                                onClick = { refresh() },
                                colors = ButtonDefaults.buttonColors(containerColor = CpBlueDark, contentColor = Color.White),
                                shape = RoundedCornerShape(12.dp)
                            ) { Text("重新加载") }
                        }
                    }
                }
                data != null -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        when (activeTab) {
                            "billing" -> {
                                item { BillingSummary(data!!) }
                                items(data!!.billingRecords) { record ->
                                    NativeListCard(
                                        title = if (record.type == "charge") "技术费充入" else "交易佣金扣除",
                                        primary = "${if (record.type == "charge") "+" else "-"}¥${formatAmount(record.amount)}",
                                        secondary = record.description,
                                        meta = "余额 ¥${formatAmount(record.balance)} · ${formatDate(record.createdAt)}",
                                        color = if (record.type == "charge") CpGreen else CpRed
                                    )
                                }
                                if (data!!.billingRecords.isEmpty()) item { EmptyCard("暂无账单流水") }
                            }
                            "orders" -> {
                                item { MetricRow("订单流水", "${data!!.orders.size}", "最近 30 笔订单") }
                                items(data!!.orders) { order ->
                                    NativeListCard(
                                        title = order.title,
                                        primary = "¥${formatAmount(order.realAmount)}",
                                        secondary = "${payTypeLabel(order.payType)} · ${statusLabel(order.status)}",
                                        meta = "${order.id} · ${formatDate(order.createdAt)}",
                                        color = statusColor(order.status)
                                    )
                                }
                                if (data!!.orders.isEmpty()) item { EmptyCard("暂无订单") }
                            }
                            "codes" -> {
                                item { MetricRow("收款码", "${data!!.paymentCodes.size}", "微信 / 支付宝收款码") }
                                items(data!!.paymentCodes) { code ->
                                    NativeListCard(
                                        title = "${payTypeLabel(code.type)} ${if (code.codeType == "fixed") "固定金额" else "任意金额"}",
                                        primary = if (code.amount > 0) "¥${formatAmount(code.amount)}" else "任意金额",
                                        secondary = if (code.status == "active") "启用中" else "已停用",
                                        meta = "绑定设备 ${code.deviceId ?: "未绑定"} · ${formatDate(code.createdAt)}",
                                        color = if (code.status == "active") CpGreen else CpSubtle
                                    )
                                }
                                if (data!!.paymentCodes.isEmpty()) item { EmptyCard("暂无收款码，请在网页控制台上传后同步到 App") }
                            }
                            "devices" -> {
                                item { MetricRow("设备通道", "${data!!.devices.count { it.online }}/${data!!.devices.size}", "在线设备 / 全部设备") }
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
                Text("当前套餐：${data.user.packageType}。充值支付能力需要接入移动端原生收银台，本页先展示云端余额和账单。", fontSize = 11.sp, color = CpSubtle, lineHeight = 16.sp)
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
    private fun EmptyCard(text: String) {
        PanelCard {
            Text(
                text = text,
                modifier = Modifier.padding(18.dp),
                fontSize = 12.sp,
                color = CpMuted
            )
        }
    }

    private fun formatAmount(value: Double): String = "%.2f".format(value)

    private fun formatDate(value: String): String = value.replace("T", " ").take(16)

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
