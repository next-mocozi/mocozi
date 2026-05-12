import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageContext, UserMessageTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 사용자별·컨텍스트별 메시지 양식 관리.
 *
 * 동작:
 * - 양식이 없는 컨텍스트 GET 요청 시 자동 default 합성 (DB 미저장, just-in-time)
 *   → 사용자가 처음 양식 카드 진입했을 때 빈 화면 안 보이게
 * - PUT은 upsert (존재하면 갱신, 없으면 생성)
 * - 컨텍스트별 단일 양식 — `(userId, context)` UNIQUE 제약
 */
@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}

  /**
   * 컨텍스트별 양식 조회.
   * DB에 저장된 게 없으면 사용자 프로필 기반 default 양식을 합성해 반환.
   * 합성된 default는 DB에 저장 안 함 — 사용자가 명시 PUT한 시점부터 영구화.
   */
  async getOrBuildDefault(
    userId: string,
    context: MessageContext,
  ): Promise<{ context: MessageContext; content: string; isPersisted: boolean }> {
    const existing = await this.prisma.userMessageTemplate.findUnique({
      where: { userId_context: { userId, context } },
    });
    if (existing) {
      return {
        context: existing.context,
        content: existing.content,
        isPersisted: true,
      };
    }

    // default 합성 — 사용자 정보로 자연스러운 인사 양식
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, roles: true, careerSummary: true },
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    return {
      context,
      content: this.buildDefault(context, user.name, user.roles, user.careerSummary),
      isPersisted: false,
    };
  }

  /**
   * 양식 upsert. 같은 (userId, context) 있으면 갱신, 없으면 생성.
   */
  async upsert(
    userId: string,
    context: MessageContext,
    content: string,
  ): Promise<UserMessageTemplate> {
    return this.prisma.userMessageTemplate.upsert({
      where: { userId_context: { userId, context } },
      create: { userId, context, content },
      update: { content },
    });
  }

  /**
   * 양식 삭제 — 다음 GET 시 default 합성으로 fallback.
   */
  async remove(userId: string, context: MessageContext): Promise<void> {
    await this.prisma.userMessageTemplate
      .delete({
        where: { userId_context: { userId, context } },
      })
      .catch(() => {
        // 멱등 — 이미 없으면 무시
      });
  }

  /**
   * 컨텍스트별 default 양식 합성.
   *
   * Phase A: RECRUIT_INDIVIDUAL / RECRUIT_TEAM 두 가지만 실제로 사용.
   * Phase B 컨텍스트는 enum에 정의됐지만 default는 placeholder 수준으로만.
   *
   * 변수 placeholder는 frontend에서 치환됨 — backend는 raw text만 저장/반환.
   */
  private buildDefault(
    context: MessageContext,
    senderName: string,
    senderRoles: string[],
    careerSummary: string | null,
  ): string {
    const careerLine = careerSummary
      ? `\n${careerSummary}\n`
      : '';

    switch (context) {
      case 'RECRUIT_INDIVIDUAL':
        return `안녕하세요, {recipientName}님!\n${senderName}입니다.\n${careerLine}\n프로필 보고 관심이 생겨 연락드렸습니다.\n자세한 소개는 아래 프로필을 참고해주시면 감사하겠습니다.\n\n[[link:profile:{senderId}|${senderName}의 프로필 보기]]`;

      case 'RECRUIT_TEAM':
        return `안녕하세요, {recipientName}님!\n${senderName}입니다.\n{teamName} 팀에 {role} 분야로 지원하고 싶어 연락드렸습니다.\n${careerLine}\n자세한 소개는 아래 프로필을 참고해주시면 감사하겠습니다.\n\n[[link:profile:{senderId}|${senderName}의 프로필 보기]]`;

      case 'SCOUT_FROM_TEAM':
        // 보내는 사람 = 팀 leader, 받는 사람 = 영입 후보. 핵심 정보는 sender 프로필이 아닌
        // **팀 기획서** (사용자 의견). teamId placeholder는 frontend renderTemplate에서
        // room.contextTargetId로 채워짐.
        return `안녕하세요, {recipientName}님!\n${senderName}입니다. 저희 팀에서 함께 할 분을 찾고 있어 연락드렸습니다.\n저희가 진행 중인 프로젝트는 아래 기획서를 참고해주세요.\n\n[[link:team:{teamId}|팀 기획서 보기]]`;

      // Phase B placeholders — 사용 시점에 정식 default 작성
      case 'PORTFOLIO_COFFEE_CHAT':
        return `안녕하세요, {recipientName}님!\n포트폴리오 흥미롭게 봤어요. 시간 되시면 커피챗 한 번 어떨까요?`;

      case 'PORTFOLIO_FRIENDSHIP':
        return `안녕하세요, {recipientName}님!\n포트폴리오 인상 깊게 봤습니다. 친해지고 싶어 연락드려요.`;

      case 'PORTFOLIO_INQUIRY':
        return `안녕하세요, {recipientName}님!\n포트폴리오 관련해서 문의드릴 게 있어 연락드렸습니다.`;

      case 'PORTFOLIO_COLLAB':
        return `안녕하세요, {recipientName}님!\n포트폴리오 보고 협업 제안 드리고 싶어 연락드렸습니다.`;

      case 'PORTFOLIO_PRAISE':
        return `안녕하세요, {recipientName}님!\n포트폴리오 정말 인상적이라 한 마디 남기고 싶어서요.`;

      case 'COMMUNITY_PRIVATE_NOTE':
        return `안녕하세요, 글 잘 봤습니다.\n관련해서 쪽지 드립니다.`;

      case 'RANDOM_MATCH':
        return `안녕하세요! 모코지에서 매칭됐네요. 반갑습니다.`;

      default:
        return `안녕하세요, {recipientName}님!\n${senderName}입니다.`;
    }
  }
}
