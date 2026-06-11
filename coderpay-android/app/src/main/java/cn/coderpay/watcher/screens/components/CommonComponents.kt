package cn.coderpay.watcher.screens.components

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

fun formatAmount(value: Double): String = "%.2f".format(value)

fun formatDate(value: String): String = value.replace("T", " ").take(16)

fun formatOptionalDate(value: String?): String = value?.replace("T", " ")?.take(16) ?: "--"

fun payTypeLabel(value: String): String = when (value) {
    "wechat" -> "微信"
    "alipay" -> "支付宝"
    else -> value
}

fun statusLabel(value: String): String = when (value) {
    "pending" -> "待支付"
    "success" -> "已成功"
    "paid" -> "已到账"
    "expired" -> "已过期"
    "failed" -> "失败"
    "manual_review" -> "人工审核"
    else -> value
}

fun statusColor(value: String): Color = when (value) {
    "success", "paid" -> CpGreen
    "pending" -> CpAmber
    "failed", "expired" -> CpRed
    else -> CpSubtle
}

@Composable
fun PanelCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CpPanel),
        shape = RoundedCornerShape(20.dp)
    ) {
        content()
    }
}

@Composable
fun SectionTitle(title: String, caption: String) {
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
fun MetricRow(title: String, value: String, caption: String) {
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
fun NativeListCard(
    title: String,
    primary: String,
    secondary: String,
    meta: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
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
fun EmptyCard(title: String, caption: String = "") {
    PanelCard {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = CpText)
            if (caption.isNotBlank()) {
                Text(caption, fontSize = 11.sp, color = CpMuted, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
fun DataUriImage(dataUri: String, modifier: Modifier = Modifier) {
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
            modifier = modifier
                .size(220.dp)
                .background(Color.White, RoundedCornerShape(16.dp))
                .padding(10.dp)
        )
    } else {
        Text("二维码图片解析失败。", fontSize = 11.sp, color = CpRed)
    }
}
