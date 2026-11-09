import { BadRequestException } from '@nestjs/common';

export function leaveDates(start: unknown, end: unknown) {
  const parse = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Start date and end date are required (YYYY-MM-DD)');
    const date = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Invalid leave date');
    return date;
  };
  const startDate = parse(start), endDate = parse(end);
  if (endDate < startDate) throw new BadRequestException('End date must be on or after start date');
  return { startDate, endDate, duration: `${Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1} days` };
}

export function leaveToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
}
