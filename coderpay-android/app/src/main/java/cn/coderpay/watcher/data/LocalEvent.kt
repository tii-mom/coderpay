package cn.coderpay.watcher.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "local_events")
data class LocalEvent(
    @PrimaryKey
    val notificationHash: String, // MD5 idempotent identifier
    val payType: String,          // "wechat" or "alipay"
    val amount: Double,
    val receivedAt: Long,
    val rawText: String,
    val isUploaded: Boolean = false
)
