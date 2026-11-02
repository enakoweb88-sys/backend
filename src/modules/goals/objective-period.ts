import { BadRequestException } from '@nestjs/common';

export type ObjectiveCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

// Dates in objective forms are company calendar dates. A week is Monday–Sunday.
export function objectivePeriod(cadence: string, date: string) {
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(cadence) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('Select a daily, weekly or monthly period and a valid date');
  }
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) {
    throw new BadRequestException('Invalid objective date');
  }
  if (cadence === 'WEEKLY') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  if (cadence === 'MONTHLY') start.setUTCDate(1);
  const end = new Date(start);
  if (cadence === 'MONTHLY') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + (cadence === 'WEEKLY' ? 7 : 1));
  return {
    start,
    end,
    // Africa/Douala is UTC+1 throughout the year.
    reportStart: new Date(start.getTime() - 60 * 60 * 1000),
    reportEnd: new Date(end.getTime() - 60 * 60 * 1000),
    dueDate: new Date(end.getTime() - 24 * 60 * 60 * 1000),
  };
}
