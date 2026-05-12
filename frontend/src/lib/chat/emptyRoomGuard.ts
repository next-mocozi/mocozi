/**
 * 빈 방 떠남 가드 — 사용자가 컨텍스트 진입으로 만든 빈 방(메시지 0개, draft 없음)에서
 * 떠나려 할 때 의도 확인 dialog. §15 정책 — 빈 방은 자동 숨김이라 떠나는 즉시 RoomList에서
 * 사라짐 → 사용자가 의도 없이 클릭으로 사라지면 혼란.
 *
 * 동작:
 *  - chat/[roomId] page가 빈 방 진입 시 `setEmptyRoomGuard(roomId)` 호출 (현재 보호 대상 등록)
 *  - 메시지 보내거나 draft 작성 시작하면 `clearEmptyRoomGuard()` 호출 (보호 해제)
 *  - 페이지 unmount 시 `clearEmptyRoomGuard()` 호출
 *  - 사용자가 떠나려 할 때 (뒤로 버튼, 다른 채팅 클릭, 페이지 navigation 등):
 *    `confirmLeaveEmptyRoom(targetRoomId?)` 호출 → 보호 중이면 confirm dialog → 사용자 응답 반환
 *  - 새로고침/탭 닫기는 chat/[roomId]에서 별도 beforeunload listener (브라우저 기본 dialog)
 */

/** 정형화 dialog 문구 — RoomList / chat page 양쪽 동일 */
export const EMPTY_ROOM_LEAVE_MESSAGE =
  '아직 메시지를 주고받지 않은 대화창입니다. 지금 나가면 채팅 목록에서 제거됩니다. 계속 나가시겠습니까?';

/** 현재 보호 중인 빈 방 ID (한 번에 하나 — 사용자는 한 채팅창만 봄) */
let activeEmptyRoomId: string | null = null;

/** 빈 방 보호 등록 — chat/[roomId] page가 빈 방 상태 진입/유지 동안 호출 */
export function setEmptyRoomGuard(roomId: string) {
  activeEmptyRoomId = roomId;
}

/** 보호 해제 — 메시지 전송, draft 시작, 또는 페이지 unmount 시 */
export function clearEmptyRoomGuard() {
  activeEmptyRoomId = null;
}

/** 현재 보호 중인 빈 방 ID (debug/test 용도) */
export function getEmptyRoomGuard(): string | null {
  return activeEmptyRoomId;
}

/**
 * 떠남 의도 확인.
 *
 * @param targetRoomId 이동 목적지가 채팅방이면 그 roomId. 같은 방이면 confirm 불필요(통과).
 * @returns true면 진행, false면 사용자가 취소 — 호출자가 navigation preventDefault 해야 함
 */
export function confirmLeaveEmptyRoom(targetRoomId?: string): boolean {
  if (!activeEmptyRoomId) return true; // 보호 중 X → 자유 이동
  if (targetRoomId && targetRoomId === activeEmptyRoomId) return true; // 같은 방
  if (typeof window === 'undefined') return true;
  return window.confirm(EMPTY_ROOM_LEAVE_MESSAGE);
}
