package cn.coderpay.watcher.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.coderpay.watcher.api.MobileOrder
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
fun OrdersScreen(
    onOrderClick: (String) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val settings = remember { SettingsManager(context) }
    val scope = rememberCoroutineScope()

    var orders by remember { mutableStateOf<List<MobileOrder>>(emptyList()) }
    var totalCount by remember { mutableStateOf(0) }
    var page by remember { mutableStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }

    var selectedStatus by remember { mutableStateOf("all") }
    var selectedPayType by remember { mutableStateOf("all") }
    var keyword by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    val statusFilters = listOf(
        "all" to "全部",
        "pending" to "待支付",
        "success" to "成功",
        "expired" to "已过期",
        "failed" to "失败",
        "manual_review" to "人工审核"
    )

    val payTypeFilters = listOf(
        "all" to "全部渠道",
        "wechat" to "微信",
        "alipay" to "支付宝"
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

    fun loadOrders(isRefresh: Boolean) {
        if (!settings.isBound || settings.deviceCode.isBlank() || settings.deviceSecret.isBlank()) {
            errorMsg = "设备未绑定，无法加载订单"
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
                val queryPayType = if (selectedPayType == "all") null else selectedPayType
                val queryKeyword = keyword.ifBlank { null }
                val targetPage = if (isRefresh) 1 else page + 1

                val response = RetrofitClient.getService(context).getMobileOrders(
                    deviceCode = deviceCode,
                    timestamp = timestamp,
                    sign = sign,
                    page = targetPage,
                    limit = 20,
                    status = queryStatus,
                    payType = queryPayType,
                    keyword = queryKeyword
                )

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        if (isRefresh) {
                            orders = body.orders
                        } else {
                            orders = orders + body.orders
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
                    errorMsg = "网络请求失败: ${e.message}"
                    loading = false
                    loadingMore = false
                }
            }
        }
    }

    LaunchedEffect(selectedStatus, selectedPayType) {
        loadOrders(isRefresh = true)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CpBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Toolbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("订单管理", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
                Text("共 $totalCount 笔订单数据", fontSize = 11.sp, color = CpMuted)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(
                    onClick = { loadOrders(isRefresh = true) },
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

        // Search bar
        OutlinedTextField(
            value = keyword,
            onValueChange = { keyword = it },
            label = { Text("搜索订单号 / 外部订单号 / 标题") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = CpMuted) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { loadOrders(isRefresh = true) })
        )

        // Status filters (horizontal Chips)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            statusFilters.forEach { (key, label) ->
                val isSelected = selectedStatus == key
                FilterChip(
                    selected = isSelected,
                    onClick = { selectedStatus = key },
                    label = { Text(label, fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CpPanelSoft,
                        labelColor = CpMuted,
                        selectedContainerColor = CpBlueDark,
                        selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        // Pay type filters (horizontal Chips)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            payTypeFilters.forEach { (key, label) ->
                val isSelected = selectedPayType == key
                FilterChip(
                    selected = isSelected,
                    onClick = { selectedPayType = key },
                    label = { Text(label, fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CpPanelSoft,
                        labelColor = CpMuted,
                        selectedContainerColor = CpBlue,
                        selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        // Content
        when {
            loading -> {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = CpBlue)
                }
            }
            errorMsg != null -> {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(errorMsg!!, color = CpRed, fontSize = 14.sp)
                        Button(
                            onClick = { loadOrders(isRefresh = true) },
                            colors = ButtonDefaults.buttonColors(containerColor = CpBlue)
                        ) {
                            Text("重试")
                        }
                    }
                }
            }
            orders.isEmpty() -> {
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    EmptyCard("暂无订单", "在所选筛选条件下，没有找到订单数据。")
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(orders) { order ->
                        OrderRowCard(order = order, onClick = { onOrderClick(order.id) })
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
                                        onClick = { loadOrders(isRefresh = false) },
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
fun OrderRowCard(order: MobileOrder, onClick: () -> Unit) {
    val color = statusColor(order.status)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
                    Text(order.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = CpText, maxLines = 1)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(payTypeLabel(order.payType), fontSize = 11.sp, color = CpMuted)
                        Box(
                            modifier = Modifier
                                .background(color.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(statusLabel(order.status), fontSize = 10.sp, color = color, fontWeight = FontWeight.Bold)
                        }
                    }
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
                    Text("创建时间", fontSize = 10.sp, color = CpSubtle, fontWeight = FontWeight.Bold)
                    Text(formatDate(order.createdAt), fontSize = 10.sp, color = CpMuted, fontFamily = FontFamily.Monospace)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("回调状态", fontSize = 10.sp, color = CpSubtle, fontWeight = FontWeight.Bold)
                    Text(
                        when (order.webhookStatus) {
                            "success" -> "成功"
                            "failed" -> "失败"
                            "unsent" -> "未发送"
                            else -> order.webhookStatus
                        },
                        fontSize = 10.sp,
                        color = when (order.webhookStatus) {
                            "success" -> CpGreen
                            "failed" -> CpRed
                            else -> CpMuted
                        },
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (order.status == "manual_review") {
                Text(
                    text = "⚠️ 订单存在冲突，需管理员人工审核入账。",
                    fontSize = 11.sp,
                    color = Color(0xFFC084FC),
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}
