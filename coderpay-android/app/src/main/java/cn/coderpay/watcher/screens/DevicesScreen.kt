package cn.coderpay.watcher.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.coderpay.watcher.api.MobileConsoleResponse
import cn.coderpay.watcher.api.MobileDevice
import cn.coderpay.watcher.api.RetrofitClient
import cn.coderpay.watcher.screens.components.*
import cn.coderpay.watcher.utils.SettingsManager
import cn.coderpay.watcher.utils.SignatureHelper
import cn.coderpay.watcher.utils.ApiErrorHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun DevicesScreen(
    data: MobileConsoleResponse,
    onRefresh: () -> Unit,
    scope: CoroutineScope,
    onActionMessage: (String) -> Unit,
    isNotificationPermissionGranted: Boolean,
    isListenerBound: Boolean,
    isBatteryOptimizedIgnored: Boolean
) {
    val context = LocalContext.current
    val settings = remember { SettingsManager(context) }

    fun signedParts(): Triple<String, String, String> {
        val timestamp = System.currentTimeMillis().toString()
        val sign = SignatureHelper.calculateSignature(
            settings.deviceCode,
            timestamp.toLong(),
            settings.deviceSecret
        )
        return Triple(settings.deviceCode, timestamp, sign)
    }

    val currentDevice = data.devices.find { it.deviceCode == settings.deviceCode }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Current Device Local Health panel
        PanelCard {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                SectionTitle("本机健康状态", "Local Status")

                LocalHealthRow("通知读取权限", if (isNotificationPermissionGranted) "已授权" else "未授权", isNotificationPermissionGranted)
                LocalHealthRow("系统电池优化", if (isBatteryOptimizedIgnored) "已豁免" else "待优化", isBatteryOptimizedIgnored)
                LocalHealthRow("保活后台服务", if (settings.isBound) "运行中" else "未启动", settings.isBound)

                val isListenerRunning = isListenerBound && isNotificationPermissionGranted
                LocalHealthRow("微信到账监听", if (isListenerRunning) "运行中" else "已停止", isListenerRunning)
                LocalHealthRow("支付宝到账监听", if (isListenerRunning) "运行中" else "已停止", isListenerRunning)

                currentDevice?.let { dev ->
                    LocalHealthRow("今日事件总数", "${dev.todayEventCount} 次", true)
                    LocalHealthRow("今日匹配成功", "${dev.todayMatchCount} 次", dev.todayMatchCount > 0)
                }
            }
        }

        // Current Device Secret Card
        PanelCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionTitle("设备安全密钥", "Security")
                Text("安全密钥用于到账事件签名。若泄漏，请在此重置。重置会立即使旧绑定失效，本机将自动同步保存新密钥。", fontSize = 11.sp, color = CpMuted, lineHeight = 16.sp)
                Button(
                    onClick = {
                        scope.launch(Dispatchers.IO) {
                            try {
                                val (deviceCode, timestamp, sign) = signedParts()
                                val response = RetrofitClient.getService(context).resetMobileDeviceSecret(deviceCode, timestamp, sign)
                                withContext(Dispatchers.Main) {
                                    if (response.isSuccessful && !response.body()?.deviceSecret.isNullOrBlank()) {
                                        settings.deviceSecret = response.body()!!.deviceSecret!!
                                        onActionMessage("密钥重置成功！")
                                        onRefresh()
                                    } else {
                                        onActionMessage(ApiErrorHelper.formatApiError(response, "密钥重置失败"))
                                    }
                                }
                            } catch (e: Exception) {
                                withContext(Dispatchers.Main) {
                                    onActionMessage("密钥重置异常: ${e.message}")
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = CpAmberDark, contentColor = Color.White),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("重置当前设备密钥", fontSize = 12.sp) }
            }
        }

        // Title for all devices list
        Text(
            text = "我的设备列表 (${data.devices.size})",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = CpText
        )

        // Devices List
        data.devices.forEach { device ->
            val isCurrent = device.deviceCode == settings.deviceCode
            DeviceRowCard(device = device, isCurrent = isCurrent)
        }
    }
}

@Composable
fun LocalHealthRow(label: String, value: String, isOk: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 12.sp, color = CpMuted)
        Text(
            text = value,
            fontSize = 12.sp,
            color = if (isOk) CpGreen else CpAmber,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun DeviceRowCard(device: MobileDevice, isCurrent: Boolean) {
    val statusColor = if (device.online) CpGreen else CpAmber
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CpPanel),
        border = if (isCurrent) BorderStroke(1.dp, CpBlue) else null,
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
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(device.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = CpText)
                        if (isCurrent) {
                            Box(
                                modifier = Modifier
                                    .background(CpBlue.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                            ) {
                                Text("当前设备", fontSize = 8.sp, color = CpBlue, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Text("编号: ${device.deviceCode}", fontSize = 11.sp, color = CpSubtle)
                }

                Box(
                    modifier = Modifier
                        .background(statusColor.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (device.online) "在线" else "离线",
                        fontSize = 10.sp,
                        color = statusColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Divider(color = CpPanelSoft, thickness = 1.dp)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("最近心跳: ${formatOptionalDate(device.lastHeartbeat)}", fontSize = 10.sp, color = CpMuted)
                    Text("微信: ${if (device.wechatListener == "running") "监听中" else "未开启"} · 支付宝: ${if (device.alipayListener == "running") "监听中" else "未开启"}", fontSize = 10.sp, color = CpSubtle)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("今日匹配 / 事件", fontSize = 9.sp, color = CpSubtle)
                    Text("${device.todayMatchCount} / ${device.todayEventCount}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CpText)
                }
            }
        }
    }
}
