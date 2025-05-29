export function calculateNextAvailableSlot(): string[] {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const manilaTime = new Date(utc + 8 * 3600000); // Manila time (UTC+8)

  let hour = manilaTime.getHours();
  let minute = manilaTime.getMinutes();

  // Round up to the next half-hour
  if (minute > 0 && minute < 30) {
    minute = 30;
  } else if (minute >= 30) {
    hour += 1;
    minute = 0;
  }

  // If we're less than 20 minutes from the next slot, skip to the following one
  const nextSlotTime = new Date(manilaTime);
  nextSlotTime.setHours(hour);
  nextSlotTime.setMinutes(minute);
  const diffMinutes = (nextSlotTime.getTime() - manilaTime.getTime()) / 60000;

  if (diffMinutes < 20) {
    minute += 30;
    if (minute === 60) {
      hour += 1;
      minute = 0;
    }
  }

  const slots: string[] = [];
  const cutoffTime = new Date(manilaTime.getTime() + 24 * 60 * 60000); // 24 hours later

  // Generate slots until cutoff
  while (true) {
    const slotTime = new Date();
    slotTime.setUTCHours(0, 0, 0, 0); // Reset to midnight UTC
    slotTime.setTime(
      new Date(Date.UTC(
        manilaTime.getUTCFullYear(),
        manilaTime.getUTCMonth(),
        manilaTime.getUTCDate(),
        hour,
        minute
      )).getTime()
    );

    if (slotTime > cutoffTime) break;

    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const period = hour < 12 || hour === 24 ? 'AM' : 'PM';
    const displayMinute = minute === 0 ? '00' : '30';

    slots.push(`${displayHour}:${displayMinute} ${period}`);

    // Move to next 30-min slot
    minute += 30;
    if (minute === 60) {
      hour += 1;
      minute = 0;
    }

    if (hour >= 24) {
      hour = 0;
      // Add 1 day, but since we check against cutoffTime, no need to set date manually
    }
  }

  return slots;
}
