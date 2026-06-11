package cn.coderpay.watcher.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import cn.coderpay.watcher.api.MobileConsoleResponse
import cn.coderpay.watcher.api.MobileRechargeData
import cn.coderpay.watcher.api.MobileRechargeOrder
import cn.coderpay.watcher.api.MobileRechargeRequest
import cn.coderpay.watcher.api.MobileSubscribeRequest
import cn.coderpay.watcher.api.RetrofitClient
import cn.coderpay.watcher.screens.components.*
import cn.coderpay.watcher.utils.SettingsManager
import cn.coderpay.watcher.utils.SignatureHelper
import cn.coderpay.watcher.utils.ApiErrorHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun RechargeScreen(
    data: MobileConsoleResponse,
    onRefresh: () -> Unit,
    scope: CoroutineScope,
    onActionMessage: (String) -> Unit,
    onViewBillingHistory: () -> Unit
) {
    val context = LocalContext.current
    val settings = remember { SettingsManager(context) }

    var rechargeAmount by remember { mutableStateOf("50") }
    var rechargePayType by remember { mutableStateOf("alipay") }
    var activeRecharge by remember { mutableStateOf<MobileRechargeData?>(null) }
    var checkingStatus by remember { mutableStateOf(false) }

    var activeHistoryTab by remember { mutableStateOf("my_recharge") }

    fun signedParts(): Triple<String, String, String> {
        val timestamp = System.currentTimeMillis().toString()
        val sign = SignatureHelper.calculateSignature(
            settings.deviceCode,
            timestamp.toLong(),
            settings.deviceSecret
        )
        return Triple(settings.deviceCode, timestamp, sign)
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Balance Summary Card
        PanelCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionTitle("充值与订阅", "Billing")
                Text(data.user.email, fontSize = 12.sp, color = CpMuted)
                Text("¥${formatAmount(data.user.feeBalance)}", fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, color = CpText)
                Text("当前套餐：${packageLabel(data.user.packageType)}。余额用于订阅套餐与扣除交易手续费。", fontSize = 11.sp, color = CpSubtle, lineHeight = 16.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Button(
                    onClick = onViewBillingHistory,
                    colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(vertical = 4.dp)
                ) {
                    Text("查看账单明细流水", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Active Recharge Payment Card
        activeRecharge?.let { recharge ->
            ActiveRechargeCard(
                recharge = recharge,
                onRefresh = {
                    checkingStatus = true
                    scope.launch(Dispatchers.IO) {
                        try {
                            val (deviceCode, timestamp, sign) = signedParts()
                            val response = RetrofitClient.getService(context).getMobileRecharge(
                                deviceCode,
                                timestamp,
                                sign,
                                recharge.recharge_id
                            )
                            withContext(Dispatchers.Main) {
                                checkingStatus = false
                                if (response.isSuccessful && response.body() != null) {
                                    val status = response.body()!!.status
                                    onActionMessage("充值单状态: ${statusLabel(status)}")
                                    if (status == "success") {
                                        activeRecharge = null
                                        onRefresh()
                                    }
                                } else {
                                    onActionMessage(ApiErrorHelper.formatApiError(response, "状态查询失败"))
                                }
                            }
                        } catch (e: Exception) {
                            withContext(Dispatchers.Main) {
                                checkingStatus = false
                                onActionMessage("请求状态出错: ${e.message}")
                            }
                        }
                    }
                },
                onCancel = {
                    activeRecharge = null
                    onActionMessage("已关闭充值二维码")
                },
                checkingStatus = checkingStatus
            )
        }

        // Create Recharge Order Card
        if (activeRecharge == null) {
            PanelCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionTitle("新建充值", "New Recharge")
                    OutlinedTextField(
                        value = rechargeAmount,
                        onValueChange = { rechargeAmount = it },
                        label = { Text("输入充值金额") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("alipay" to "支付宝", "wechat" to "微信").forEach { (key, label) ->
                            Button(
                                onClick = { rechargePayType = key },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (rechargePayType == key) CpBlueDark else CpPanelSoft,
                                    contentColor = Color.White,
                                    disabledContainerColor = CpPanelSoft,
                                    disabledContentColor = CpMuted
                                ),
                                shape = RoundedCornerShape(12.dp)
                            ) { Text(label, fontSize = 11.sp) }
                        }
                    }
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(listOf("10", "50", "100", "500", "2000", "5000")) { amount ->
                            Button(
                                onClick = { rechargeAmount = amount },
                                modifier = Modifier.widthIn(min = 72.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (rechargeAmount == amount) CpBlueDark else CpPanelSoft,
                                    contentColor = Color.White,
                                    disabledContainerColor = CpPanelSoft,
                                    disabledContentColor = CpMuted
                                ),
                                shape = RoundedCornerShape(10.dp)
                            ) { Text("¥$amount", fontSize = 11.sp) }
                        }
                    }
                    Button(
                        onClick = {
                            val amount = rechargeAmount.toDoubleOrNull()
                            if (amount == null || amount <= 0) {
                                onActionMessage("请输入有效充值金额")
                                return@Button
                            }
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val (deviceCode, timestamp, sign) = signedParts()
                                    val response = RetrofitClient.getService(context).createMobileRecharge(
                                        deviceCode,
                                        timestamp,
                                        sign,
                                        MobileRechargeRequest(amount, rechargePayType)
                                    )
                                    withContext(Dispatchers.Main) {
                                        if (response.isSuccessful && response.body()?.data != null) {
                                            activeRecharge = response.body()!!.data
                                            val manualHint = if (activeRecharge!!.requires_manual_confirm) "，需人工确认" else ""
                                            onActionMessage("充值单创建成功$manualHint。")
                                        } else {
                                            onActionMessage(ApiErrorHelper.formatApiError(response, "充值单创建失败"))
                                        }
                                    }
                                } catch (e: Exception) {
                                    withContext(Dispatchers.Main) {
                                        onActionMessage("创建请求出错: ${e.message}")
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CpGreen,
                            contentColor = Color.White,
                            disabledContainerColor = CpGreen.copy(alpha = 0.5f),
                            disabledContentColor = CpMuted
                        ),
                        shape = RoundedCornerShape(14.dp)
                    ) { Text("确认创建充值单") }
                }
            }
        }

        // Subscribe Plan Card
        PanelCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionTitle("开通订阅套餐", "Plans")
                Text("体验版免订阅费，按 1.98%/笔扣费且最低 ¥0.10；专业版适合稳定运营，高级版低费率。充值满 ¥500 送 1 个月专业版，满 ¥2000 送 1 个月高级版，满 ¥5000 送 3 个月高级版。", fontSize = 11.sp, color = CpMuted, lineHeight = 16.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("trial" to "体验版", "pro" to "专业版", "max" to "高级版").forEach { (planId, label) ->
                        Button(
                            onClick = {
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        val (deviceCode, timestamp, sign) = signedParts()
                                        val response = RetrofitClient.getService(context).subscribeMobilePlan(
                                            deviceCode,
                                            timestamp,
                                            sign,
                                            MobileSubscribeRequest(planId)
                                        )
                                        withContext(Dispatchers.Main) {
                                            if (response.isSuccessful) {
                                                onActionMessage("开通 $label 成功！")
                                                onRefresh()
                                            } else {
                                                onActionMessage(ApiErrorHelper.formatApiError(response, "订阅失败"))
                                            }
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) {
                                            onActionMessage("订阅请求出错: ${e.message}")
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CpBlueDark,
                                contentColor = Color.White,
                                disabledContainerColor = CpBlueDark.copy(alpha = 0.5f),
                                disabledContentColor = CpMuted
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) { Text(if (planId == "trial") "切换$label" else "开通$label", fontSize = 11.sp) }
                    }
                }
            }
        }

        // History Tab Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("充值历史", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = CpText)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf("my_recharge" to "我的充值", "incoming_recharge" to "代收充值").forEach { (key, label) ->
                    val selected = activeHistoryTab == key
                    Button(
                        onClick = { activeHistoryTab = key },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (selected) CpBlueDark else CpPanelSoft,
                            contentColor = if (selected) Color.White else CpMuted,
                            disabledContainerColor = CpPanelSoft,
                            disabledContentColor = CpMuted
                        ),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.height(28.dp)
                    ) { Text(label, fontSize = 10.sp) }
                }
            }
        }

        // History List
        val historyList = if (activeHistoryTab == "my_recharge") data.rechargeOrders else data.incomingRechargeOrders
        if (historyList.isEmpty()) {
            EmptyCard("暂无充值历史", "同步充值数据后会在这里显示。")
        } else {
            historyList.forEach { order ->
                RechargeRowItem(order = order)
            }
        }
    }
}

@Composable
fun ActiveRechargeCard(
    recharge: MobileRechargeData,
    onRefresh: () -> Unit,
    onCancel: () -> Unit,
    checkingStatus: Boolean
) {
    // Countdown timer state
    var timeLeftSeconds by remember { mutableStateOf(600) } // 10 minutes default
    val timeLabel = remember(timeLeftSeconds) {
        val minutes = timeLeftSeconds / 60
        val seconds = timeLeftSeconds % 60
        "%02d:%02d".format(minutes, seconds)
    }

    fun parseIsoDate(isoStr: String): java.util.Date? {
        return try {
            val clean = isoStr.replace("Z", "+0000").substringBefore(".")
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).parse(clean)
        } catch (e: Exception) {
            null
        }
    }

    LaunchedEffect(recharge.expired_at) {
        val expDate = parseIsoDate(recharge.expired_at)
        if (expDate != null) {
            while (true) {
                val diff = expDate.time - System.currentTimeMillis()
                timeLeftSeconds = if (diff <= 0) 0 else (diff / 1000).toInt()
                if (timeLeftSeconds == 0) break
                delay(1000)
            }
        }
    }

    PanelCard {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SectionTitle("待付充值订单", recharge.recharge_id)

            if (recharge.requires_manual_confirm) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF7F1D1D), RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    Text(
                        text = "⚠️ 平台收款手机未自动监听，付款后需管理员后台人工确认入账。",
                        color = Color(0xFFFCA5A5),
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Text(
                text = "应付金额: ¥${recharge.real_amount}",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = CpText
            )

            Text(
                text = if (timeLeftSeconds > 0) "请在 $timeLabel 内完成支付" else "订单已过期",
                color = if (timeLeftSeconds > 0) CpAmber else CpRed,
                fontSize = 12.sp
            )

            // Image display
            recharge.payment_code?.imageUrl?.let { imgUrl ->
                if (imgUrl.startsWith("data:image/")) {
                    DataUriImage(imgUrl)
                } else {
                    Text("无法加载二维码图片：不合法的 data url", fontSize = 11.sp, color = CpRed)
                }
            } ?: Text("无可用二维码", fontSize = 11.sp, color = CpSubtle)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onCancel,
                    colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("取消", fontSize = 12.sp) }

                Button(
                    onClick = onRefresh,
                    colors = ButtonDefaults.buttonColors(containerColor = CpBlue),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !checkingStatus
                ) {
                    Text(if (checkingStatus) "查询中..." else "刷新状态", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun RechargeRowItem(order: MobileRechargeOrder) {
    val status = order.displayStatus ?: order.status
    val color = statusColor(status)
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
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("充值单 ${order.id}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CpText)
                        if (order.requiresManualConfirm) {
                            Box(
                                modifier = Modifier
                                    .background(Color(0xFF581C87), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                            ) {
                                Text("需人工确认", fontSize = 8.sp, color = Color(0xFFE9D5FF), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Text("类型: ${payTypeLabel(order.payType)} · ${formatDate(order.createdAt)}", fontSize = 10.sp, color = CpSubtle)
                    order.rechargeUserEmail?.let {
                        Text("付款人: $it", fontSize = 10.sp, color = CpMuted)
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("¥${formatAmount(order.realAmount)}", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = color)
                    Box(
                        modifier = Modifier
                            .background(color.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(statusLabel(status), fontSize = 9.sp, color = color, fontWeight = FontWeight.Bold)
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
    else -> "免费调试版"
}
