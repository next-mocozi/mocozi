'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NewChatModal } from '@/components/chat/NewChatModal';
import RoomList from '@/components/chat/RoomList';
import { useAuth } from '@/hooks/useAuth';

/**
 * 채팅 리스트 페이지
 *
 * 레이아웃 — /chat/[roomId]와 통일된 2단 구조:
 *  - xl(1280px) 이상: 좌측 RoomList 사이드바 + 우측 "방 선택" 빈 상태 카드
 *  - xl 미만: RoomList가 중앙 카드(max-w-[40rem])로 노출
 *
 * 데이터 fetch / unread 동기화는 RoomList 컴포넌트가 자체 처리.
 * RoomList는 반응형 위치 변경만 적용해 단 한 번만 마운트 (이중 fetch 방지).
 */
export default function ChatListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [newChatOpen, setNewChatOpen] = useState(false);

  return (
    <div className="relative h-[calc(100vh-11rem)]">
      {/* RoomList — xl 이상: 좌측 사이드바 absolute / xl 미만: 중앙 카드 */}
      <div
        className="
          mx-auto h-full max-w-[40rem] overflow-hidden rounded-xl
          border border-gray-200 bg-white
          xl:absolute xl:right-[calc(50%+21rem)] xl:top-0 xl:mx-0 xl:w-72 xl:max-w-none
        "
      >
        <RoomList />
      </div>

      {/* 빈 상태 안내 — xl 이상에서만 우측 메인 영역에 표시 */}
      <div
        className="
          mx-auto hidden h-full max-w-[40rem] flex-col items-center justify-center
          gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-8 text-center
          xl:flex
        "
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-3xl">
          💬
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            채팅방을 선택하세요
          </h2>
          <p className="mt-1 text-sm text-gray-500">
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
