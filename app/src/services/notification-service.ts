import { RootState } from '@/store';
import { OffsetDateTime } from '@js-joda/core';
import { Dispatch } from '@reduxjs/toolkit';
import {
  AndroidImportance,
  AndroidNotificationVisibility,
  deleteNotificationChannelAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

if (Platform.OS === 'android') {
  void setNotificationChannelAsync('workout_channel', {
    name: 'Workout',
    description:
      'A persistent notification showing your time throughout the workout',
    importance: AndroidImportance.HIGH,
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
  // The rest ding has been through several channels. The short version of what
  // each one taught us:
  //   'rest_channel'    - DEFAULT importance, so it never woke the screen.
  //   'rest_channel_v2' - HIGH importance, but USAGE_NOTIFICATION, so the tone came
  //                       out of the notification stream, far quieter than media.
  //   'rest_channel_v3' - USAGE_ALARM. Still inaudible: the notification was posted
  //                       dead on time (confirmed in logcat) and Android simply
  //                       declined to alert for it, with DND off, cooldown off and
  //                       no listener hints. NotificationManagerService applies
  //                       around a dozen mute rules of its own and there is no way
  //                       for an app to force past them.
  //   'rest_channel_v4' - silent by design. RestAlarmReceiver now plays the tone
  //                       and the vibration itself, so the channel only has to
  //                       carry the banner. sound: null and enableVibrate: false
  //                       keep the system from adding a second, competing alert.
  // Android applies none of importance, sound or audio attributes to a channel that
  // already exists, so each change needs a fresh id and a cleanup of the old ones.
  void deleteNotificationChannelAsync('rest_channel');
  void deleteNotificationChannelAsync('rest_channel_v2');
  void deleteNotificationChannelAsync('rest_channel_v3');
  void setNotificationChannelAsync('rest_channel_v4', {
    name: 'Rest Notifications',
    description: 'A notification alerting you that your rest is over',
    importance: AndroidImportance.HIGH,
    enableVibrate: false,
    showBadge: true,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: null,
  });
}
/**
 * Notification service is used for displaying dumb notifications through expo notifications
 * Only relevant for iOS, android uses richer notifications via WorkoutWorker
 */
export class NotificationService {
  constructor(
    readonly getState: () => RootState,
    readonly dispatch: Dispatch,
  ) {}

  async scheduleNextSetNotification(time: OffsetDateTime) {}

  async clearSetTimerNotification() {}
}
