import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/**
 * Supabase Storage 래퍼 — 채팅 첨부 파일 업로드·다운로드 signed URL 발급.
 *
 * Phase A 첨부 정책 — `docs/chat/01-decisions.md` §16 참조.
 *
 * 사용 흐름:
 *   1. 클라이언트가 backend에 업로드 요청 → `createUploadUrl()` 호출
 *      → presigned PUT URL 발급(10분 TTL). 클라이언트가 직접 PUT (backend 트래픽 0)
 *   2. 메시지 본문에 `[[file:path|...]]` 또는 `[[image:path|...]]` 마커 삽입해 전송
 *   3. 메시지 수신측이 표시할 때 `createSignedUrl(path)` 호출 → 1h TTL URL 발급
 *
 * **service role key** 사용. 클라이언트엔 절대 노출 X — 모든 Storage 작업은 backend 경유.
 */

/** MIME 화이트리스트 — §16 첨부 정책 */
export const ATTACHMENT_MIME_WHITELIST = new Set([
  // 이미지
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // 문서
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // 압축
  'application/zip',
]);

/** Type별 최대 크기 (bytes). MIME 화이트리스트와 함께 검증. */
const SIZE_LIMITS: Record<string, number> = {
  // 이미지 — 20MB
  'image/jpeg': 20 * 1024 * 1024,
  'image/png': 20 * 1024 * 1024,
  'image/webp': 20 * 1024 * 1024,
  'image/gif': 20 * 1024 * 1024,
  // PDF — 50MB
  'application/pdf': 50 * 1024 * 1024,
  // Office — 30MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    30 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    30 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    30 * 1024 * 1024,
  // zip — 50MB (Free plan 한도와 일치. Pro 도입 시 100MB+로 늘릴 수 있음)
  'application/zip': 50 * 1024 * 1024,
};

/** 사이즈 한도 조회. 화이트리스트에 없으면 null. */
export function getSizeLimitFor(mime: string): number | null {
  return SIZE_LIMITS[mime] ?? null;
}

/** MIME → 확장자 매핑 (저장 경로 생성용). 미지정 시 'bin' */
function extFor(mime: string): string {
  const m: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'pptx',
    'application/zip': 'zip',
  };
  return m[mime] ?? 'bin';
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;
  private bucket = '';

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'chat-attachments';

    // .env.example placeholder를 그대로 둔 신규 팀원의 백엔드 부팅 실패 함정 차단.
    // truthy 체크만으론 'https://[project-ref].supabase.co' 같은 placeholder가 통과돼
    // createClient에서 "Invalid supabaseUrl" throw → 모듈 init 실패 → 모든 API 500.
    const looksLikePlaceholder = (v: string | undefined) =>
      !!v && /\[project-ref\]|your-|placeholder|example/i.test(v);

    if (!url || !key || looksLikePlaceholder(url) || looksLikePlaceholder(key)) {
      this.logger.warn(
        '[StorageService] SUPABASE_URL/SERVICE_ROLE_KEY 미설정 또는 placeholder — 첨부 기능 비활성.',
      );
      return;
    }

    // createClient는 동기로 URL 파싱 → 비정상 URL이면 throw. 마지막 방어선으로 try/catch.
    try {
      this.client = createClient(url, key, {
        auth: { persistSession: false },
      });
      this.logger.log(
        `[StorageService] Supabase Storage ready (bucket: ${this.bucket})`,
      );
    } catch (e) {
      this.client = null;
      this.logger.error(
        '[StorageService] Supabase client init 실패 — 첨부 기능 비활성. URL/key 확인 필요.',
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  /** Storage 사용 가능 여부 — 미설정 환경에서 endpoint 호출 시 503 응답에 활용 */
  isReady(): boolean {
    return this.client !== null;
  }

  /**
   * 업로드용 presigned PUT URL 발급 (10분 TTL).
   *
   * @param roomId 채팅방 ID (path 구분용)
   * @param mime   파일 MIME — 화이트리스트 검증은 호출자 책임
   * @returns      { path, uploadUrl, token, expiresAt }
   */
  async createUploadUrl(roomId: string, mime: string): Promise<{
    path: string;
    uploadUrl: string;
    token: string;
    expiresAt: string;
  }> {
    if (!this.client) {
      throw new InternalServerErrorException('Storage 미설정 — 관리자에게 문의하세요.');
    }
    const ext = extFor(mime);
    const path = `rooms/${roomId}/${randomUUID()}.${ext}`;
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(path);
    if (error || !data) {
      this.logger.error(`createSignedUploadUrl failed: ${error?.message}`);
      throw new InternalServerErrorException('업로드 URL 발급 실패');
    }
    // Supabase signed upload URL은 ~2시간 TTL이지만 정책상 10분만 사용한다고 광고.
    // 클라이언트는 즉시 PUT하므로 실제로 10분도 안 걸림.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return {
      path,
      uploadUrl: data.signedUrl,
      token: data.token,
      expiresAt,
    };
  }

  /**
   * 표시/다운로드용 signed URL 발급 (기본 1h TTL).
   *
   * @param path  storage path (예: `rooms/{roomId}/{uuid}.png`)
   * @param ttlSec  TTL (초). 기본 3600
   * @returns       null이면 발급 실패 (path가 존재하지 않거나 storage 오류)
   */
  async createSignedUrl(
    path: string,
    ttlSec = 3600,
  ): Promise<{ url: string; expiresAt: string } | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, ttlSec);
    if (error || !data) {
      this.logger.warn(`createSignedUrl failed for ${path}: ${error?.message}`);
      return null;
    }
    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
  }

  /**
   * Storage 객체 영구 삭제. 메시지 hard delete 또는 Phase B B-DM-7 cron에서 사용.
   *
   * Phase A 정책상 일반 메시지 soft delete(deletedAt) 시엔 호출하지 않음 — sign endpoint가
   * 메시지 deletedAt 검증으로 접근만 차단. 30일+ 묻힌 파일은 cron이 일괄 정리.
   */
  async deleteObject(path: string): Promise<boolean> {
    if (!this.client) return false;
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) {
      this.logger.warn(`deleteObject failed for ${path}: ${error.message}`);
      return false;
    }
    return true;
  }

  /** path가 안전한 형식인지 검증 — `rooms/{roomId}/{uuid}.{ext}` */
  isValidPath(path: string): boolean {
    // 경로 traversal/escape 방어 + 우리가 발급한 형식만 통과
    return /^rooms\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.[a-z0-9]{2,5}$/.test(path);
  }
}
