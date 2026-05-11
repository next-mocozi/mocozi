// 게시물 등록 시간 → "방금 전", "N분 전", "N시간 전", "N일 전", "N주 전",
// "N개월 전", "N년 전" 의 상대 표기. 절대 날짜로 떨어뜨리지 않는다 —
// "2025.05.11" 같은 표기는 사용자에게 시점 감각을 주지 못하고, 본인이 한참 전에
// 작성한 게시물을 "왜 2025년이지?" 로 받아들이는 혼란을 만들었다.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function timeAgo(epochMs: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - epochMs);
  if (diff < MIN) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}일 전`;
  if (diff < 4 * WEEK) return `${Math.floor(diff / WEEK)}주 전`;
  if (diff < YEAR) return `${Math.floor(diff / MONTH)}개월 전`;
  return `${Math.floor(diff / YEAR)}년 전`;
}
