package cn.coderpay.watcher.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class EventUploadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return if (EventSyncer.syncPending(applicationContext)) Result.success() else Result.retry()
    }
}
