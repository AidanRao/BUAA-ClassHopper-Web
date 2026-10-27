const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const today = (now = new Date()) => dateFormat.format(now);
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00+08:00`);
  return Number.isFinite(parsed.getTime()) && today(parsed) === value;
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setUTCDate(value.getUTCDate() + days);
  return today(value);
}
export function weekDates(date: string): string[] {
  const day = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  const monday = addDays(date, -(day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}
export function courseTime(value: string): number {
  const normalized = value.replace(" ", "T");
  return Date.parse(
    /[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized)
      ? normalized
      : `${normalized}+08:00`,
  );
}
export function timeLabel(value: string): string {
  const time = courseTime(value);
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(time)
    : "时间未知";
}
export const withinWindow = (
  course: { classBeginTime: string; classEndTime: string },
  now: number,
) =>
  now >= courseTime(course.classBeginTime) - 600_000 &&
  now <= courseTime(course.classEndTime);
export function safeReturnTo(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/schedule";
  const parsed = new URL(value, "https://local.invalid");
  return parsed.origin === "https://local.invalid" &&
    !/^\/(?:login|oauth)(?:\/|$)/.test(parsed.pathname)
    ? parsed.pathname + parsed.search
    : "/schedule";
}
