import { Capacitor } from '@capacitor/core';

export interface DeviceCalendarEvent {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endTime?: string | null; // HH:mm
  description?: string | null;
}

/**
 * Writes an event into the phone's own calendar (iOS EventKit / Android CalendarProvider)
 * via the native plugin, asking for write access the first time. No-op on web.
 * Returns true if the event was added.
 */
export async function addEventToDeviceCalendar(event: DeviceCalendarEvent): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
    const access = await CapacitorCalendar.requestWriteOnlyCalendarAccess();
    if (access.result !== 'granted') return false;

    const start = new Date(`${event.date}T${event.time || '12:00'}`);
    const end = event.endTime
      ? new Date(`${event.date}T${event.endTime}`)
      : new Date(start.getTime() + 60 * 60 * 1000);

    await CapacitorCalendar.createEvent({
      title: event.title,
      startDate: start.getTime(),
      endDate: end.getTime(),
      ...(event.description ? { description: event.description } : {}),
    });
    return true;
  } catch {
    return false;
  }
}
