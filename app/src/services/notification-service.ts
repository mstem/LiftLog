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
  // v2: the original 'rest_channel' was created at DEFAULT importance, which
  // plays a sound but never wakes the screen - so with the phone locked the
  // "rest over" alert was only discovered on unlock. Android ignores importance
  // changes to an existing channel, so raising it requires a new channel id.
  void deleteNotificationChannelAsync('rest_channel');
  void setNotificationChannelAsync('rest_channel_v2', {
    name: 'Rest Notifications',
    description: 'A notification alerting you that your rest is over',
    importance: AndroidImportance.HIGH,
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
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
