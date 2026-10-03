export function requestTimestamp(value: string): string | null {
  return value ? `${value}:00+08:00` : null;
}

export function requestedTimeLabel(value: string | null | undefined): string {
  if (!value) return "No time requested";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time requested";
  return `${new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)} PHT`;
}

export function requestedTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
