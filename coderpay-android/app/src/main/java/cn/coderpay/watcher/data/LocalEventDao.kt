package cn.coderpay.watcher.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface LocalEventDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertEvent(event: LocalEvent): Long

    @Query("SELECT * FROM local_events WHERE isUploaded = 0 ORDER BY receivedAt ASC")
    suspend fun getPendingEvents(): List<LocalEvent>

    @Query("UPDATE local_events SET isUploaded = 1 WHERE notificationHash = :hash")
    suspend fun markEventAsUploaded(hash: String)

    @Query("SELECT EXISTS(SELECT 1 FROM local_events WHERE notificationHash = :hash LIMIT 1)")
    suspend fun exists(hash: String): Boolean

    @Query("DELETE FROM local_events WHERE receivedAt < :beforeTimestamp")
    suspend fun deleteOldEvents(beforeTimestamp: Long)
}
