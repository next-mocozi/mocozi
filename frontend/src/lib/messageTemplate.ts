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
  user: { name: string; roles: string[]; careerSummary: string | null },
): string {
  const careerLine = user.careerSummary ? `\n${user.careerSummary}\n` : '';

  switch (context) {
    case 'RECRUIT_INDIVIDUAL':
      return `안녕하세요, {recipientName}님!\n${user.name}입니다.\n${careerLine}\n프로필 보고 관심이 생겨 연락드렸습니다.\n자세한 소개는 아래 프로필을 참고해주시면 감사하겠습니다.\n\n[[link:profile:{senderId}|${user.name}의 프로필 보기]]`;

    case 'RECRUIT_TEAM':
      return `안녕하세요, {recipientName}님!\n${user.name}입니다.\n{teamName} 팀에 {role} 분야로 지원하고 싶어 연락드렸습니다.\n${careerLine}\n자세한 소개는 아래 프로필을 참고해주시면 감사하겠습니다.\n\n[[link:profile:{senderId}|${user.name}의 프로필 보기]]`;

    default:
      return `안녕하세요, {recipientName}님!\n${user.name}입니다.\n\n[[link:profile:{senderId}|${user.name}의 프로필 보기]]`;
  }
}

/**
 * Attachment 마커 파싱 결과.
 * 메시지 본문에서 모든 마커를 추출하고, 본문에서 마커 텍스트는 제거된 cleanContent를 함께 반환.
 */
export interface ParsedAttachment {
  type: 'profile' | 'portfolio' | 'team' | 'external';
  target: string;
  label: string;
}

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
export function parseAttachmentMarker(content: string): ParsedMessage {
  const ATTACHMENT_REGEX =
    /\[\[link:(profile|portfolio|team|external):([^|\]]+)\|([^\]]+)\]\]/g;

  const attachments: ParsedAttachment[] = [];
  let match: RegExpExecArray | null;

  while ((match = ATTACHMENT_REGEX.exec(content)) !== null) {
    attachments.push({
      type: match[1] as ParsedAttachment['type'],
      target: match[2].trim(),
      label: match[3].trim(),
    });
  }

  // 마커 제거 + 마커 주변 빈 줄 정리 (양식 본문에 trailing newline 자주 들어감)
  const cleanContent = content
    .replace(ATTACHMENT_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanContent, attachments };
}

/**
 * 사용자가 양식을 보낼 때 마지막에 붙일 attachment 마커 합성.
 * 양식 본문 자체에 이미 마커가 있으면 그것 사용, 없으면 자동 추가.
 */
export function ensureProfileAttachment(
  content: string,
  senderId: string,
  senderName: string,
): string {
  if (content.includes('[[link:')) return content;
  return `${content}\n\n[[link:profile:${senderId}|${senderName}의 프로필 보기]]`;
}
