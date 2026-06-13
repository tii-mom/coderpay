package cn.coderpay.watcher.screens

import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.coderpay.watcher.api.*
import cn.coderpay.watcher.screens.components.*
import cn.coderpay.watcher.utils.SettingsManager
import cn.coderpay.watcher.utils.SignatureHelper
import cn.coderpay.watcher.utils.ApiErrorHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun detectPaymentPayloadChannel(payload: String): String? {
    val text = payload.trim().lowercase()
    if (text.isBlank()) return null
    if (
        text.startsWith("wxp://") ||
        text.startsWith("weixin://") ||
        text.contains("tenpay.com") ||
        text.contains("wx.tenpay.com")
    ) {
        return "wechat"
    }
    if (
        text.startsWith("https://qr.alipay.com/") ||
        text.startsWith("http://qr.alipay.com/") ||
        text.startsWith("alipays://") ||
        text.contains("alipay.com")
    ) {
        return "alipay"
    }
    return null
}

private fun paymentPayloadChannelError(payType: String, payload: String): String? {
    val channel = detectPaymentPayloadChannel(payload) ?: return null
    return if (channel != payType) "二维码渠道与选择渠道不一致，请切换渠道或重新上传正确二维码" else null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentCodesScreen(
    data: MobileConsoleResponse,
    onRefresh: () -> Unit,
    scope: CoroutineScope,
    onActionMessage: (String) -> Unit
) {
    val context = LocalContext.current
    val settings = remember { SettingsManager(context) }

    // Form inputs
    var codePayType by remember { mutableStateOf("wechat") }
    var codeMode by remember { mutableStateOf("any") }
    var codeAmount by remember { mutableStateOf("9.90") }
    var uploadedCodeUrl by remember { mutableStateOf("") }
    var alipayUserId by remember { mutableStateOf("") }
    var qrPayload by remember { mutableStateOf("") }
    var directPayUrl by remember { mutableStateOf("") }
    var selectedDeviceId by remember { mutableStateOf(data.devices.find { it.deviceCode == settings.deviceCode }?.id ?: "") }

    // Filters
    var filterPayType by remember { mutableStateOf("all") }
    var filterStatus by remember { mutableStateOf("all") }
    var filterMode by remember { mutableStateOf("all") }

    // Dialogs / Sheet states
    var codeToDelete by remember { mutableStateOf<MobilePaymentCode?>(null) }
    var codeDetailShow by remember { mutableStateOf<MobilePaymentCode?>(null) }
    var isUploadingImg by remember { mutableStateOf(false) }

    fun signedParts(): Triple<String, String, String> {
        val timestamp = System.currentTimeMillis().toString()
        val sign = SignatureHelper.calculateSignature(
            settings.deviceCode,
            timestamp.toLong(),
            settings.deviceSecret
        )
        return Triple(settings.deviceCode, timestamp, sign)
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        isUploadingImg = true
        onActionMessage("正在解析并上传图片，请稍候...")
        scope.launch(Dispatchers.IO) {
            try {
                val type = context.contentResolver.getType(uri) ?: "image/png"
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: ByteArray(0)
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val (deviceCode, timestamp, sign) = signedParts()
                val response = RetrofitClient.getService(context).uploadMobilePaymentCode(
                    deviceCode,
                    timestamp,
                    sign,
                    MobilePaymentCodeUploadRequest(type, base64)
                )
                withContext(Dispatchers.Main) {
                    isUploadingImg = false
                    if (response.isSuccessful && response.body() != null) {
                        uploadedCodeUrl = response.body()!!.url
                        onActionMessage("收款码图片上传成功。若这是固定金额码，请选择固定金额并填写金额后再创建。")
                    } else {
                        onActionMessage(ApiErrorHelper.formatApiError(response, "上传图片失败"))
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    isUploadingImg = false
                    onActionMessage("图片处理异常: ${e.message}")
                }
            }
        }
    }

    // Filter payments
    val filteredCodes = data.paymentCodes.filter { code ->
        val matchType = filterPayType == "all" || code.type == filterPayType
        val matchStatus = filterStatus == "all" || code.status == filterStatus
        val matchMode = filterMode == "all" || code.codeType == filterMode
        matchType && matchStatus && matchMode
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Create Code Form Card
        PanelCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionTitle("新增收款码通道", "Create Channel")

                // PayType toggle
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("wechat" to "微信", "alipay" to "支付宝").forEach { (key, label) ->
                        Button(
                            onClick = { codePayType = key },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (codePayType == key) CpBlueDark else CpPanelSoft,
                                contentColor = Color.White,
                                disabledContainerColor = CpPanelSoft,
                                disabledContentColor = CpMuted
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) { Text(label, fontSize = 11.sp) }
                    }
                }

                // Mode toggle
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("any" to "通用码", "fixed" to "固定金额").forEach { (key, label) ->
                        Button(
                            onClick = { codeMode = key },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (codeMode == key) CpBlueDark else CpPanelSoft,
                                contentColor = Color.White,
                                disabledContainerColor = CpPanelSoft,
                                disabledContentColor = CpMuted
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) { Text(label, fontSize = 11.sp) }
                    }
                }

                if (codeMode == "fixed") {
                    OutlinedTextField(
                        value = codeAmount,
                        onValueChange = { codeAmount = it },
                        label = { Text("固定收款金额") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                if (codePayType == "alipay") {
                    OutlinedTextField(
                        value = alipayUserId,
                        onValueChange = { alipayUserId = it },
                        label = { Text("支付宝 PID（选填，用于直达转账）") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                OutlinedTextField(
                    value = qrPayload,
                    onValueChange = { qrPayload = it },
                    label = { Text("二维码解析 Payload / 收款链接") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 1
                )

                OutlinedTextField(
                    value = directPayUrl,
                    onValueChange = { directPayUrl = it },
                    label = { Text("直达支付 URL Scheme") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 1
                )

                // Select Device to bind
                if (data.devices.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF7F1D1D), RoundedCornerShape(8.dp))
                            .padding(8.dp)
                    ) {
                        Text("⚠️ 暂无可绑定监听设备，请前往设备中心绑定。", color = Color(0xFFFCA5A5), fontSize = 11.sp)
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("绑定监听设备:", fontSize = 12.sp, color = CpMuted)
                        Box {
                            var expanded by remember { mutableStateOf(false) }
                            val currentDev = data.devices.find { it.id == selectedDeviceId }
                            Button(
                                onClick = { expanded = true },
                                colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                modifier = Modifier.height(28.dp)
                            ) {
                                Text(currentDev?.name ?: "选择设备", fontSize = 11.sp)
                            }
                            DropdownMenu(
                                expanded = expanded,
                                onDismissRequest = { expanded = false },
                                modifier = Modifier.background(CpPanel)
                            ) {
                                data.devices.forEach { dev ->
                                    DropdownMenuItem(
                                        text = { Text(dev.name, color = CpText, fontSize = 12.sp) },
                                        onClick = {
                                            selectedDeviceId = dev.id
                                            expanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }

                Text(
                    text = if (uploadedCodeUrl.isBlank()) "尚未选择收款二维码图片" else "图片已就绪",
                    fontSize = 11.sp,
                    color = if (uploadedCodeUrl.isBlank()) CpAmber else CpGreen
                )
                if (uploadedCodeUrl.isNotBlank()) {
                    Text(
                        text = "App 端不会自动识别图片中的固定金额。固定金额码请手动选择固定金额并填写金额；通用码可保持通用码。",
                        fontSize = 10.sp,
                        color = CpAmber
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { imagePicker.launch("image/*") },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CpPanelSoft, contentColor = CpText),
                        shape = RoundedCornerShape(12.dp),
                        enabled = !isUploadingImg
                    ) { Text("选择二维码") }

                    Button(
                        onClick = {
                            if (uploadedCodeUrl.isBlank()) {
                                onActionMessage("请先选择并上传收款码图片")
                                return@Button
                            }
                            val amount = if (codeMode == "fixed") codeAmount.toDoubleOrNull() ?: 0.0 else 0.0
                            if (codeMode == "fixed" && amount <= 0.0) {
                                onActionMessage("固定金额模式金额必须大于 0")
                                return@Button
                            }
                            val channelError = paymentPayloadChannelError(codePayType, qrPayload)
                                ?: paymentPayloadChannelError(codePayType, directPayUrl)
                            if (channelError != null) {
                                onActionMessage(channelError)
                                return@Button
                            }
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val (deviceCode, timestamp, sign) = signedParts()
                                    val response = RetrofitClient.getService(context).createMobilePaymentCode(
                                        deviceCode = deviceCode,
                                        timestamp = timestamp,
                                        sign = sign,
                                        request = MobilePaymentCodeCreateRequest(
                                            type = codePayType,
                                            codeType = codeMode,
                                            amount = amount,
                                            imageUrl = uploadedCodeUrl,
                                            deviceId = selectedDeviceId.ifBlank { null },
                                            alipayUserId = alipayUserId.ifBlank { null },
                                            qrPayload = qrPayload.ifBlank { null },
                                            directPayUrl = directPayUrl.ifBlank { null }
                                        )
                                    )
                                    withContext(Dispatchers.Main) {
                                        if (response.isSuccessful) {
                                            uploadedCodeUrl = ""
                                            qrPayload = ""
                                            directPayUrl = ""
                                            onActionMessage("收款码通道创建成功。")
                                            onRefresh()
                                        } else {
                                            onActionMessage(ApiErrorHelper.formatApiError(response, "创建失败"))
                                        }
                                    }
                                } catch (e: Exception) {
                                    withContext(Dispatchers.Main) {
                                        onActionMessage("新增收款码出错: ${e.message}")
                                    }
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CpGreen, contentColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        enabled = uploadedCodeUrl.isNotBlank() && selectedDeviceId.isNotBlank()
                    ) { Text("创建通道") }
                }
            }
        }

        // Filters UI
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Status filter
            listOf("all" to "全部状态", "active" to "启用中", "inactive" to "已停用").forEach { (key, label) ->
                val active = filterStatus == key
                FilterChip(
                    selected = active,
                    onClick = { filterStatus = key },
                    label = { Text(label, fontSize = 10.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CpPanelSoft, selectedContainerColor = CpBlueDark,
                        labelColor = CpMuted, selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // PayType filter
            listOf("all" to "全部渠道", "wechat" to "微信", "alipay" to "支付宝").forEach { (key, label) ->
                val active = filterPayType == key
                FilterChip(
                    selected = active,
                    onClick = { filterPayType = key },
                    label = { Text(label, fontSize = 10.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CpPanelSoft, selectedContainerColor = CpBlue,
                        labelColor = CpMuted, selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // CodeType filter
            listOf("all" to "全部类型", "any" to "通用码", "fixed" to "固定金额").forEach { (key, label) ->
                val active = filterMode == key
                FilterChip(
                    selected = active,
                    onClick = { filterMode = key },
                    label = { Text(label, fontSize = 10.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CpPanelSoft, selectedContainerColor = CpAmberDark,
                        labelColor = CpMuted, selectedLabelColor = Color.White
                    ),
                    border = null
                )
            }
        }

        // List
        if (filteredCodes.isEmpty()) {
            EmptyCard("暂无收款码通道", "在此过滤条件下，没有配置收款码通道。")
        } else {
            filteredCodes.forEach { code ->
                PaymentCodeRowCard(
                    code = code,
                    devicesList = data.devices,
                    onClick = { codeDetailShow = code },
                    onToggle = {
                        scope.launch(Dispatchers.IO) {
                            try {
                                val (deviceCode, timestamp, sign) = signedParts()
                                val nextStatus = if (code.status == "active") "inactive" else "active"
                                val response = RetrofitClient.getService(context).updateMobilePaymentCode(
                                    deviceCode = deviceCode,
                                    timestamp = timestamp,
                                    sign = sign,
                                    id = code.id,
                                    request = MobilePaymentCodeUpdateRequest(status = nextStatus)
                                )
                                withContext(Dispatchers.Main) {
                                    if (response.isSuccessful) {
                                        onActionMessage("收款码通道状态已更新。")
                                        onRefresh()
                                    } else {
                                        onActionMessage(ApiErrorHelper.formatApiError(response, "更新失败"))
                                    }
                                }
                            } catch (e: Exception) {
                                withContext(Dispatchers.Main) {
                                    onActionMessage("更新请求出错: ${e.message}")
                                }
                            }
                        }
                    },
                    onDelete = { codeToDelete = code }
                )
            }
        }

        // Delete Alert Dialog
        codeToDelete?.let {
            AlertDialog(
                onDismissRequest = { codeToDelete = null },
                title = { Text("确认删除通道？") },
                text = { Text("通道删除后系统将不再调度此二维码。此操作不可逆。") },
                confirmButton = {
                    TextButton(onClick = {
                        val target = codeToDelete!!
                        codeToDelete = null
                        scope.launch(Dispatchers.IO) {
                            try {
                                val (deviceCode, timestamp, sign) = signedParts()
                                val response = RetrofitClient.getService(context).deleteMobilePaymentCode(
                                    deviceCode,
                                    timestamp,
                                    sign,
                                    target.id
                                )
                                withContext(Dispatchers.Main) {
                                    if (response.isSuccessful) {
                                        onActionMessage("收款码已成功删除。")
                                        onRefresh()
                                    } else {
                                        onActionMessage(ApiErrorHelper.formatApiError(response, "删除失败"))
                                    }
                                }
                            } catch (e: Exception) {
                                withContext(Dispatchers.Main) {
                                    onActionMessage("删除请求出错: ${e.message}")
                                }
                            }
                        }
                    }) { Text("确认删除", color = CpRed) }
                },
                dismissButton = {
                    TextButton(onClick = { codeToDelete = null }) { Text("取消") }
                }
            )
        }

        // Detail Dialog
        codeDetailShow?.let { code ->
            AlertDialog(
                onDismissRequest = { codeDetailShow = null },
                title = { Text("${payTypeLabel(code.type)} 收款码详情") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val deviceName = data.devices.find { it.id == code.deviceId }?.name ?: "未绑定"
                        Text("绑定设备: $deviceName", fontSize = 12.sp, color = CpText)
                        Text("金额模式: ${if (code.codeType == "fixed") "固定金额 ¥${formatAmount(code.amount)}" else "通用码"}", fontSize = 12.sp, color = CpText)
                        code.alipayUserId?.let {
                            Text("支付宝 PID: $it", fontSize = 11.sp, color = CpMuted)
                        }
                        code.qrPayload?.let {
                            Text("QR Payload: $it", fontSize = 11.sp, color = CpMuted)
                        }
                        code.directPayUrl?.let {
                            Text("直达支付 URL: $it", fontSize = 11.sp, color = CpMuted)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        if (code.imageUrl.startsWith("data:image/")) {
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                DataUriImage(dataUri = code.imageUrl)
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { codeDetailShow = null }) { Text("关闭") }
                }
            )
        }
    }
}

@Composable
fun PaymentCodeRowCard(
    code: MobilePaymentCode,
    devicesList: List<MobileDevice>,
    onClick: () -> Unit,
    onToggle: () -> Unit,
    onDelete: () -> Unit
) {
    val devName = devicesList.find { it.id == code.deviceId }?.name ?: code.deviceName ?: "未绑定"
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
                    Text("${payTypeLabel(code.type)} ${if (code.codeType == "fixed") "固定金额" else "通用码"}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = CpText)
                    Text("绑定设备: $devName · 创建于 ${formatDate(code.createdAt)}", fontSize = 10.sp, color = CpSubtle, maxLines = 1)
                }
                Text(
                    text = if (code.amount > 0) "¥${formatAmount(code.amount)}" else "通用金额",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = if (code.status == "active") CpGreen else CpSubtle
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onToggle,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (code.status == "active") CpAmberDark else CpGreen,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) { Text(if (code.status == "active") "停用通道" else "开启通道", fontSize = 11.sp) }

                Button(
                    onClick = onDelete,
                    colors = ButtonDefaults.buttonColors(containerColor = CpRed),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = "删除", tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}
