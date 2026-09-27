# Panyu Timetable

A private, phone-only weekday timetable for Panyu campus. Class times and the Today tab use **Asia/Shanghai** time, even while travelling. The timetable starts empty.

## Run on an iPhone with Expo Go

1. Install **Expo Go** from the iPhone App Store. This project uses **Expo SDK 54**, the latest SDK supported by that App Store build for a physical iPhone. Update Expo Go if it asks.
2. Install Node.js 20.19 or newer on your computer.
3. In this folder run `npm install`, then `npx expo start`.
4. Put the iPhone and computer on the same Wi-Fi. Scan the QR code with the iPhone Camera app and open it in Expo Go. If your network blocks the connection, stop the server and run `npx expo start --tunnel` instead.
5. Open **Week**, choose a weekday, and tap any period to enter a subject, classroom, and optional teacher. Tap **Save class**. The **Today** tab shows classes for the current Panyu weekday.
6. Allow notification permission when prompted. In **Reminders**, choose the lead time (default 10 minutes), turn reminders off, or tap **Send a test notification**. The test appears after about five seconds. If permission was denied, enable notifications for Expo Go in iPhone Settings.
7. Close and reopen Expo Go to confirm the class remains saved. Edit or remove it to update its reminder.

No account or server is required. Timetable entries and the reminder choice are saved in AsyncStorage on the phone. Deleting Expo Go or its app data deletes this local data.

## Reminder behavior

On iOS, each saved class gets one weekly repeating calendar notification tied to **Asia/Shanghai**, so travelling to another time zone does not shift the reminder. The app compares its own scheduled notification signatures on launch and after changes. It cancels stale requests and keeps existing ones, preventing duplicates. iOS allows up to 64 pending notifications; this app has at most 60 weekday/period slots. A denied notification permission leaves classes saved but reminders unavailable until permission is enabled.

On Android, Expo's weekly trigger follows the device's time zone. The code instead schedules fixed Panyu instants for the next four occurrences of each class, up to 60 pending reminders, and refreshes them each time the app opens. Android users must reopen the app before that queue runs out. Android's battery policies may delay delivery; Expo Go cannot add the exact alarm permission to its native binary.

Device Focus modes and notification settings can suppress banners or sounds. Test on a physical phone, since a desktop bundle check cannot prove OS delivery.

## Development checks

Run `npm run check` for TypeScript checks and `npx expo export --platform ios` to verify the iOS JavaScript bundle. The app uses only Expo Go compatible packages. There are no push notifications or cloud services.

## Source

- `App.tsx`: Today, Week, editor, settings, and local persistence.
- `src/timetable.ts`: Panyu periods and time calculations.
- `src/notifications.ts`: permission, scheduling, deduplication, and test notification.
