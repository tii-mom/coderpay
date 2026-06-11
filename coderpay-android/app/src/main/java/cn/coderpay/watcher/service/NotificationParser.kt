package cn.coderpay.watcher.service

import java.util.regex.Pattern

object NotificationParser {
    private val amountPattern = Pattern.compile("[¥￥]?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*(?:元)?")
    private val semanticAmountPatterns = listOf(
        Pattern.compile("(?:收款|到账|转入|付款)[^\\d¥￥]{0,12}[¥￥]?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*(?:元)?"),
        Pattern.compile("[¥￥]?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*(?:元)?[^，。；\\s]{0,12}(?:收款|到账|转入|付款)"),
        Pattern.compile("(?:收款|到账|转入|付款)[^\\d]{0,12}(\\d+(?:\\.\\d{1,2})?)\\s*元"),
        Pattern.compile("(\\d+(?:\\.\\d{1,2})?)\\s*元[^，。；\\s]{0,12}(?:收款|到账|转入|付款)")
    )

    fun isWeChatConfirm(title: String, text: String, regexStr: String): Boolean {
        val content = "$title $text"
        return try {
            Pattern.compile(regexStr).matcher(content).find()
        } catch (_: Exception) {
            content.contains("微信支付收款") ||
                content.contains("微信收款") ||
                content.contains("收到付款") ||
                (content.contains("微信支付") && (content.contains("元") || content.contains("¥") || content.contains("￥")))
        }
    }

    fun isAlipayConfirm(title: String, text: String, regexStr: String): Boolean {
        val content = "$title $text"
        return try {
            Pattern.compile(regexStr).matcher(content).find()
        } catch (_: Exception) {
            content.contains("支付宝成功收款") ||
                content.contains("收钱码收款") ||
                content.contains("成功往账户转入") ||
                content.contains("你已成功收款") ||
                (content.contains("支付宝") && content.contains("元") && (content.contains("收款") || content.contains("到账")))
        }
    }

    fun extractAmount(text: String): Double? {
        for (pattern in semanticAmountPatterns) {
            val semanticMatcher = pattern.matcher(text)
            if (semanticMatcher.find()) {
                return semanticMatcher.group(1)?.toDoubleOrNull()
            }
        }

        val matcher = amountPattern.matcher(text)
        var lastMatch: String? = null
        while (matcher.find()) {
            lastMatch = matcher.group(1)
        }
        return lastMatch?.toDoubleOrNull()
    }
}
