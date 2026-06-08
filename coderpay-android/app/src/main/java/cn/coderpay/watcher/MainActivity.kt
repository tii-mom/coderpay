package cn.coderpay.watcher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.WebChromeClient
import android.webkit.ValueCallback
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.viewinterop.AndroidView
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
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        fileChooserCallback?.onReceiveValue(uris)
        fileChooserCallback = null
    }

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
        var consoleUrl by remember { mutableStateOf<String?>(null) }
        
        var isNotificationPermissionGranted by remember { mutableStateOf(isNotificationServiceEnabled()) }
        var isBatteryOptimizedIgnored by remember { mutableStateOf(isBatteryOptimizationIgnored()) }

        val scope = rememberCoroutineScope()
        val listState = rememberLazyListState()
        val pageScrollState = rememberScrollState()

        if (consoleUrl != null) {
            InAppConsole(
                url = consoleUrl!!,
                onClose = {
                    consoleUrl = null
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
                                onClick = { consoleUrl = consoleUrlFor("billing") }
                            )
                            ConsoleShortcutButton(
                                text = "订单流水",
                                modifier = Modifier.weight(1f),
                                onClick = { consoleUrl = consoleUrlFor("orders") }
                            )
                            ConsoleShortcutButton(
                                text = "收款码",
                                modifier = Modifier.weight(1f),
                                onClick = { consoleUrl = consoleUrlFor("codes") }
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ConsoleShortcutButton(
                                text = "设备通道",
                                modifier = Modifier.weight(1f),
                                onClick = { consoleUrl = consoleUrlFor("devices") }
                            )
                            ConsoleShortcutButton(
                                text = "接口文档",
                                modifier = Modifier.weight(1f),
                                onClick = { consoleUrl = consoleUrlFor("docs") }
                            )
                            ConsoleShortcutButton(
                                text = "控制台",
                                modifier = Modifier.weight(1f),
                                onClick = { consoleUrl = consoleUrlFor("") }
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
    private fun InAppConsole(url: String, onClose: () -> Unit) {
        var webViewRef by remember { mutableStateOf<WebView?>(null) }

        BackHandler {
            val webView = webViewRef
            if (webView?.canGoBack() == true) {
                webView.goBack()
            } else {
                onClose()
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(CpBackground)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CpPanel)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "CoderPay 控制台",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = CpText
                    )
                    Text(
                        text = url,
                        fontSize = 10.sp,
                        color = CpSubtle,
                        maxLines = 1
                    )
                }
                Button(
                    onClick = onClose,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CpPanelSoft,
                        contentColor = CpText
                    ),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Text("返回监听", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            AndroidView(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                factory = { context ->
                    WebView(context).apply {
                        webViewClient = WebViewClient()
                        webChromeClient = object : WebChromeClient() {
                            override fun onShowFileChooser(
                                webView: WebView?,
                                filePathCallback: ValueCallback<Array<Uri>>?,
                                fileChooserParams: FileChooserParams?
                            ): Boolean {
                                fileChooserCallback?.onReceiveValue(null)
                                fileChooserCallback = filePathCallback
                                return try {
                                    val intent = fileChooserParams?.createIntent()
                                        ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                            addCategory(Intent.CATEGORY_OPENABLE)
                                            type = "image/*"
                                        }
                                    fileChooserLauncher.launch(intent)
                                    true
                                } catch (e: Exception) {
                                    fileChooserCallback?.onReceiveValue(null)
                                    fileChooserCallback = null
                                    LogTracker.log("打开图片选择器失败：${e.message}")
                                    false
                                }
                            }
                        }
                        setInitialScale(100)
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.cacheMode = WebSettings.LOAD_DEFAULT
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        settings.textZoom = 100
                        settings.builtInZoomControls = false
                        settings.displayZoomControls = false
                        settings.userAgentString = settings.userAgentString
                            .replace("wv", "")
                            .replace("Version/4.0", "Version/120.0")
                        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                        webViewRef = this
                        loadUrl(url)
                    }
                },
                update = { webView ->
                    if (webView.url != url) {
                        webView.loadUrl(url)
                    }
                }
            )
        }
    }

    private fun consoleUrlFor(tab: String): String {
        val baseUrl = settings.serverUrl.ifBlank { "https://3api.shop" }.trimEnd('/')
        return if (tab.isBlank()) "$baseUrl/console" else "$baseUrl/console/$tab"
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
