package expo.modules.trainerwidget

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Scheduling: one hourly fetch kept unique across reinstalls, an immediate fetch that
 * replaces any pending immediate one, and a delayed fetch after a backup under its own
 * name, so opening the app right after a backup cannot cancel it. */
object WidgetWork {
    const val PERIODIC = "trainer-widget-periodic"
    const val NOW = "trainer-widget-now"
    const val AFTER_BACKUP = "trainer-widget-after-backup"
    const val AFTER_BACKUP_DELAY_S = 90L

    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedulePeriodic(ctx: Context) {
        val request = PeriodicWorkRequestBuilder<WidgetFetchWorker>(1, TimeUnit.HOURS, 15, TimeUnit.MINUTES)
            .setConstraints(online)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun refreshNow(ctx: Context) = enqueue(ctx, NOW, 0)

    /** The trainer needs up to a minute or two to rewrite the file after a backup lands. */
    fun refreshAfterBackup(ctx: Context) = enqueue(ctx, AFTER_BACKUP, AFTER_BACKUP_DELAY_S)

    private fun enqueue(ctx: Context, name: String, delaySeconds: Long) {
        val request = OneTimeWorkRequestBuilder<WidgetFetchWorker>()
            .setConstraints(online)
            .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(ctx).enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, request)
    }
}
