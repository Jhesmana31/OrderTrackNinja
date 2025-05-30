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

  // If less than 20 mins to slot, push to next one
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
  const slotTime = new Date(manilaTime);
  slotTime.setHours(hour);
  slotTime.setMinutes(minute);
  slotTime.setSeconds(0);
  slotTime.setMilliseconds(0);

  const cutoffTime = new Date(manilaTime.getTime() + 24 * 60 * 60000); // +24 hours

  while (slotTime <= cutoffTime && slots.length < 3) {
  const displayHour = slotTime.getHours() % 12 === 0 ? 12 : slotTime.getHours() % 12;
  const displayMinute = slotTime.getMinutes() === 0 ? '00' : '30';
  const period = slotTime.getHours() < 12 ? 'AM' : 'PM';

    slots.push(`${displayHour}:${displayMinute} ${period}`);

    // Move to next 30-minute slot
    slotTime.setMinutes(slotTime.getMinutes() + 30);
  }

  return slots;
}
