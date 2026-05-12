'use client';

import { useEffect, useState } from 'react';
import { ImageIcon, XIcon } from '@/components/icons/ChatIcons';
import { getSignedUrl } from '@/lib/chat/signAttachmentUrls';
import type { ParsedAttachment } from '@/lib/messageTemplate';

interface ImageAttachmentProps {
  attachment: Extract<ParsedAttachment, { type: 'image' }>;
  isMine: boolean;
}

/**
 * 이미지 첨부 — 메시지 풍선 아래 inline preview + 클릭 시 fullscreen 확대 모달.
 *
 * 크기: max-w-64 (256px) / 비율 유지. signed URL은 1h TTL로 캐시 관리.
 */
export function ImageAttachment({ attachment, isMine }: ImageAttachmentProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getSignedUrl(attachment.target).then((u) => {
      if (cancelled) return;
      setUrl(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.target]);

  // ESC로 확대 모달 닫기
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [zoomed]);

  if (loading) {
    return (
      <div
        className={`flex h-32 w-64 items-center justify-center rounded-xl border ${
          isMine
            ? 'border-primary-300 bg-white/95 text-primary-300'
            : 'border-stone-300 bg-white text-stone-300'
        }`}
        aria-label="이미지 불러오는 중"
      >
        <ImageIcon className="h-8 w-8 animate-pulse" />
      </div>
    );
  }
  if (!url) {
    return (
      <div
        className={`flex h-32 w-64 flex-col items-center justify-center rounded-xl border ${
          isMine ? 'border-primary-300 bg-white/95' : 'border-stone-300 bg-white'
        } text-stone-500`}
        role="img"
        aria-label={`${attachment.label} — 이미지를 불러올 수 없습니다`}
      >
        <ImageIcon className="h-8 w-8" />
        <p className="mt-1 text-xs">이미지를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <>
      {/* inline preview — 말풍선 밖 단독 렌더 (mt-* 제거, 부모 gap이 spacing 담당) */}
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block max-w-64 overflow-hidden rounded-xl border border-stone-300 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-400"
        aria-label={`${attachment.label} 확대 보기`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.label}
          className="block max-h-64 w-full cursor-zoom-in object-cover"
          loading="lazy"
        />
      </button>

      {/* 확대 모달 */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${attachment.label} 확대`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(false);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/30"
            aria-label="닫기"
          >
            <XIcon className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={attachment.label}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
