import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ClassEntry, PERIODS, Timetable, nextPanyuReminder, reminderClock } from './timetable';

const OWNER = 'panyu-timetable-v1';
const CHANNEL = 'class-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function notificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Class reminders', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let status = await Notifications.getPermissionsAsync();
  if (!status.granted && status.canAskAgain) status = await Notifications.requestPermissionsAsync();
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function signature(key: string, entry: ClassEntry, lead: number) {
  return JSON.stringify([key, entry.subject, entry.classroom, entry.teacher, lead]);
}

type Desired = { key: string; signature: string; entry: ClassEntry; trigger: Notifications.NotificationTriggerInput; at?: number };

async function performSync(timetable: Timetable, lead: number | null) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter(item => item.content.data?.owner === OWNER);
  if (lead === null) {
    await Promise.all(ours.map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    return 0;
  }
  const desired: Desired[] = [];
  const now = new Date();
  for (const [key, entry] of Object.entries(timetable)) {
    const [weekday, period] = key.split('-').map(Number);
    if (!entry.subject.trim() || weekday < 1 || weekday > 5 || period < 1 || period > 12) continue;
    const clock = reminderClock(period, lead);
    const baseSignature = signature(key, entry, lead);
    if (Platform.OS === 'ios') {
      desired.push({ key, entry, signature: baseSignature, trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        weekday: weekday + 1, hour: clock.hour, minute: clock.minute,
        timezone: 'Asia/Shanghai', repeats: true,
      } });
    } else {
      // Android's weekly trigger follows the device zone, so use absolute dates instead.
      const first = nextPanyuReminder(weekday, period, lead, now);
      for (let week = 0; week < 4; week++) {
        const date = new Date(first.getTime() + week * 7 * 86400000);
        desired.push({ key, entry, at: date.getTime(), signature: `${baseSignature}:${date.getTime()}`, trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL,
        } });
      }
    }
  }
  if (desired.length === 0) {
    await Promise.all(ours.map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    return 0;
  }
  const allowed = await notificationPermission();
  if (!allowed) {
    await Promise.all(ours.map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    return -1;
  }
  // Keep below iOS's pending notification cap and refresh the Android queue on each open.
  const selected = (Platform.OS === 'android' ? desired.sort((a, b) => (a.at ?? 0) - (b.at ?? 0)) : desired).slice(0, 60);
  const wanted = new Set(selected.map(item => item.signature));
  const existing = new Set(ours.map(item => String(item.content.data?.signature)));
  for (const item of ours) {
    if (!wanted.has(String(item.content.data?.signature))) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
  for (const item of selected) {
    if (existing.has(item.signature)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: lead === 0 ? `${item.entry.subject} starts now` : `${item.entry.subject} starts in ${lead} min`,
        body: `${PERIODS[Number(item.key.split('-')[1]) - 1][0]} Panyu time${item.entry.classroom ? ` · ${item.entry.classroom}` : ''}${item.entry.teacher ? ` · ${item.entry.teacher}` : ''}`,
        data: { owner: OWNER, signature: item.signature, key: item.key },
      }, trigger: item.trigger,
    });
  }
  return selected.length;
}

let syncQueue: Promise<unknown> = Promise.resolve();
export function syncReminders(timetable: Timetable, lead: number | null): Promise<number> {
  const result = syncQueue.then(() => performSync(timetable, lead));
  syncQueue = result.catch(() => undefined);
  return result;
}

export async function testNotification() {
  if (!await notificationPermission()) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Panyu Timetable test', body: 'Local notifications are working.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
  return true;
}
