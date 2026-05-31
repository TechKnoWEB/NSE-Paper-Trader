import { useState, useEffect } from 'react';
import type { MarketStatus } from '@/types/paper';

const NSE_HOLIDAYS: string[] = [
  '2026-01-26',
  '2026-03-27',
  '2026-03-31',
  '2026-04-14',
  '2026-04-18',
  '2026-08-15',
  '2026-09-18',
  '2026-10-02',
  '2026-11-09',
  '2026-11-25',
  '2026-12-25',
];

const PRE_OPEN_START = 540;
const PRE_OPEN_END = 555;
const MARKET_OPEN = 555;
const MARKET_CLOSE = 930;

export interface MarketStatusResult {
  status: MarketStatus;
  marketStatus: MarketStatus;
  isOpen: boolean;
  timeToOpen: number;
  timeToClose: number;
  currentIST: Date;
  istTime: string;
  nextExpiry: Date;
  daysToExpiry: number;
}

function toIST(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

function getMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextThursday(from: Date): Date {
  const d = new Date(from);
  const daysUntilThursday = (4 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (daysUntilThursday || 7));
  d.setHours(15, 30, 0, 0);
  return d;
}

function isHoliday(date: Date): boolean {
  return NSE_HOLIDAYS.includes(toDateStr(date));
}

function formatIST(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export function useMarketStatus(): MarketStatusResult {
  const [now, setNow] = useState<Date>(() => toIST(new Date()));

  useEffect(() => {
    const id = setInterval(() => setNow(toIST(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const day = now.getDay();
  const minutes = getMinutes(now);
  const isWeekday = day >= 1 && day <= 5;
  const holiday = !isWeekday || isHoliday(now);

  let status: MarketStatus;
  let timeToOpen = 0;
  let timeToClose = 0;

  if (holiday) {
    status = 'holiday';
  } else if (minutes >= PRE_OPEN_START && minutes < PRE_OPEN_END) {
    status = 'pre_open';
    timeToOpen = (MARKET_OPEN - minutes) * 60000;
    timeToClose = (MARKET_CLOSE - minutes) * 60000;
  } else if (minutes >= MARKET_OPEN && minutes < MARKET_CLOSE) {
    status = 'open';
    timeToClose = (MARKET_CLOSE - minutes) * 60000;
  } else {
    status = 'closed';
    if (minutes < PRE_OPEN_START) {
      timeToOpen = (PRE_OPEN_START - minutes) * 60000;
    } else {
      timeToOpen = (PRE_OPEN_START + 1440 - minutes) * 60000;
    }
  }

  const isOpen = status === 'open';
  const nextExpiry = nextThursday(now);
  const daysToExpiry = Math.ceil(
    (nextExpiry.getTime() - now.getTime()) / 86400000
  );
  const istTime = formatIST(now);

  return {
    status,
    marketStatus: status,
    isOpen,
    timeToOpen,
    timeToClose,
    currentIST: now,
    istTime,
    nextExpiry,
    daysToExpiry,
  };
}
