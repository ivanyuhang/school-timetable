export type ClassEntry = { subject: string; classroom: string; teacher: string };
export type Timetable = Record<string, ClassEntry>;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export const PERIODS = [
  ['08:30', '09:15'], ['09:25', '10:10'], ['10:30', '11:15'],
  ['11:25', '12:10'], ['13:05', '13:50'], ['14:00', '14:45'],
  ['14:55', '15:40'], ['15:50', '16:35'], ['16:45', '17:30'],
  ['18:30', '19:15'], ['19:25', '20:10'], ['20:20', '21:05'],
] as const;
export const slotKey = (weekday: number, period: number) => `${weekday}-${period}`;
export function panyuParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    hour: Number(get('hour')), minute: Number(get('minute')) };
}
export function panyuWeekday(date: Date) { return panyuParts(date).weekday; }
export function reminderClock(period: number, minutesBefore: number) {
  const [hour, minute] = PERIODS[period - 1][0].split(':').map(Number);
  const total = hour * 60 + minute - minutesBefore;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}
export function nextPanyuReminder(weekday: number, period: number, minutesBefore: number, now: Date) {
  const today = panyuParts(now);
  const days = (weekday - today.weekday + 7) % 7;
  const clock = reminderClock(period, minutesBefore);
  // UTC+8 is fixed in Asia/Shanghai; UTC arithmetic also handles month/year boundaries.
  let timestamp = Date.UTC(today.year, today.month - 1, today.day + days, clock.hour - 8, clock.minute);
  if (timestamp <= now.getTime()) timestamp += 7 * 86400000;
  return new Date(timestamp);
}
