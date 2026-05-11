import api from '@/lib/api';

/**
 * 채팅 첨부 업로드 — Phase A 정책 (§16) frontend 헬퍼.
 *
 * 흐름:
 *  1. backend `POST /api/chat/rooms/{roomId}/attachments/upload-url`로 메타 보내
 *     presigned PUT URL 발급 받기
 *  2. 그 URL로 직접 Supabase에 fetch PUT (backend 트래픽 0)
 *  3. 성공 후 storage path 반환 — 호출자가 메시지 마커 `[[file:path|...]]` 또는
 *     `[[image:path|...]]`로 변환해서 message:send에 포함
 */

/** Phase A 크기 한도 (§16) — frontend 사전 차단 */
export const SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 20 * 1024 * 1024,
  'image/png': 20 * 1024 * 1024,
  'image/webp': 20 * 1024 * 1024,
  'image/gif': 20 * 1024 * 1024,
  'application/pdf': 50 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    30 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    30 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    30 * 1024 * 1024,
  // Free plan 한도(50MB)에 맞춤. Pro 도입 시 100MB+로 늘릴 수 있음.
  'application/zip': 50 * 1024 * 1024,
};

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/** MIME 화이트리스트 (Set) — 빠른 확인 */
export const ATTACHMENT_MIME_WHITELIST = new Set(Object.keys(SIZE_LIMITS));

export type AttachmentKind = 'file' | 'image';

/** UI 표시용 — 업로드 진행 중 / 완료 / 실패 */
export type AttachmentDraftStatus =
  | { state: 'queued' }
  | { state: 'uploading'; progress: number }
  | { state: 'done'; path: string }
  | { state: 'error'; message: string };

export interface AttachmentDraft {
  /** uuid — 클라이언트 임시 ID. 마커에는 path만 들어감 */
  id: string;
  file: File;
  /** image MIME이면 'image', 그 외 'file' — 마커 type 결정 */
  kind: AttachmentKind;
  status: AttachmentDraftStatus;
}

/**
 * file로부터 attachment kind 결정.
 *  - image/* → 'image' (inline preview)
 *  - 그 외 화이트리스트 MIME → 'file' (다운로드 카드)
 */
export function kindFor(mime: string): AttachmentKind {
  return mime.startsWith('image/') ? 'image' : 'file';
}

/**
 * Phase A 사전 검증.
 *  - MIME 화이트리스트
 *  - size 한도 (MIME별)
 * 실패 시 사람용 메시지 반환, 성공 시 null.
 */
export function validateAttachment(file: File): string | null {
  const mime = file.type;
  if (!ATTACHMENT_MIME_WHITELIST.has(mime)) {
    return `지원하지 않는 파일 형식입니다.\n허용: 이미지(jpg/png/webp/gif), PDF, Office(.docx/.xlsx/.pptx), zip`;
  }
  const limit = SIZE_LIMITS[mime];
  if (limit !== undefined && file.size > limit) {
    const limitMb = Math.round(limit / 1024 / 1024);
    const sizeMb = Math.round(file.size / 1024 / 1024);
    return `이 파일은 ${limitMb}MB 한도를 초과합니다. (현재 ${sizeMb}MB)`;
  }
  return null;
}

/** 단일 메시지에서 동시 첨부 가능 한도 검증 */
export function checkPerMessageLimit(currentCount: number, addingCount: number): string | null {
  if (currentCount + addingCount > MAX_ATTACHMENTS_PER_MESSAGE) {
    return `한 메시지에 최대 ${MAX_ATTACHMENTS_PER_MESSAGE}개까지 첨부할 수 있습니다.`;
  }
  return null;
}

interface UploadUrlResponse {
  success: boolean;
  data: {
    uploads: Array<{
      name: string;
      path: string;
      uploadUrl: string;
      token: string;
      expiresAt: string;
    }>;
  };
}

/**
 * 파일 1개를 backend → Supabase Storage에 업로드.
 *
 * @param file       업로드할 File
 * @param roomId     채팅방 ID (path 구분)
 * @param onProgress 0..1 진행률 콜백 (선택)
 * @returns          storage path. 실패 시 throw
 */
export async function uploadSingleAttachment(
  file: File,
  roomId: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  // 1. backend에서 presigned PUT URL 받기
  const presign = await api.post<UploadUrlResponse>(
    `/api/chat/rooms/${roomId}/attachments/upload-url`,
    {
      files: [
        {
          name: file.name,
          size: file.size,
          mime: file.type,
        },
      ],
    },
  );
  const upload = presign.data.data.uploads[0];
  if (!upload) throw new Error('업로드 URL 발급에 실패했습니다.');

  // 2. PUT으로 직접 Supabase Storage에 업로드. fetch는 progress 이벤트가 없으므로
  //    XHR 사용 (브라우저 dev에서 progress bar 보여주려면 필수).
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`업로드 실패 (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('업로드 네트워크 오류'));
    xhr.send(file);
  });

  return upload.path;
}

/**
 * 마커 문자열 생성 — `[[file:path|name|size|mime]]` 또는 `[[image:...]]`.
 *
 * filename에 `|` 또는 `]`가 들어있으면 마커가 깨지므로 sanitize.
 */
export function buildAttachmentMarker(
  kind: AttachmentKind,
  path: string,
  name: string,
  size: number,
  mime: string,
): string {
  const safeName = name.replace(/[|\]]/g, '_');
  return `[[${kind}:${path}|${safeName}|${size}|${mime}]]`;
}
