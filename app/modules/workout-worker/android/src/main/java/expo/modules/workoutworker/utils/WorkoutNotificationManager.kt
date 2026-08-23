package expo.modules.workoutworker.utils

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE
import expo.modules.workoutworker.R
import expo.modules.workoutworker.WorkoutConstants.getLaunchAppAtWorkoutPagePendingIntent


class WorkoutNotificationManager(private val context: Context) {

    companion object {
        const val PERSISTENT_NOTIFICATION_ID = 123
        const val REST_NOTIFICATION_ID = 1234

        const val PERSISTENT_CHANNEL_ID = "workout_channel"
        // Must match the channel created in notification-service.ts. v4 is silent
        // on purpose - RestAlarmReceiver plays the tone and vibration itself, so the
        // channel only carries the banner. Android applies no change of importance,
        // sound or audio attributes to a channel that already exists, which is why
        // each revision needed a new id.
        const val REST_CHANNEL_ID = "rest_channel_v4"
    }

    fun createWorkoutNotificationBuilder(): NotificationCompat.Builder {
        return NotificationCompat.Builder(context, PERSISTENT_CHANNEL_ID)
            .setContentTitle("LiftLog")
            .setForegroundServiceBehavior(FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(context.getLaunchAppAtWorkoutPagePendingIntent())
            .setSmallIcon(R.drawable.fitness_center_24px)
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
    }

    fun createRestNotificationBuilder(): NotificationCompat.Builder {
        return NotificationCompat.Builder(context, REST_CHANNEL_ID)
            .setForegroundServiceBehavior(FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(context.getLaunchAppAtWorkoutPagePendingIntent())
            .setSmallIcon(R.drawable.fitness_center_24px)
            .setOngoing(false)
            .setSilent(false)
            // This is an alarm going off, not an FYI: the category is what lets it
            // through a Do Not Disturb profile that still allows alarms, and it
            // matches the setAlarmClock booking that fires it.
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            // Deliberately NOT setOnlyAlertOnce: that flag suppresses the sound
            // whenever a notification with this id is already showing, so a
            // lingering "min rest over" banner silenced the "max rest over" ding
            // (and every ding of the next rest). It made sense only for the old
            // polling path, which re-posted this same id on every tick.
    }


    fun notifyPersistent(notification: android.app.Notification) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(PERSISTENT_NOTIFICATION_ID, notification)
    }

    fun notifyRest(notification: Notification) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(REST_NOTIFICATION_ID, notification)

    }

    fun clearPersistentNotification() {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(PERSISTENT_NOTIFICATION_ID)
    }

    fun clearRestNotification() {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(REST_NOTIFICATION_ID)
    }
}
