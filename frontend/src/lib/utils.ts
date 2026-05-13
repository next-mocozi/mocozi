/** 성+이름 합치기 */
export function getFullName(user: { lastName: string; firstName: string }): string {
  return user.lastName + user.firstName;
}

/** 이름 마스킹 (예: 홍OO). firstName 글자 수만큼 O로 대체.
 *  firstName이 비어있는 레거시 유저는 lastName 전체를 성+나머지로 분리해 처리. */
export function getMaskedName(user: { lastName: string; firstName: string }): string {
  if (user.firstName) {
    return user.lastName + 'O'.repeat(user.firstName.length);
  }
  // 레거시: 전체 이름이 lastName에 저장된 경우 (성 1글자 + 나머지 마스킹)
  if (user.lastName.length > 1) {
    return user.lastName[0] + 'O'.repeat(user.lastName.length - 1);
  }
  return user.lastName + 'O';
}

/** 날짜 포맷팅 (YYYY.MM.DD) */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

/** 텍스트 자르기 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/** 상대 시간 표시 (예: 3시간 전) */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return formatDate(date);
}
