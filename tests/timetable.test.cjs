const test = require('node:test');
const assert = require('node:assert/strict');
const { PERIODS, nextPanyuReminder, panyuParts, reminderClock } = require('../src/timetable.ts');

test('all twelve Panyu periods match the supplied schedule', () => {
  assert.deepEqual(PERIODS.map(([start, end]) => `${start}–${end}`), [
    '08:30–09:15', '09:25–10:10', '10:30–11:15', '11:25–12:10',
    '13:05–13:50', '14:00–14:45', '14:55–15:40', '15:50–16:35',
    '16:45–17:30', '18:30–19:15', '19:25–20:10', '20:20–21:05',
  ]);
});

test('today is determined in Panyu, not the device zone', () => {
  assert.equal(panyuParts(new Date('2026-09-27T16:30:00Z')).weekday, 1);
});

test('reminder stays on the Panyu instant across a different local zone', () => {
  const now = new Date('2026-09-27T16:30:00Z');
  assert.equal(nextPanyuReminder(1, 1, 10, now).toISOString(), '2026-09-28T00:20:00.000Z');
});

test('past reminder moves to the following week', () => {
  const now = new Date('2026-09-28T00:21:00Z');
  assert.equal(nextPanyuReminder(1, 1, 10, now).toISOString(), '2026-10-05T00:20:00.000Z');
});

test('lead time is subtracted from class start', () => {
  assert.deepEqual(reminderClock(10, 60), { hour: 17, minute: 30 });
});
