export function calculateNextAvailableSlot(): string[] {
  // Get current time in Manila timezone (UTC+8)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const manilaTime = new Date(utc + (8 * 3600000)); // UTC+8
  
  const currentHours = manilaTime.getHours();
  const currentMinutes = manilaTime.getMinutes();
  const totalMinutes = currentHours * 60 + currentMinutes;

  // Business logic:
  // orders before 9:10 but not more than 9:11 - earliest slot is 9:30
  // 9:11 - 9:40 - earliest time slot is 10:00
  // 9:41 - 10:10 - earliest is 10:30
  // 10:11 - 10:20 - earliest is 11:00

  const slots: string[] = [];

  if (totalMinutes < 610) { // Before 9:10 AM
    slots.push('9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM');
  } else if (totalMinutes >= 611 && totalMinutes <= 640) { // 9:11 - 9:40 AM
    slots.push('10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM');
  } else if (totalMinutes >= 641 && totalMinutes <= 670) { // 9:41 - 10:10 AM
    slots.push('10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM');
  } else if (totalMinutes >= 671 && totalMinutes <= 680) { // 10:11 - 10:20 AM
    slots.push('11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM');
  } else {
    // Default slots for other times
    const nextHour = currentHours + 1;
    for (let i = 0; i < 4; i++) {
      const hour = nextHour + i;
      if (hour <= 23) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        slots.push(`${displayHour}:00 ${period}`);
      }
    }
  }

  return slots;
}

export function isValidTimeSlot(slot: string): boolean {
  const availableSlots = calculateNextAvailableSlot();
  return availableSlots.includes(slot);
}

export function getTimeSlotIndex(slot: string): number {
  const availableSlots = calculateNextAvailableSlot();
  return availableSlots.indexOf(slot);
}
