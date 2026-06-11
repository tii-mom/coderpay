package cn.coderpay.watcher.service

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationParserTest {
    private val wechatRegex = "微信支付收款|微信收款|收到付款|微信支付.*元"
    private val alipayRegex = "支付宝成功收款|收钱码收款|成功往账户转入|你已成功收款|支付宝.*元.*(收款|到账)"

    @Test
    fun parsesWeChatPaymentNotifications() {
        val title = "微信支付收款"
        val text = "收款到账￥19.88元"

        assertTrue(NotificationParser.isWeChatConfirm(title, text, wechatRegex))
        assertEquals(19.88, NotificationParser.extractAmount("$title $text")!!, 0.001)
    }

    @Test
    fun parsesAlipayPaymentNotifications() {
        val title = "支付宝通知"
        val text = "收钱码收款 8.80 元"

        assertTrue(NotificationParser.isAlipayConfirm(title, text, alipayRegex))
        assertEquals(8.80, NotificationParser.extractAmount("$title $text")!!, 0.001)
    }

    @Test
    fun ignoresNonPaymentMessages() {
        val title = "微信支付"
        val text = "你的账单已生成，本月共 3 笔"

        assertFalse(NotificationParser.isWeChatConfirm(title, text, wechatRegex))
    }
}
