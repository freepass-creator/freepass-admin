const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** YYYY-MM-DD 모양뿐 아니라 실제 존재하는 달력 날짜인지 확인한다. */
export function isCalendarDay(value: unknown): boolean {
  const day = String(value ?? '').trim();
  if (!DAY.test(day) || Number(day.slice(0, 4)) < 1) return false;
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === day;
}

/** YYYY-MM 중 실제 월(01~12)인지 확인한다. */
export function isCalendarMonth(value: unknown): boolean {
  const month = String(value ?? '').trim();
  if (!MONTH.test(month) || Number(month.slice(0, 4)) < 1) return false;
  const m = Number(month.slice(5, 7));
  return m >= 1 && m <= 12;
}

/** 서버 시각을 한국 업무일 YYYY-MM-DD로 정규화한다. */
export function koreaDay(nowMs = Date.now()): string | null {
  if (!Number.isFinite(nowMs)) return null;
  const d = new Date(nowMs + 9 * 3600_000);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
