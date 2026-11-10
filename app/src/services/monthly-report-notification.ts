import { YearMonth } from '@js-joda/core';
import {
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
} from 'expo-notifications';
import { monthlyReportUrl } from '@/models/monthly-report-schedule';

export const monthlyReportChannelId = 'monthly_report_channel';
const idPrefix = 'monthly-report-';

/**
 * Schedules the report for `month`, replacing that month's earlier one. Each
 * month has its own id, so a workout early on the 1st cannot replace the
 * report for the month just ended before it goes out.
 */
export async function scheduleMonthlyReport(args: {
  month: YearMonth;
  at: Date;
  title: string;
  body: string;
}) {
  const identifier = idPrefix + args.month.toString();
  // A date trigger in the past fires at once. Once 09:00 has gone by, the
  // queued report has gone out or is about to: leave it, and queue no copy.
  if (args.at.getTime() <= Date.now()) {
    return;
  }
  await cancelScheduledNotificationAsync(identifier);
  await scheduleNotificationAsync({
    identifier,
    content: {
      title: args.title,
      body: args.body,
      data: { url: monthlyReportUrl(args.month) },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: args.at,
      channelId: monthlyReportChannelId,
    },
  });
}

/** Cancels one month's report, or every report still waiting to go out. */
export async function cancelMonthlyReport(month?: YearMonth) {
  if (month) {
    await cancelScheduledNotificationAsync(idPrefix + month.toString());
    return;
  }
  const scheduled = await getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((x) => x.identifier.startsWith(idPrefix))
      .map((x) => cancelScheduledNotificationAsync(x.identifier)),
  );
}
