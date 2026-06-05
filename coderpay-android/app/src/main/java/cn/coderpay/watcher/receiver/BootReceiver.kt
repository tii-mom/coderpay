package cn.coderpay.watcher.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import cn.coderpay.watcher.service.ForegroundKeepAliveService
import cn.coderpay.watcher.utils.LogTracker

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            LogTracker.log("监听到系统开机广播，自动重启常驻监听探针服务...")
            ForegroundKeepAliveService.startService(context)
        }
    }
}
