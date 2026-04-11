/** 채팅방 */
export interface ChatRoom {
  id: string;
  /** 참여자 ID 목록 */
  participants: string[];
  /** 마지막 메시지 */
  lastMessage: string | null;
  updatedAt: Date;
}

/** 채팅 메시지 */
export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  /** 읽은 사용자 ID 목록 */
  readBy: string[];
}
