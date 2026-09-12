/**
 * One GST stamp for every script and service in this repository.
 *
 * Every timestamp the estate stores, logs or shows carries a real +04:00
 * offset (Asia/Dubai, no daylight saving). Never `toISOString()`, which
 * renders UTC whatever the box clock says.
 */
export function gstStamp(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}+04:00`;
}
