/**
 * §B-DM-9 알림 타입 — backend Notification 모델과 1:1 매칭.
 *
 * Backend Prisma의 Notification + NotificationType enum을 그대로 미러.
 * Phase 후속에서 카테고리 추가 시 양쪽 동시 갱신.
 */

export type NotificationType =
  | 'CHAT_NEW_REQUEST'
  | 'APPLICATION_RECEIVED'
  | 'APPLICATION_PROCESSED';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** 클릭 시 router.push할 경로. 예: `/chat/<roomId>`, `/team/<id>/applications` */
  linkTo: string | null;
  /** null이면 안 읽음 */
  readAt: string | null;
  createdAt: string;
}
