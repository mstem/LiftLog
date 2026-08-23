package expo.modules.workoutworker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import expo.modules.workoutworker.utils.WorkoutNotificationManager

/**
 * Fired by [expo.modules.workoutworker.utils.RestAlarmScheduler] at a rest
 * milestone. Posts the rest notification and makes the noise itself.
 *
 * The sound is deliberately NOT left to the notification channel. Posting a
 * notification only *asks* Android to alert; NotificationManagerService then runs
 * around a dozen mute rules of its own before anything reaches the speaker, and on
 * a Pixel with Do Not Disturb off, cooldown disabled, no listener hints and the
 * channel at IMPORTANCE_HIGH it was still declining to alert. There is no way for
 * an app to force past that, so the receiver owns the audio and the notification
 * is only there to be seen.
 *
 * onReceive holds a wake lock for its duration and goAsync() extends that lock
 * until finish(), which is what lets the tone start with the screen off.
 */
class RestAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "onReceive action=${intent.action} at=${System.currentTimeMillis()}")
        if (intent.action != ACTION_REST_ALARM) {
            Log.w(TAG, "ignoring unexpected action ${intent.action}")
            return
        }
        val title = intent.getStringExtra(EXTRA_TITLE)
        if (title == null) {
            Log.w(TAG, "no title extra; nothing posted")
            return
        }

        val notificationManager = WorkoutNotificationManager(context)
        val notification = notificationManager.createRestNotificationBuilder()
            .setContentTitle(title)
            // Long enough to still be on the lock screen when the phone is picked
            // up mid-rest. At 10s it had always cleared itself by then, which made
            // a ding that did fire look like one that never happened.
            .setTimeoutAfter(REST_NOTIFICATION_TIMEOUT_MS)
            .build()
        notificationManager.notifyRest(notification)
        Log.d(TAG, "posted rest notification '$title'")

        vibrate(context)
        alert(context, goAsync())
    }

    private fun vibrate(context: Context) {
        try {
            val vibrator = context.getSystemService(VibratorManager::class.java)
                ?.defaultVibrator ?: context.getSystemService(Vibrator::class.java)
            vibrator?.vibrate(
                VibrationEffect.createWaveform(VIBRATION_PATTERN, -1),
                alarmAttributes()
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to vibrate", e)
        }
    }

    private fun alarmAttributes(): AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

    private fun alert(context: Context, pendingResult: PendingResult) {
        val attributes = alarmAttributes()
        val audioManager = context.getSystemService(AudioManager::class.java)
        // Duck whatever is playing rather than compete with it - the point is to be
        // heard while the user has music on.
        val focusRequest = AudioFocusRequest
            .Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attributes)
            .build()
        audioManager?.requestAudioFocus(focusRequest)
        Log.d(TAG, "alerting, alarm volume=" +
            "${audioManager?.getStreamVolume(AudioManager.STREAM_ALARM)}/" +
            "${audioManager?.getStreamMaxVolume(AudioManager.STREAM_ALARM)}")

        val ringtone = playRingtone(context, attributes)
        val tone = if (ringtone == null) playSynthesizedTone() else null

        // Both players are asynchronous, so tear everything down on a timer rather
        // than a completion callback. finish() releases the broadcast wake lock and
        // must run exactly once.
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                ringtone?.stop()
                tone?.release()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop alert", e)
            }
            audioManager?.abandonAudioFocusRequest(focusRequest)
            pendingResult.finish()
        }, ALERT_DURATION_MS)
    }

    /**
     * Plays the user's notification tone through [Ringtone], which hands the URI to
     * the system's ringtone player. That indirection is the whole reason to use it:
     * MediaPlayer.setDataSource on the same URI fails with
     * `IOException: setDataSource failed.: status=0x80000000`, because an app has no
     * read access to the settings/media provider that holds the tone.
     *
     * Returns null when there is nothing to play - including when the user has set
     * their notification sound to "None" - so the caller can fall back.
     */
    private fun playRingtone(context: Context, attributes: AudioAttributes): Ringtone? {
        return try {
            val uri = RingtoneManager
                .getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
                ?: RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
                ?: return null.also { Log.w(TAG, "no default tone configured") }
            RingtoneManager.getRingtone(context, uri)?.apply {
                audioAttributes = attributes
                play()
                Log.d(TAG, "ringtone playing uri=$uri")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play ringtone", e)
            null
        }
    }

    /**
     * Last resort when there is no tone to play: a synthesized beep on the alarm
     * stream. It reads no files and touches no content provider, so there is
     * nothing left for it to fail on.
     */
    private fun playSynthesizedTone(): ToneGenerator? {
        return try {
            ToneGenerator(AudioManager.STREAM_ALARM, ToneGenerator.MAX_VOLUME).apply {
                startTone(ToneGenerator.TONE_PROP_BEEP2, SYNTHESIZED_TONE_MS)
                Log.d(TAG, "synthesized tone playing")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play synthesized tone", e)
            null
        }
    }

    companion object {
        private const val TAG = "RestAlarm"
        const val ACTION_REST_ALARM = "expo.modules.workoutworker.REST_ALARM"
        const val EXTRA_TITLE = "title"
        private const val REST_NOTIFICATION_TIMEOUT_MS = 60_000L
        private const val ALERT_DURATION_MS = 4_000L
        private const val SYNTHESIZED_TONE_MS = 1_000
        private val VIBRATION_PATTERN = longArrayOf(0, 350, 200, 350)
    }
}
