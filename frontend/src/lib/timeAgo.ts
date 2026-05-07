// 게시물 등록 시간 → "방금 전", "N분 전", "N시간 전", "N일 전", "N주 전",
// 그 이상은 YYYY.MM.DD 절대 표기.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function timeAgo(epochMs: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - epochMs);
  if (diff < MIN) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}일 전`;
  if (diff < 4 * WEEK) return `${Math.floor(diff / WEEK)}주 전`;
  // 그 이전: 절대 날짜 — YYYY.MM.DD
  const d = new Date(epochMs);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}
