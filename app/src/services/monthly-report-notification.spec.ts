import { afterEach, describe, expect, it, vi } from 'vitest';
import { YearMonth } from '@js-joda/core';

const scheduleNotificationAsync = vi.fn(async () => 'id');
const cancelScheduledNotificationAsync = vi.fn(async () => {});

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync: vi.fn(async () => []),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const { scheduleMonthlyReport } =
  await import('@/services/monthly-report-notification');

describe('scheduleMonthlyReport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const args = (at: Date) => ({
    month: YearMonth.of(2026, 10),
    at,
    title: 't',
    body: 'b',
  });

  it('queues the report for its time', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 1, 8, 0), toFake: ['Date'] });
    await scheduleMonthlyReport(args(new Date(2026, 10, 1, 9, 0)));
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('does not queue a report whose time has passed, which would fire it again at once', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 1, 9, 0, 1), toFake: ['Date'] });
    await scheduleMonthlyReport(args(new Date(2026, 10, 1, 9, 0)));
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
