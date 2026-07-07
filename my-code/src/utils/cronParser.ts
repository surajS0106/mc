/**
 * cronParser.ts - Pure 5-field cron expression utilities.
 *
 * Format: "M H DoM Mon DoW"
 *   Minute:      0-59
 *   Hour:        0-23
 *   DayOfMonth:  1-31
 *   Month:       1-12
 *   DayOfWeek:   0-6  (Sun=0, Sat=6)
 *
 * Supports: *, step (*\/n), range (a-b), list (a,b,c)
 */

export interface CronFields {
  minute: string;
  hour: string;
  dom: string;
  month: string;
  dow: string;
}

// --- Parse -------------------------------------------------------------------

/** Parse a 5-field cron expression. Returns null if invalid. */
export function parseCron(expr: string): CronFields | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const minute = parts[0]!;
  const hour   = parts[1]!;
  const dom    = parts[2]!;
  const month  = parts[3]!;
  const dow    = parts[4]!;
  if (!isValidField(minute, 0, 59)) return null;
  if (!isValidField(hour,   0, 23)) return null;
  if (!isValidField(dom,    1, 31)) return null;
  if (!isValidField(month,  1, 12)) return null;
  if (!isValidField(dow,    0,  6)) return null;
  return { minute, hour, dom, month, dow };
}

function isValidField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;

  // Step: */n
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return !isNaN(step) && step > 0 && step <= max;
  }

  // Range: a-b
  if (field.includes('-')) {
    const dash = field.indexOf('-');
    const a = parseInt(field.slice(0, dash), 10);
    const b = parseInt(field.slice(dash + 1), 10);
    return !isNaN(a) && !isNaN(b) && a >= min && b <= max && a <= b;
  }

  // List: a,b,c
  if (field.includes(',')) {
    return field.split(',').every(v => {
      const n = parseInt(v.trim(), 10);
      return !isNaN(n) && n >= min && n <= max;
    });
  }

  // Literal
  const n = parseInt(field, 10);
  return !isNaN(n) && n >= min && n <= max;
}

// --- Human-readable ----------------------------------------------------------

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(s: string): string {
  return s.padStart(2, '0');
}

/** Convert a cron expression to a human-readable description. */
export function cronToHuman(expr: string): string {
  const f = parseCron(expr);
  if (!f) return expr;

  const { minute, hour, dom, month, dow } = f;

  // every N minutes: */N * * * *
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = minute.slice(2);
    return `every ${n} minute${n === '1' ? '' : 's'}`;
  }

  // every N hours at minute M: M */N * * *
  if (hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    const n = hour.slice(2);
    return `every ${n} hour${n === '1' ? '' : 's'} at minute ${minute}`;
  }

  // daily at H:M: M H * * *
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow === '*') {
    return `daily at ${pad(hour)}:${pad(minute)}`;
  }

  // specific days of week: M H * * DoW
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow !== '*') {
    const dayStr = dow.split(',').map(d => DOW_NAMES[parseInt(d, 10)] ?? d).join('/');
    return `${dayStr} at ${pad(hour)}:${pad(minute)}`;
  }

  // specific date: M H DoM Mon *
  if (minute !== '*' && hour !== '*' && dom !== '*' && month !== '*' && dow === '*') {
    const m = MONTH_NAMES[(parseInt(month, 10) - 1)] ?? month;
    return `${m} ${dom} at ${pad(hour)}:${pad(minute)}`;
  }

  // hourly at minute M: M * * * *
  if (minute !== '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `hourly at minute ${minute}`;
  }

  return expr; // fallback
}

// --- Next run ----------------------------------------------------------------

/**
 * Calculate the next Date that matches the cron expression, starting from
 * `fromMs + 1 minute`. Returns null if no match within one year.
 */
export function nextCronDate(expr: string, fromMs: number): Date | null {
  const f = parseCron(expr);
  if (!f) return null;

  // Start from next whole minute
  const start = new Date(fromMs);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  const limit = new Date(fromMs);
  limit.setFullYear(limit.getFullYear() + 1);

  const cur = new Date(start);
  while (cur < limit) {
    if (
      fieldMatches(f.minute, cur.getMinutes(),   0, 59) &&
      fieldMatches(f.hour,   cur.getHours(),     0, 23) &&
      fieldMatches(f.dom,    cur.getDate(),      1, 31) &&
      fieldMatches(f.month,  cur.getMonth() + 1, 1, 12) &&
      fieldMatches(f.dow,    cur.getDay(),       0,  6)
    ) {
      return new Date(cur);
    }
    cur.setMinutes(cur.getMinutes() + 1);
  }

  return null;
}

function fieldMatches(field: string, value: number, _min: number, _max: number): boolean {
  if (field === '*') return true;

  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return value % step === 0;
  }

  if (field.includes('-')) {
    const dash = field.indexOf('-');
    const a = parseInt(field.slice(0, dash), 10);
    const b = parseInt(field.slice(dash + 1), 10);
    return value >= a && value <= b;
  }

  if (field.includes(',')) {
    return field.split(',').map(s => parseInt(s.trim(), 10)).includes(value);
  }

  return parseInt(field, 10) === value;
}
