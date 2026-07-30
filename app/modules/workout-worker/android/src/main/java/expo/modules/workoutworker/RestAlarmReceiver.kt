package expo.modules.workoutworker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import expo.modules.workoutworker.utils.WorkoutNotificationManager

/**
 * Fired by [expo.modules.workoutworker.utils.RestAlarmScheduler] at a rest
 * milestone. Posts the audible rest_channel notification. Runs even when the app
 * process is otherwise idle, which is the whole point - the ding no longer depends
 * on the polling timer staying awake.
 */
class RestAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_REST_ALARM) return
        val title = intent.getStringExtra(EXTRA_TITLE) ?: return

        val notificationManager = WorkoutNotificationManager(context)
        // Clear any still-showing rest banner first. setTimeoutAfter below is not
        // reliably dismissing it (one was observed alive 5+ minutes after firing),
        // and posting onto a live id makes this an *update*, which Android alerts
        // for far less aggressively than a fresh post.
        notificationManager.clearRestNotification()
        val notification = notificationManager.createRestNotificationBuilder()
            .setContentTitle(title)
            // Auto-dismiss so a stale "rest over" banner doesn't linger; mirrors the
            // 10s clear the polling path used to do.
            .setTimeoutAfter(REST_NOTIFICATION_TIMEOUT_MS)
            .build()
        notificationManager.notifyRest(notification)
    }

    companion object {
        const val ACTION_REST_ALARM = "expo.modules.workoutworker.REST_ALARM"
        const val EXTRA_TITLE = "title"
        private const val REST_NOTIFICATION_TIMEOUT_MS = 10_000L
    }
}
