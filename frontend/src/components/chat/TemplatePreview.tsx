'use client';

import Link from 'next/link';
import { useState } from 'react';

interface TemplatePreviewProps {
  /** 변수가 이미 치환된 메시지 본문 (SlidingPanel을 여는 부모가 render 해서 넘김) */
  rendered: string;
  /** [보내기] 클릭 시 호출 — Promise 반환으로 sending 상태 추적 */
  onSend: () => Promise<void>;
  /** 전송 중 일시 disable. 부모가 false면 활성 */
  disabled?: boolean;
  /** "양식 편집" 링크 — 클릭 시 /profile/edit/templates로 이동 */
  editPath?: string;
}

/**
 * 슬라이딩 패널 안에 들어가는 양식 미리보기 + [보내기] 버튼.
 *
 * 흐름:
 *  - 사용자가 메시지 본문을 본 채로 [보내기] 한 번만 누르면 됨
 *  - "수정하고 보내기"는 미리보기로 대체 (사용자가 보고 결정)
 *  - 본문이 마음에 안 들면 "양식 편집" 링크로 설정 페이지 이동 가능
 */
export function TemplatePreview({
  rendered,
  onSend,
  disabled,
  editPath = '/profile/edit/templates',
}: TemplatePreviewProps) {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (sending || disabled) return;
    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 미리보기 영역 — 메시지 풍선처럼 보이게 */}
      <div className="border border-gray-200 bg-gray-50 p-4">
        <p className="mb-2 text-xs font-medium text-gray-500">메시지 미리보기</p>
        <p className="whitespace-pre-wrap text-sm text-gray-800">{rendered}</p>
      </div>

      {/* 양식 편집 안내 */}
      <p className="text-xs text-gray-500">
        양식이 마음에 안 드시나요?{' '}
        <Link
          href={editPath}
          className="text-primary-600 underline hover:text-primary-700"
        >
          양식 편집
        </Link>
      </p>

      {/* 보내기 버튼 */}
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || disabled}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? '보내는 중…' : '보내기'}
      </button>
    </div>
  );
}
