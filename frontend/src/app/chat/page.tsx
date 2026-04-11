'use client';

import Link from 'next/link';

/** 채팅방 리스트 페이지 */
export default function ChatListPage() {
  const rooms = [
    { id: '1', name: '홍길동', lastMessage: '내일 미팅 가능하신가요?', time: '10분 전', unread: 2 },
    { id: '2', name: '김개발', lastMessage: '코드 리뷰 감사합니다!', time: '1시간 전', unread: 0 },
    { id: '3', name: '이디자인', lastMessage: '피그마 링크 공유드릴게요', time: '어제', unread: 0 },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">채팅</h1>

      <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {rooms.map((room) => (
          <Link
            key={room.id}
            href={`/chat/${room.id}`}
            className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg text-primary-600">
              👤
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{room.name}</h3>
                <span className="text-xs text-gray-500">{room.time}</span>
              </div>
              <p className="truncate text-sm text-gray-500">
                {room.lastMessage}
              </p>
            </div>
            {room.unread > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white">
                {room.unread}
              </span>
            )}
          </Link>
        ))}

        {rooms.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            아직 채팅 내역이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
