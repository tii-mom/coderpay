package cn.coderpay.watcher.utils

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri

object PaymentLauncher {
    fun openUrl(context: Context, url: String?, onResult: (String) -> Unit) {
        val target = url?.trim().orEmpty()
        if (target.isBlank()) {
            onResult("暂无可打开的支付链接")
            return
        }

        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(target)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            onResult("已打开支付页面")
        } catch (e: Exception) {
            copyToClipboard(context, target)
            onResult("无法直接打开支付链接，已复制到剪贴板。${e.message ?: ""}")
        }
    }

    fun copyToClipboard(context: Context, text: String, label: String = "CoderPay") {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
    }
}
