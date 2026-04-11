'use client';

import { useState } from 'react';
import Link from 'next/link';

/** 채팅방 페이지 */
export default function ChatRoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  const [message, setMessage] = useState('');

  // 플레이스홀더 메시지 데이터
  const messages = [
    { id: '1', senderId: 'other', name: '홍길동', content: '안녕하세요! 프로젝트에 관심이 있어서 연락드렸습니다.', time: '오후 2:30' },
    { id: '2', senderId: 'me', name: '나', content: '안녕하세요! 관심 가져주셔서 감사합니다.', time: '오후 2:32' },
    { id: '3', senderId: 'other', name: '홍길동', content: '혹시 내일 오후에 미팅 가능하신가요?', time: '오후 2:33' },
  ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // TODO: Socket.IO로 메시지 전송
    console.log('메시지 전송:', message);
    setMessage('');
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* 채팅방 헤더 */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Link href="/chat" className="text-gray-500 hover:text-gray-700">
          ← 뒤로
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm text-primary-600">
          👤
        </div>
        <h2 className="font-medium">홍길동</h2>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                msg.senderId === 'me'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p
                className={`mt-1 text-xs ${
                  msg.senderId === 'me' ? 'text-primary-200' : 'text-gray-400'
                }`}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 메시지 입력 */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-gray-200 bg-white p-4"
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className="input-field flex-1"
        />
        <button type="submit" className="btn-primary">
          전송
        </button>
      </form>
    </div>
  );
}
