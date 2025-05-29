export function calculateNextAvailableSlot(): string[] {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const manilaTime = new Date(utc + 8 * 3600000); // UTC+8

  const currentHours = manilaTime.getHours();
  const currentMinutes = manilaTime.getMinutes();
  const totalMinutes = currentHours * 60 + currentMinutes;

  const slots: string[] = [];

  // Special early-morning logic
  if (totalMinutes <= 610) { // 6:00 AM - 9:10 AM
    slots.push('9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM');
  } else if (totalMinutes <= 640) { // 9:11 AM - 9:40 AM
    slots.push('10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM');
  } else if (totalMinutes <= 670) { // 9:41 AM - 10:10 AM
    slots.push('10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM');
  } else if (totalMinutes <= 680) { // 10:11 AM - 10:20 AM
    slots.push('11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM');
  } else {
    // Generate slots every 30 minutes from current time, up to 11:30 PM
    let hour = currentHours;
    let minute = currentMinutes;

    // Round to next half hour mark
    if (minute > 0 && minute <= 30) {
      minute = 30;
    } else if (minute > 30) {
      hour += 1;
      minute = 0;
    }

    for (let i = 0; i < 4; i++) {
      let slotHour = hour;
      let slotMinute = minute;

      // Format slot
      const displayHour = slotHour % 12 === 0 ? 12 : slotHour % 12;
      const period = slotHour < 12 ? 'AM' : 'PM';
      const displayMinute = slotMinute === 0 ? '00' : '30';
      slots.push(`${displayHour}:${displayMinute} ${period}`);

      // Move to next 30-min interval
      minute += 30;
      if (minute === 60) {
        hour += 1;
        minute = 0;
      }

      // Stop at 11:30 PM
      if (hour === 24) break;
    }
  }

  return slots;
}
