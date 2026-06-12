package cn.coderpay.watcher.screens

import androidx.compose.foundation.background
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
import cn.coderpay.watcher.api.*
import cn.coderpay.watcher.screens.components.*
import cn.coderpay.watcher.utils.SettingsManager
import cn.coderpay.watcher.utils.SignatureHelper
import cn.coderpay.watcher.utils.ApiErrorHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillingScreen(
    data: MobileConsoleResponse,
    onRefresh: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val settings = remember { SettingsManager(context) }
    val scope = rememberCoroutineScope()

    var billingRecords by remember { mutableStateOf<List<MobileBillingRecord>>(emptyList()) }
    var totalCount by remember { mutableStateOf(0) }
    var page by remember { mutableStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }

    var selectedType by remember { mutableStateOf("all") }
    var loading by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    val typeFilters = listOf(
        "all" to "全部明细",
        "charge" to "充值",
        "fee" to "手续费扣除",
        "promotion" to "赠送奖励",
        "admin_adjust" to "管理员调整"
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

    fun loadBilling(isRefresh: Boolean) {
        if (!settings.isBound || settings.deviceCode.isBlank() || settings.deviceSecret.isBlank()) {
            errorMsg = "设备未绑定，无法加载账单"
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
                val queryType = if (selectedType == "all") null else selectedType
                val targetPage = if (isRefresh) 1 else page + 1

                val response = RetrofitClient.getService(context).getMobileBillingRecords(
                    deviceCode = deviceCode,
                    timestamp = timestamp,
                    sign = sign,
                    page = targetPage,
                    limit = 20,
                    type = queryType
                )

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        if (isRefresh) {
                            billingRecords = body.billingRecords
                        } else {
                            billingRecords = billingRecords + body.billingRecords
                        }
                        totalCount = body.total
                        page = body.page
                        hasMore = body.hasMore
                        if (isRefresh) onRefresh()
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

    LaunchedEffect(selectedType) {
        loadBilling(isRefresh = true)
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
                Text("账单明细", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
                Text("账户余额 ¥${formatAmount(data.user.feeBalance)}", fontSize = 11.sp, color = CpMuted)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(
                    onClick = { loadBilling(isRefresh = true) },
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

        // Account Balance Info Card
        PanelCard {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("服务费余额", fontSize = 12.sp, color = CpSubtle)
                    Text("¥${formatAmount(data.user.feeBalance)}", fontSize = 28.sp, fontWeight = FontWeight.Black, color = CpText)
                }
                Box(
                    modifier = Modifier
                        .background(CpBlue.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "套餐: " + packageLabel(data.user.packageType),
                        fontSize = 11.sp,
                        color = CpBlue,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Type Filter Chips
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
                        containerColor = CpPanelSoft, selectedContainerColor = CpBlueDark,
                        labelColor = CpMuted, selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        // Billing List Content
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
                        Button(onClick = { loadBilling(isRefresh = true) }) {
                            Text("重试")
                        }
                    }
                }
            }
            billingRecords.isEmpty() -> {
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    EmptyCard("暂无账单明细记录", "未产生符合条件的账单流水。")
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(billingRecords) { record ->
                        BillingRecordRowCard(record = record)
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
                                        onClick = { loadBilling(isRefresh = false) },
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

private fun packageLabel(value: String): String = when (value) {
    "trial" -> "体验版"
    "pro" -> "专业版"
    "max" -> "高级版"
    else -> "体验版"
}

@Composable
fun BillingRecordRowCard(record: MobileBillingRecord) {
    val isCharge = record.type == "charge" || record.type == "promotion" || (record.type == "admin_adjust" && record.amount >= 0)
    val color = if (isCharge) CpGreen else CpRed
    val prefix = if (isCharge) "+" else "-"

    val typeLabel = when (record.type) {
        "charge" -> "充值入账"
        "fee" -> "服务费扣减"
        "promotion" -> "赠送余额"
        "admin_adjust" -> "后台调整"
        else -> record.type
    }

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
                Text(typeLabel, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CpText)
                Text(record.description, fontSize = 11.sp, color = CpMuted, lineHeight = 16.sp)
                Text(
                    text = "变动后余额: ¥${formatAmount(record.balance)} · ${formatDate(record.createdAt)}",
                    fontSize = 10.sp,
                    color = CpSubtle,
                    fontFamily = FontFamily.Monospace
                )
            }
            Text(
                text = "$prefix¥${formatAmount(kotlin.math.abs(record.amount))}",
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
                color = color
            )
        }
    }
}
