'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NewChatModal } from '@/components/chat/NewChatModal';
import RoomList from '@/components/chat/RoomList';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type {
  ChatRoomWithMembers,
  MessageContext,
  TeamApplicationContact,
} from '@/types/chat';

/**
 * 채팅 리스트 페이지
 *
 * 레이아웃 — /chat/[roomId]와 통일된 2단 구조:
 *  - xl(1280px) 이상: 좌측 RoomList 사이드바 + 우측 "방 선택" 빈 상태 카드
 *  - xl 미만: RoomList가 중앙 카드(max-w-[40rem])로 노출
 *
 * Query string 처리 (양식 시스템 진입 — Phase A):
 *  - ?userId=X&context=RECRUIT_INDIVIDUAL → DIRECT 방 자동 생성/이동
 *  - ?teamId=X&context=RECRUIT_TEAM       → 팀의 contact 라우팅에 따라 방 생성/이동
 *
 * 데이터 fetch / unread 동기화는 RoomList 컴포넌트가 자체 처리.
 */
export default function ChatListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const autoCreateAttempted = useRef(false);

  // ---------------------------------------------------------
  // Query 처리 — userId/teamId가 있으면 자동으로 방 생성/이동
  // ---------------------------------------------------------
  useEffect(() => {
    if (autoCreateAttempted.current) return;
    if (!user) return; // 로그인 후에만 동작

    const userId = searchParams.get('userId');
    const teamId = searchParams.get('teamId');
    const context = searchParams.get('context') as MessageContext | null;
    if (!userId && !teamId) return;

    autoCreateAttempted.current = true;

    const run = async () => {
      try {
        if (userId) {
          // RECRUIT_INDIVIDUAL — 본인이 자기 자신과 채팅 시도하는 케이스 방어
          if (userId === user.id) {
            router.replace('/chat');
            return;
          }
          const res = await api.post<{ data: ChatRoomWithMembers }>(
            '/api/chat/rooms',
            { type: 'DIRECT', memberIds: [userId] },
          );
          const room = res.data.data;
          const params = new URLSearchParams();
          if (context) params.set('context', context);
          const qs = params.toString();
          router.replace(`/chat/${room.id}${qs ? `?${qs}` : ''}`);
          return;
        }

        if (teamId) {
          // RECRUIT_TEAM — 팀의 contact 라우팅 조회 후 방 생성
          const contactRes = await api.get<{ data: TeamApplicationContact }>(
            `/api/teams/${teamId}/contact`,
          );
          const contact = contactRes.data.data;

          // 자기 자신만 받는 사람이면 (본인이 팀장인 케이스) 그냥 채팅 메인으로
          const recipients = contact.recipientUserIds.filter(
            (id) => id !== user.id,
          );
          if (recipients.length === 0) {
            router.replace('/chat');
            return;
          }

          const roomRes = await api.post<{ data: ChatRoomWithMembers }>(
            '/api/chat/rooms',
            {
              type: contact.type,
              memberIds: recipients,
              ...(contact.type === 'GROUP' && contact.suggestedRoomName
                ? { name: contact.suggestedRoomName }
                : {}),
            },
          );
          const room = roomRes.data.data;
          const params = new URLSearchParams();
          if (context) params.set('context', context);
          // teamId 보존 — 채팅방에서 직군 선택 단계 시 모집 직군 다시 조회
          params.set('teamId', teamId);
          router.replace(`/chat/${room.id}?${params.toString()}`);
        }
      } catch (e) {
        // 실패 시 채팅 메인으로 — 에러는 콘솔만 (사용자에게 강한 alert 불필요)
        // eslint-disable-next-line no-console
        console.error('[chat] auto-create failed', e);
        router.replace('/chat');
      }
    };

    void run();
  }, [user, searchParams, router]);

  return (
    <div className="relative h-[calc(100vh-11rem)]">
      {/* RoomList — xl 이상: 좌측 사이드바 absolute / xl 미만: 중앙 카드 */}
      <div
        className="
          mx-auto h-full max-w-[40rem] overflow-hidden rounded-xl
          border border-slate-200 bg-white
          xl:absolute xl:right-[calc(50%+21rem)] xl:top-0 xl:mx-0 xl:w-72 xl:max-w-none
        "
      >
        <RoomList />
      </div>

      {/* 빈 상태 안내 — xl 이상에서만 우측 메인 영역에 표시 */}
      <div
        className="
          mx-auto hidden h-full max-w-[40rem] flex-col items-center justify-center
          gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-8 text-center
          xl:flex
        "
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl">
          💬
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            채팅방을 선택하세요
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            왼쪽 목록에서 방을 선택하거나 새 채팅을 시작하세요.
          </p>
        </div>
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        myId={user?.id}
        onCreated={(room) => router.push(`/chat/${room.id}`)}
      />
    </div>
  );
}
