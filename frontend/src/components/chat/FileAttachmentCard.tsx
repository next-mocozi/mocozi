'use client';

import { useEffect, useState } from 'react';
import { DownloadIcon, FileIcon } from '@/components/icons/ChatIcons';
import { getSignedUrl } from '@/lib/chat/signAttachmentUrls';
import type { ParsedAttachment } from '@/lib/messageTemplate';

interface FileAttachmentCardProps {
  /** type: 'file' 변형의 ParsedAttachment */
  attachment: Extract<ParsedAttachment, { type: 'file' }>;
  /** 메시지 풍선이 본인 메시지(우측)인지 — 색상 분기 */
  isMine: boolean;
}

/**
 * 파일 첨부 카드 — 이미지가 아닌 일반 파일을 메시지 풍선 아래에 표시.
 *
 * 파일명·크기·MIME 별 아이콘. 클릭하면 signed URL로 다운로드 (브라우저가 처리).
 * URL은 1h TTL signed URL — 캐시는 lib/chat/signAttachmentUrls.ts가 관리.
 */
export function FileAttachmentCard({ attachment, isMine }: FileAttachmentCardProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  // 말풍선 밖 단독 렌더 (mt-* 제거 — 부모 flex gap이 spacing 담당)
  const baseClasses = `flex w-full max-w-sm items-center gap-3 border px-3 py-2 text-xs transition-colors ${
    isMine
      ? 'border-primary-300 bg-white/95 text-primary-900 hover:bg-white'
      : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'
  }`;

  const inner = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center ${
          isMine ? 'bg-primary-50 text-primary-600' : 'bg-stone-100 text-stone-600'
        }`}
      >
        <FileIcon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{attachment.label}</span>
        <span
          className={`mt-0.5 text-[0.7rem] ${
            isMine ? 'text-primary-700' : 'text-stone-500'
          }`}
        >
          {formatBytes(attachment.size)}
          {attachment.mime ? ` · ${mimeShort(attachment.mime)}` : ''}
        </span>
      </span>
      <DownloadIcon
        className={`h-4 w-4 shrink-0 ${
          isMine ? 'text-primary-600/70' : 'text-stone-400'
        }`}
      />
    </>
  );

  if (loading) {
    return (
      <div className={`${baseClasses} cursor-wait opacity-70`}>{inner}</div>
    );
  }
  if (!url) {
    return (
      <div className={`${baseClasses} cursor-not-allowed opacity-60`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-stone-100 text-stone-400">
          <FileIcon className="h-5 w-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{attachment.label}</span>
          <span className="mt-0.5 text-[0.7rem] text-stone-500">
            파일을 불러올 수 없습니다
          </span>
        </span>
      </div>
    );
  }
  return (
    <a
      href={url}
      download={attachment.label}
      target="_blank"
      rel="noopener noreferrer"
      className={baseClasses}
      aria-label={`${attachment.label} 다운로드`}
    >
      {inner}
    </a>
  );
}

/** bytes → 사람용 표기 (1.2 MB / 234 KB 등) */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** MIME → 짧은 라벨 */
function mimeShort(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/zip': 'ZIP',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'PPTX',
  };
  return map[mime] ?? mime.split('/').pop()?.toUpperCase() ?? 'FILE';
}
