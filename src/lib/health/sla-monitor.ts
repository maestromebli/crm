export function calcLeadContactSla(input: {
  createdAt: Date;
  lastActivityAt?: Date | null;
  leadMessagesCount: number;
  slaHours?: number;
}): {
  breached: boolean;
  overdueHours: number;
} {
  const slaHours = input.slaHours ?? 24;
  const anchor = input.lastActivityAt ?? input.createdAt;
  const elapsedHours = Math.max(
    0,
    Math.round((Date.now() - anchor.getTime()) / (60 * 60 * 1000)),
  );

  const noFirstContact = input.leadMessagesCount === 0;
  const breached = noFirstContact && elapsedHours > slaHours;
  const overdueHours = breached ? elapsedHours - slaHours : 0;
  return { breached, overdueHours };
}
