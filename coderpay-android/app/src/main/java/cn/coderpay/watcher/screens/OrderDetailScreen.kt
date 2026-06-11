package cn.coderpay.watcher.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
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
import cn.coderpay.watcher.api.MobileOrderDetail
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
fun OrderDetailScreen(
    orderId: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val settings = remember { SettingsManager(context) }
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var detail by remember { mutableStateOf<MobileOrderDetail?>(null) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    fun signedParts(): Triple<String, String, String> {
        val timestamp = System.currentTimeMillis().toString()
        val sign = SignatureHelper.calculateSignature(
            settings.deviceCode,
            timestamp.toLong(),
            settings.deviceSecret
        )
        return Triple(settings.deviceCode, timestamp, sign)
    }

    fun loadDetail() {
        loading = true
        errorMsg = null
        scope.launch(Dispatchers.IO) {
            try {
                val (deviceCode, timestamp, sign) = signedParts()
                val response = RetrofitClient.getService(context).getMobileOrderDetail(
                    deviceCode = deviceCode,
                    timestamp = timestamp,
                    sign = sign,
                    id = orderId
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        detail = response.body()!!.order
                    } else {
                        errorMsg = ApiErrorHelper.formatApiError(response, "详情加载失败")
                    }
                    loading = false
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    errorMsg = "加载出错: ${e.message}"
                    loading = false
                }
            }
        }
    }

    LaunchedEffect(orderId) {
        loadDetail()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CpBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "返回", tint = CpText)
            }
            Text("订单详情", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = CpText)
        }

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
                        Button(onClick = { loadDetail() }) {
                            Text("重试")
                        }
                    }
                }
            }
            detail != null -> {
                val order = detail!!
                val color = statusColor(order.status)

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(scrollState),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Status Header Card
                    PanelCard {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(order.title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = CpText)
                            Text(
                                "¥${formatAmount(order.realAmount)}",
                                fontSize = 36.sp,
                                fontWeight = FontWeight.Black,
                                color = color
                            )
                            if (order.realAmount != order.amount) {
                                Text("原商户请求金额: ¥${formatAmount(order.amount)}", fontSize = 11.sp, color = CpAmber)
                            }
                            Box(
                                modifier = Modifier
                                    .background(color.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(statusLabel(order.status), fontSize = 13.sp, color = color, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    // Basic Information Section
                    PanelCard {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            SectionTitle("基本信息", "Basic")

                            DetailItem("内部订单号", order.id)
                            DetailItem("商户订单号", order.outOrderNo)
                            DetailItem("所属应用", order.appName + " (${order.appId})")
                            DetailItem("创建时间", formatDate(order.createdAt))
                            DetailItem("过期时间", formatOptionalDate(order.expiresAt))
                            DetailItem("付款时间", formatOptionalDate(order.payTime))
                        }
                    }

                    // Payment Channel Info
                    PanelCard {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            SectionTitle("支付通道", "Payment Channel")

                            DetailItem("支付渠道", payTypeLabel(order.payType))
                            DetailItem("订单确认模式", if (order.confirmMode == "manual") "人工确认" else "自动监听入账")
                            DetailItem("收款码ID", order.paymentCodeId ?: "未绑定/未调度")

                            order.paymentCode?.let { code ->
                                DetailItem("收款码类型", if (code.codeType == "fixed") "固定金额" else "通用码")
                                DetailItem("收款设备名称", code.deviceName ?: "未知设备")
                            }
                        }
                    }

                    // Manual Confirmation Notes (if applicable)
                    if (order.confirmMode == "manual" || order.status == "manual_review" || order.manualConfirmedAt != null) {
                        PanelCard {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                SectionTitle("人工审核说明", "Manual Confirm")
                                if (order.manualConfirmedAt != null) {
                                    DetailItem("确认时间", formatDate(order.manualConfirmedAt))
                                    DetailItem("备注说明", order.manualConfirmNote ?: "无备注说明")
                                } else {
                                    Text(
                                        text = "该订单需管理员人工确认到账。付款后请联系平台管理员提供订单号和支付凭证手动确认。",
                                        fontSize = 12.sp,
                                        color = Color(0xFFC084FC),
                                        lineHeight = 18.sp
                                    )
                                }
                            }
                        }
                    }

                    // Webhook Notification Section
                    PanelCard {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            SectionTitle("商户通知", "Webhook Notification")

                            DetailItem("异步回调状态", when (order.webhookStatus) {
                                "success" -> "成功"
                                "failed" -> "失败"
                                "unsent" -> "未发送"
                                else -> order.webhookStatus
                            })
                            DetailItem("通知 URL", order.notifyUrl)
                            DetailItem("返回 URL", order.returnUrl ?: "--")

                            if (order.webhookLogs.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("最近发送日志", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CpText)
                                order.webhookLogs.forEach { log ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = CardDefaults.cardColors(containerColor = CpPanelSoft)
                                    ) {
                                        Column(modifier = Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text(formatDate(log.requestTime), fontSize = 10.sp, color = CpMuted)
                                                Text(
                                                    text = if (log.result == "success") "成功" else "失败",
                                                    fontSize = 10.sp,
                                                    color = if (log.result == "success") CpGreen else CpRed,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            Text("响应状态码: ${log.statusCode ?: "无响应"}", fontSize = 10.sp, color = CpText)
                                            log.responseSummary?.let {
                                                Text("响应摘要: $it", fontSize = 10.sp, color = CpSubtle, maxLines = 2)
                                            }
                                        }
                                    }
                                }
                            } else {
                                Text("暂无回调尝试记录", fontSize = 11.sp, color = CpSubtle)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DetailItem(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 12.sp, color = CpMuted)
        Text(
            text = value,
            fontSize = 12.sp,
            color = CpText,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.widthIn(max = 220.dp)
        )
    }
}
