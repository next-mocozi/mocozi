import api from '@/lib/api';
import type { MessageContext } from '@/types/chat';

/**
 * 대상 사용자와의 DIRECT 채팅방을 생성한다.
 * 백엔드는 이미 양자 DIRECT 방이 있으면 그 방을 그대로 반환(find-or-create)하므로
 * 중복 방이 생기지 않는다.
 *
 * @param targetUserId 채팅 상대 user id
 * @param context      진입 컨텍스트. 주면 RoomList 에 색 점이 표시되고,
 *                     생략하면 점 없는 일반 대화로 생성된다.
 *                     (포트폴리오 "채팅하기" → PORTFOLIO_INQUIRY,
 *                      프로필 "채팅하기" → 미지정)
 * @returns 생성/재사용된 채팅방 id
 */
export async function startDirectChat(
  targetUserId: string,
  context?: MessageContext,
): Promise<string> {
  const res = await api.post<{ data: { id: string } }>('/api/chat/rooms', {
    type: 'DIRECT',
    memberIds: [targetUserId],
    ...(context ? { context } : {}),
  });
  return res.data.data.id;
}
