package cn.coderpay.watcher.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.coderpay.watcher.api.MobileException
import cn.coderpay.watcher.api.RetrofitClient
import cn.coderpay.watcher.screens.components.*
import cn.coderpay.watcher.utils.SettingsManager
import cn.coderpay.watcher.utils.SignatureHelper
import cn.coderpay.watcher.utils.ApiErrorHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExceptionsScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val settings = remember { SettingsManager(context) }
    val scope = rememberCoroutineScope()

    var exceptions by remember { mutableStateOf<List<MobileException>>(emptyList()) }
    var totalCount by remember { mutableStateOf(0) }
    var page by remember { mutableStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }

    var selectedStatus by remember { mutableStateOf("all") }
    var selectedType by remember { mutableStateOf("all") }
    var loading by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    val statusFilters = listOf(
        "all" to "全部状态",
        "active" to "待处理",
        "resolved" to "已解决"
    )

    val typeFilters = listOf(
        "all" to "全部类型",
        "payment_unmatched" to "未匹配到账",
        "expired_payment" to "过期到账",
        "webhook_failed" to "回调失败",
        "device_offline" to "设备离线",
        "payment_conflict" to "订单冲突"
    )

    fun signedParts(): Triple<String, String, String> {
        val timestamp = System.currentTimeMillis().toString()
        val sign = SignatureHelper.calculateSignature(
            settings.deviceCode,
            timestamp.toLong(),
            settings.deviceSecret
        )
        return Triple(settings.deviceCode, timestamp, sign)
    }

    fun loadExceptions(isRefresh: Boolean) {
        if (!settings.isBound || settings.deviceCode.isBlank() || settings.deviceSecret.isBlank()) {
            errorMsg = "设备未绑定，无法加载数据"
            return
        }
        if (isRefresh) {
            loading = true
            page = 1
        } else {
            loadingMore = true
        }
        errorMsg = null

        scope.launch(Dispatchers.IO) {
            try {
                val (deviceCode, timestamp, sign) = signedParts()
                val queryStatus = if (selectedStatus == "all") null else selectedStatus
                val queryType = if (selectedType == "all") null else selectedType
                val targetPage = if (isRefresh) 1 else page + 1

                val response = RetrofitClient.getService(context).getMobileExceptions(
                    deviceCode = deviceCode,
                    timestamp = timestamp,
                    sign = sign,
                    page = targetPage,
                    limit = 20,
                    status = queryStatus,
                    type = queryType
                )

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        if (isRefresh) {
                            exceptions = body.exceptions
                        } else {
                            exceptions = exceptions + body.exceptions
                        }
                        totalCount = body.total
                        page = body.page
                        hasMore = body.hasMore
                    } else {
                        errorMsg = ApiErrorHelper.formatApiError(response, "加载失败")
                    }
                    loading = false
                    loadingMore = false
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    errorMsg = "网络连接失败: ${e.message}"
                    loading = false
                    loadingMore = false
                }
            }
        }
    }

    LaunchedEffect(selectedStatus, selectedType) {
        loadExceptions(isRefresh = true)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CpBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Toolbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("异常中心", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
                Text("共 $totalCount 项活跃或历史异常记录", fontSize = 11.sp, color = CpMuted)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(
                    onClick = { loadExceptions(isRefresh = true) },
                    modifier = Modifier.background(CpPanelSoft, RoundedCornerShape(12.dp))
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = "刷新", tint = CpText)
                }
                Button(
                    onClick = onBack,
                    colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Text("返回", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Filters status
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            statusFilters.forEach { (key, label) ->
                val active = selectedStatus == key
                FilterChip(
                    selected = active,
                    onClick = { selectedStatus = key },
                    label = { Text(label, fontSize = 10.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CpPanelSoft, selectedContainerColor = CpBlueDark,
                        labelColor = CpMuted, selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        // Filters type
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            typeFilters.forEach { (key, label) ->
                val active = selectedType == key
                FilterChip(
                    selected = active,
                    onClick = { selectedType = key },
                    label = { Text(label, fontSize = 10.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CpPanelSoft, selectedContainerColor = CpBlue,
                        labelColor = CpMuted, selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        // List Content
        when {
            loading -> {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = CpBlue)
                }
            }
            errorMsg != null -> {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(errorMsg!!, color = CpRed, fontSize = 14.sp)
                        Button(onClick = { loadExceptions(isRefresh = true) }) {
                            Text("重试")
                        }
                    }
                }
            }
            exceptions.isEmpty() -> {
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    EmptyCard("暂无异常中心记录", "当前没有符合筛选条件的系统异常记录。")
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(exceptions) { item ->
                        ExceptionRowCard(exception = item)
                    }

                    if (hasMore) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                if (loadingMore) {
                                    CircularProgressIndicator(color = CpBlue, modifier = Modifier.size(24.dp))
                                } else {
                                    Button(
                                        onClick = { loadExceptions(isRefresh = false) },
                                        colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("加载更多...", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ExceptionRowCard(exception: MobileException) {
    val statusColor = if (exception.status == "active") CpAmber else CpSubtle
    val typeColor = when (exception.type) {
        "payment_unmatched" -> CpRed
        "expired_payment" -> CpAmber
        "webhook_failed" -> CpRed
        "device_offline" -> CpRed
        "payment_conflict" -> Color(0xFFC084FC)
        else -> CpSubtle
    }

    val typeLabel = when (exception.type) {
        "payment_unmatched" -> "未匹配到账"
        "expired_payment" -> "已过期到账"
        "webhook_failed" -> "回调失败"
        "device_offline" -> "设备已离线"
        "payment_conflict" -> "多笔候选冲突"
        else -> exception.type
    }

    val remediationTip = when (exception.type) {
        "payment_unmatched" -> "提示: 可能是用户手动转账了其他金额，请检查后台到账记录后在管理员面板人工确认订单。"
        "expired_payment" -> "提示: 用户在过期后完成了付款。请检查是否需要为用户人工补单或办理退款。"
        "webhook_failed" -> "提示: 商户回调地址没有响应 200，请在订单详情页中检查最近的回调日志。"
        "device_offline" -> "提示: 绑定设备心跳丢失。请确认收款机前台监听服务开启并网络畅通。"
        "payment_conflict" -> "提示: 存在多笔同等金额待付订单，无法自动猜测。已自动转为人工确认模式。"
        else -> "提示: 请检查关联单据内容。"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CpPanel),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(exception.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = CpText)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .background(typeColor.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(typeLabel, fontSize = 9.sp, color = typeColor, fontWeight = FontWeight.Bold)
                        }
                        Text("状态: " + if (exception.status == "active") "待处理" else "已解决", fontSize = 10.sp, color = statusColor)
                    }
                }

                Text(
                    text = formatDate(exception.createdAt),
                    fontSize = 10.sp,
                    color = CpSubtle,
                    fontFamily = FontFamily.Monospace
                )
            }

            Text(
                text = exception.description,
                fontSize = 11.sp,
                color = CpMuted,
                lineHeight = 16.sp
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CpPanelSoft, RoundedCornerShape(8.dp))
                    .padding(8.dp)
            ) {
                Text(
                    text = remediationTip,
                    color = CpSubtle,
                    fontSize = 10.sp,
                    lineHeight = 15.sp
                )
            }
        }
    }
}
