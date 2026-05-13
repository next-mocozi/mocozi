/**
 * 채팅 첫 메시지 양식 시스템 — frontend 헬퍼.
 *
 * Backend는 raw template만 저장. 변수 치환과 attachment 마커 파싱은 모두 frontend.
 *
 * Placeholder 형식: {senderName}, {recipientName}, {role}, {teamName}, {senderId}, {profileUrl}
 * Attachment 마커: [[link:<type>:<targetId>|<label>]]
 *   - <type>: profile / portfolio / team / external
 *   - 메시지 본문에서 마커 제거 → 텍스트만 표시 + 둥근사각형 버튼 별도 렌더
 */

import type { MessageContext } from '@/types/chat';

export interface TemplateVars {
  senderName: string;
  senderId: string;
  recipientName: string;
  /** RECRUIT_TEAM의 직군 선택 결과 */
  role?: string;
  teamName?: string;
  /** SCOUT_FROM_TEAM 등 팀 컨텍스트의 teamId — 기획서 marker `{teamId}` 치환에 사용. */
  teamId?: string;
  /** 사용자 프로필 URL (자동 합성) */
  profileUrl: string;
}

/**
 * 양식 본문의 {key} placeholder를 vars로 치환.
 * 누락된 key는 빈 문자열로 치환 — UI 깨짐 방지.
 */
export function renderTemplate(content: string, vars: TemplateVars): string {
  const lookup = vars as unknown as Record<string, string | undefined>;
  return content.replace(/\{(\w+)\}/g, (_, key: string) => lookup[key] ?? '');
}

/**
 * 사용자 프로필 정보로 default 양식 생성 (frontend fallback).
 *
 * Backend의 `getOrBuildDefault`도 같은 합성 로직을 가짐 — 일반적으로 backend 결과를 사용하고
 * 이 함수는 backend 미응답 / 오프라인 케이스에서만 fallback으로 호출.
 */
export function buildDefaultTemplate(
  context: MessageContext,
  user: { lastName: string; firstName: string; roles: string[]; careerSummary: string | null },
): string {
  const fullName = user.lastName + user.firstName;
  const careerLine = user.careerSummary ? `\n${user.careerSummary}\n` : '';

  switch (context) {
    case 'RECRUIT_INDIVIDUAL':
      return `안녕하세요, {recipientName}님!\n${fullName}입니다.\n${careerLine}\n프로필 보고 관심이 생겨 연락드렸습니다.\n자세한 소개는 아래 프로필을 참고해주시면 감사하겠습니다.\n\n[[link:profile:{senderId}|${fullName}의 프로필 보기]]`;

    case 'RECRUIT_TEAM':
      return `안녕하세요, {recipientName}님!\n${fullName}입니다.\n{teamName} 팀에 {role} 분야로 지원하고 싶어 연락드렸습니다.\n${careerLine}\n자세한 소개는 아래 프로필을 참고해주시면 감사하겠습니다.\n\n[[link:profile:{senderId}|${fullName}의 프로필 보기]]`;

    case 'SCOUT_FROM_TEAM':
      // 보내는 사람 = 팀 leader, 받는 사람 = 영입 후보. 핵심 정보는 sender 프로필이 아닌
      // **팀 기획서** (사용자 의견). teamId는 vars로 채워짐.
      return `안녕하세요, {recipientName}님!\n${fullName}입니다. 저희 팀에서 함께 할 분을 찾고 있어 연락드렸습니다.\n저희가 진행 중인 프로젝트는 아래 기획서를 참고해주세요.\n\n[[link:team:{teamId}|팀 기획서 보기]]`;

    default:
      return `안녕하세요, {recipientName}님!\n${fullName}입니다.\n\n[[link:profile:{senderId}|${fullName}의 프로필 보기]]`;
  }
}

/**
 * Attachment 마커 파싱 결과.
 * 메시지 본문에서 모든 마커를 추출하고, 본문에서 마커 텍스트는 제거된 cleanContent를 함께 반환.
 *
 * 두 종류:
 *  - **인앱 link**: `[[link:profile|portfolio|team|external:target|label]]`
 *  - **첨부 파일/이미지** (§16): `[[file:storagePath|filename|sizeBytes|mime]]`,
 *    `[[image:storagePath|alt|sizeBytes|mime]]`
 *    — target에 storage path, url은 backend sign endpoint로 별도 주입(런타임에 추가)
 */
/** 첨부 파일/이미지 공통 메타 */
interface ParsedAttachmentMediaBase {
  target: string; // storage path
  label: string; // filename / alt
  size: number; // bytes
  mime: string; // e.g. application/pdf
  /** backend sign endpoint가 발급한 1h TTL URL. 표시 시점에 주입 */
  url?: string;
}

// 각 type을 별도 variant로 분리 — `Extract<ParsedAttachment, { type: 'file' }>` 등 narrow 가능
export type ParsedAttachment =
  | { type: 'profile'; target: string; label: string }
  | { type: 'portfolio'; target: string; label: string }
  | { type: 'team'; target: string; label: string }
  | { type: 'external'; target: string; label: string }
  | ({ type: 'file' } & ParsedAttachmentMediaBase)
  | ({ type: 'image' } & ParsedAttachmentMediaBase);

export interface ParsedMessage {
  /** 마커가 제거된 본문 (메시지 풍선에 표시) */
  cleanContent: string;
  /** 추출된 attachment 목록 (메시지 풍선 아래 둥근사각형 버튼으로 렌더) */
  attachments: ParsedAttachment[];
}

/**
 * 메시지 본문에서 [[link:type:target|label]] 마커를 모두 추출하고 본문에서 제거.
 *
 * 입력: "안녕하세요\n\n[[link:profile:abc-123|김철수의 프로필]]"
 * 출력:
 *   { cleanContent: "안녕하세요", attachments: [{type:'profile', target:'abc-123', label:'김철수의 프로필'}] }
 *
 * 마커 형식이 잘못된 경우 무시 — 본문에 그대로 남김.
 */
/**
 * 통합 마커 regex — 인앱 link + file/image 첨부 모두 처리.
 *
 * - `[[link:profile|portfolio|team|external:target|label]]` (3개 capture group: linkType, target, label)
 * - `[[file:path|name|size|mime]]` / `[[image:path|name|size|mime]]` (4개 추가: target, label, size, mime)
 *
 * 정렬: link variant 먼저 매치 → file/image
 */
const ATTACHMENT_REGEX =
  /\[\[(?:link:(profile|portfolio|team|external):([^|\]]+)\|([^\]]+)|(file|image):([^|\]]+)\|([^|\]]*)\|(\d+)\|([^\]]+))\]\]/g;

export function parseAttachmentMarker(content: string): ParsedMessage {
  const attachments: ParsedAttachment[] = [];
  const re = new RegExp(ATTACHMENT_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match[1]) {
      // link 매치
      attachments.push({
        type: match[1] as 'profile' | 'portfolio' | 'team' | 'external',
        target: match[2].trim(),
        label: match[3].trim(),
      });
    } else if (match[4]) {
      // file / image 매치
      attachments.push({
        type: match[4] as 'file' | 'image',
        target: match[5].trim(),
        label: match[6].trim(),
        size: Number(match[7]),
        mime: match[8].trim(),
      });
    }
  }

  // 마커 제거 + 마커 주변 빈 줄 정리 (양식 본문에 trailing newline 자주 들어감)
  const cleanContent = content
    .replace(new RegExp(ATTACHMENT_REGEX.source, 'g'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanContent, attachments };
}

/**
 * RoomList / ToastContainer 등 preview 표시용 — 마커를 사람용 요약으로 변환.
 *
 * 규칙:
 *  - 인앱 link 마커 → label만 (예: "[[link:profile:abc|김철수의 프로필]]" → "김철수의 프로필")
 *  - 텍스트 있으면 텍스트 우선 표시 + 첨부 종류 라벨 append:
 *      · 텍스트 + 이미지(만)            → "텍스트 (이미지)"
 *      · 텍스트 + 파일(만)              → "텍스트 (파일)"
 *      · 텍스트 + 이미지·파일 혼합      → "텍스트 (파일)" (혼합은 파일로 통합)
 *  - 텍스트 없고 첨부만 있으면:
 *      · 이미지만 → "이미지를 보냈습니다."
 *      · 그 외(파일만 / 혼합) → "파일을 보냈습니다."
 *  - 빈 메시지 fallback → "메시지가 없습니다."
 */
export function summarizePreview(raw: string | null | undefined): string {
  if (!raw) return '메시지가 없습니다.';

  // 1. 인앱 link 마커 → label만
  let s = raw.replace(/\[\[link:[^|\]]+\|([^\]]+)\]\]/g, '$1');

  // 2. 첨부 마커 존재 여부 체크 (제거 전)
  const hasFile = /\[\[file:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/.test(s);
  const hasImage = /\[\[image:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/.test(s);

  // 3. 첨부 마커 제거 + 공백 정리
  s = s
    .replace(/\[\[file:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/g, '')
    .replace(/\[\[image:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 4. 텍스트 있음 — 첨부 종류에 따라 라벨 append
  if (s) {
    if (hasFile) return `${s} (파일)`; // 파일 단독 또는 이미지+파일 혼합 → "(파일)"
    if (hasImage) return `${s} (이미지)`;
    return s;
  }

  // 5. 텍스트 없음 — 첨부 종류 안내 문구
  if (hasFile) return '파일을 보냈습니다.';
  if (hasImage) return '이미지를 보냈습니다.';
  return '메시지가 없습니다.';
}

/**
 * 사용자가 양식을 보낼 때 마지막에 attachment 마커 보장.
 * 양식 본문에 이미 마커가 있으면 그대로, 없으면 context에 맞는 marker 자동 추가:
 *   - SCOUT_FROM_TEAM: 팀 기획서 marker (사용자가 마커 없는 양식으로 저장했어도 안전망)
 *   - 그 외: sender 프로필 marker (기존 동작 유지)
 */
export function ensureContextAttachment(
  content: string,
  ctx: {
    context: MessageContext | null;
    contextTargetId: string | null;
    senderId: string;
    senderName: string;
  },
): string {
  if (content.includes('[[link:')) return content;
  if (ctx.context === 'SCOUT_FROM_TEAM' && ctx.contextTargetId) {
    return `${content}\n\n[[link:team:${ctx.contextTargetId}|팀 기획서 보기]]`;
  }
  return `${content}\n\n[[link:profile:${ctx.senderId}|${ctx.senderName}의 프로필 보기]]`;
}
