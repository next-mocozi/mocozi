import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { UpdatePortfolioMetaDto } from './dto/update-portfolio-meta.dto';
import {
  CreateWorkExperienceDto,
  UpdateWorkExperienceDto,
} from './dto/work-experience.dto';
import {
  CreateExternalActivityDto,
  UpdateExternalActivityDto,
} from './dto/external-activity.dto';
import {
  CreatePortfolioLinkDto,
  UpdatePortfolioLinkDto,
} from './dto/portfolio-link.dto';

/** Portfolio 응답에 항상 포함하는 부속 데이터.
 *  Phase 3에서 추가된 work/activity/link 도 한 번에 묶어 한 응답으로 끝낸다. */
const PORTFOLIO_INCLUDE = {
  items: { orderBy: { createdAt: 'desc' as const } },
  workExperiences: { orderBy: { createdAt: 'desc' as const } },
  activities: { orderBy: { createdAt: 'desc' as const } },
  links: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PortfolioInclude;

/** 포트폴리오 서비스 - 포트폴리오 CRUD */
@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  /** 내 포트폴리오 조회 (없으면 생성).
   *  firstPostAt 이 null 이면 user.createdAt 으로 자동 채움. (onboarding PATCH 가
   *  실패한 사용자 + 카드/work/activity/link 도 0 인 신규 사용자의 ProfilePost 가
   *  "방금 전" 으로 표시되던 현상 차단 — 가입 시점으로 안정화.) */
  async getMyPortfolio(userId: string) {
    let portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: PORTFOLIO_INCLUDE,
    });

    if (!portfolio) {
      portfolio = await this.prisma.portfolio.create({
        data: { userId },
        include: PORTFOLIO_INCLUDE,
      });
    }

    if (!portfolio.firstPostAt) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      });
      if (user?.createdAt) {
        portfolio = await this.prisma.portfolio.update({
          where: { id: portfolio.id },
          data: { firstPostAt: user.createdAt },
          include: PORTFOLIO_INCLUDE,
        });
      }
    }

    return portfolio;
  }

  /** 메인 피드 — 공개(isPublic=true) 포트폴리오 전체.
   *  본인 포트폴리오는 응답에서 제외 (프론트에서 본인은 따로 합침).
   *  Phase 3 첫 버전은 페이지네이션 없이 firstPostAt 내림차순 전체 반환.
   *  사용자 수가 늘어나면 cursor 도입. */
  async getFeed(viewerId: string) {
    const portfolios = await this.prisma.portfolio.findMany({
      where: {
        isPublic: true,
        userId: { not: viewerId },
      },
      include: {
        ...PORTFOLIO_INCLUDE,
        user: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            university: true,
            department: true,
            grade: true,
            bio: true,
            profileImage: true,
            roles: true,
            skills: true,
            // firstPostAt 미설정 사용자의 ProfilePost 시점 fallback 용도.
            // (onboarding PATCH 가 어떤 이유로 실패한 사용자도 자기소개·기술스택만
            //  있으면 메인 피드에 노출되도록.)
            createdAt: true,
          },
        },
      },
      orderBy: [{ firstPostAt: 'desc' }, { id: 'desc' }],
    });
    return { portfolios };
  }

  /** 임의 사용자의 포트폴리오 조회.
   *  - viewer === owner : 비공개 여부와 무관하게 전체 반환
   *  - 그 외 : isPublic=true 면 전체 반환, false 면 메타만 + items/work/activity/link 빈 배열.
   *  사용자 자체가 없거나 portfolio 가 없으면 null.
   *  (없을 때 자동 생성하지 않는다 — 본인 진입 시에만 생성하는 게 자연스러움) */
  async getPortfolioByUserId(viewerId: string, ownerId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId: ownerId },
      include: PORTFOLIO_INCLUDE,
    });
    if (!portfolio) return null;

    const isOwner = viewerId === ownerId;
    if (isOwner || portfolio.isPublic) return portfolio;

    // 비공개 상태에서 타인 조회 — 메타만 노출, 본문은 비움.
    return {
      ...portfolio,
      items: [],
      workExperiences: [],
      activities: [],
      links: [],
    };
  }

  /** 내 포트폴리오 메타 부분 수정 (isPublic, firstPostAt, intro, profileSections, slug) */
  async updateMyMeta(userId: string, dto: UpdatePortfolioMetaDto) {
    const portfolio = await this.getMyPortfolio(userId);
    return this.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(dto.firstPostAt !== undefined
          ? { firstPostAt: new Date(dto.firstPostAt) }
          : {}),
        ...(dto.intro !== undefined ? { intro: dto.intro } : {}),
        ...(dto.profileSections !== undefined
          ? { profileSections: dto.profileSections }
          : {}),
        // slug: null 이면 공유 링크 해제, 문자열이면 설정
        ...(dto.slug !== undefined ? { slug: dto.slug || null } : {}),
      },
    });
  }

  /** slug로 공개 포트폴리오 조회 — 인증 불필요 (public endpoint 전용).
   *  비공개이거나 slug 없으면 null 반환. */
  async getPublicBySlug(slug: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { slug },
      include: {
        ...PORTFOLIO_INCLUDE,
        user: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            university: true,
            department: true,
            grade: true,
            bio: true,
            profileImage: true,
            roles: true,
            skills: true,
          },
        },
      },
    });
    if (!portfolio || !portfolio.isPublic) return null;
    return portfolio;
  }

  /** 포트폴리오 아이템 추가.
   *  firstPostAt 이 미설정 상태에서 첫 항목이 들어오면 그 시점을 firstPostAt 으로
   *  자동 기록한다. (onboarding 모달을 거치지 않고 바로 항목을 추가한 사용자도
   *  메인 피드 ProfilePost 시점이 "방금 전" 으로 영원히 떠버리는 문제 방지.) */
  async createItem(userId: string, dto: CreatePortfolioDto) {
    const portfolio = await this.getMyPortfolio(userId);

    if (!portfolio.firstPostAt) {
      await this.prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { firstPostAt: new Date() },
      });
    }

    const { details, clientCreatedAt, ...rest } = dto;
    return this.prisma.portfolioItem.create({
      data: {
        portfolioId: portfolio.id,
        ...rest,
        ...(clientCreatedAt ? { createdAt: new Date(clientCreatedAt) } : {}),
        ...(details !== undefined
          ? { details: details as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  /** 포트폴리오 아이템 수정 */
  async updateItem(userId: string, itemId: string, dto: UpdatePortfolioDto) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { portfolio: true },
    });

    if (!item) {
      throw new NotFoundException('포트폴리오 아이템을 찾을 수 없습니다.');
    }

    if (item.portfolio.userId !== userId) {
      throw new ForbiddenException(
        '본인의 포트폴리오 아이템만 수정할 수 있습니다.',
      );
    }

    const { details, ...rest } = dto;
    return this.prisma.portfolioItem.update({
      where: { id: itemId },
      data: {
        ...rest,
        ...(details !== undefined
          ? { details: details as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  /** 포트폴리오 아이템 삭제.
   *  Idempotent — 이미 삭제된 itemId(race condition / 중복 클릭) 도 success 처리해
   *  프론트엔드에서 "오류" alert 가 뜨던 문제 fix. 단, 타인 소유 아이템은 403. */
  async deleteItem(userId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { portfolio: true },
    });

    if (!item) {
      // 이미 삭제됨 — idempotent 성공 처리
      return { id: itemId, deleted: true, alreadyMissing: true };
    }

    if (item.portfolio.userId !== userId) {
      throw new ForbiddenException(
        '본인의 포트폴리오 아이템만 삭제할 수 있습니다.',
      );
    }

    return this.prisma.portfolioItem.delete({
      where: { id: itemId },
    });
  }

  // =====================================================
  // Phase 3 — 부속 메타 CRUD (실무경험 / 대외활동 / 외부 링크)
  // =====================================================

  /** 본인 portfolio.id 보장 + firstPostAt 자동 설정 (createItem 과 동일 정책).
   *  부속 메타(work/activity/link) 첫 작성 시점에도 firstPostAt 이 채워지도록. */
  private async ensureOwnedPortfolioId(userId: string): Promise<string> {
    const portfolio = await this.getMyPortfolio(userId);
    if (!portfolio.firstPostAt) {
      await this.prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { firstPostAt: new Date() },
      });
    }
    return portfolio.id;
  }

  // ──── 실무 경험 ────
  async createWorkExperience(userId: string, dto: CreateWorkExperienceDto) {
    const portfolioId = await this.ensureOwnedPortfolioId(userId);
    return this.prisma.portfolioWorkExperience.create({
      data: { portfolioId, ...dto },
    });
  }

  async updateWorkExperience(
    userId: string,
    id: string,
    dto: UpdateWorkExperienceDto,
  ) {
    const row = await this.prisma.portfolioWorkExperience.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!row) throw new NotFoundException('실무 경험을 찾을 수 없습니다.');
    if (row.portfolio.userId !== userId) {
      throw new ForbiddenException('본인의 항목만 수정할 수 있습니다.');
    }
    return this.prisma.portfolioWorkExperience.update({
      where: { id },
      data: dto,
    });
  }

  /** Idempotent — 이미 삭제된 행도 success 처리 (race condition / 중복 클릭). */
  async deleteWorkExperience(userId: string, id: string) {
    const row = await this.prisma.portfolioWorkExperience.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!row) return { id, deleted: true, alreadyMissing: true };
    if (row.portfolio.userId !== userId) {
      throw new ForbiddenException('본인의 항목만 삭제할 수 있습니다.');
    }
    return this.prisma.portfolioWorkExperience.delete({ where: { id } });
  }

  // ──── 대외 활동 ────
  async createActivity(userId: string, dto: CreateExternalActivityDto) {
    const portfolioId = await this.ensureOwnedPortfolioId(userId);
    return this.prisma.portfolioExternalActivity.create({
      data: { portfolioId, ...dto },
    });
  }

  async updateActivity(
    userId: string,
    id: string,
    dto: UpdateExternalActivityDto,
  ) {
    const row = await this.prisma.portfolioExternalActivity.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!row) throw new NotFoundException('대외 활동을 찾을 수 없습니다.');
    if (row.portfolio.userId !== userId) {
      throw new ForbiddenException('본인의 항목만 수정할 수 있습니다.');
    }
    return this.prisma.portfolioExternalActivity.update({
      where: { id },
      data: dto,
    });
  }

  /** Idempotent — 이미 삭제된 행도 success 처리. */
  async deleteActivity(userId: string, id: string) {
    const row = await this.prisma.portfolioExternalActivity.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!row) return { id, deleted: true, alreadyMissing: true };
    if (row.portfolio.userId !== userId) {
      throw new ForbiddenException('본인의 항목만 삭제할 수 있습니다.');
    }
    return this.prisma.portfolioExternalActivity.delete({ where: { id } });
  }

  // ──── 외부 링크 ────
  /** Idempotent — 같은 (portfolioId, url) 이 이미 있으면 새로 만들지 않고 label 만 갱신.
   *  편집 페이지 재저장 시 동일 링크가 중복 INSERT 되어 누적되던 버그를 차단한다.
   *
   *  Prisma upsert 대신 수동 find-or-update 를 쓰는 이유: upsert 의 compound where
   *  (portfolioId_url) 는 DB 에 unique 인덱스가 실제로 존재해야 동작한다. 인덱스는
   *  manual_dedup_portfolio_links.sql 로 별도 적용되므로, 인덱스 적용 전에도 링크
   *  등록이 깨지지 않도록 application 레벨에서 idempotent 를 보장한다. */
  async createLink(userId: string, dto: CreatePortfolioLinkDto) {
    const portfolioId = await this.ensureOwnedPortfolioId(userId);
    const existing = await this.prisma.portfolioLink.findFirst({
      where: { portfolioId, url: dto.url },
    });
    if (existing) {
      return this.prisma.portfolioLink.update({
        where: { id: existing.id },
        data: { label: dto.label ?? null },
      });
    }
    return this.prisma.portfolioLink.create({
      data: { portfolioId, ...dto },
    });
  }

  async updateLink(userId: string, id: string, dto: UpdatePortfolioLinkDto) {
    const row = await this.prisma.portfolioLink.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!row) throw new NotFoundException('링크를 찾을 수 없습니다.');
    if (row.portfolio.userId !== userId) {
      throw new ForbiddenException('본인의 항목만 수정할 수 있습니다.');
    }
    return this.prisma.portfolioLink.update({ where: { id }, data: dto });
  }

  /** Idempotent — 이미 삭제된 행도 success 처리. */
  async deleteLink(userId: string, id: string) {
    const row = await this.prisma.portfolioLink.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!row) return { id, deleted: true, alreadyMissing: true };
    if (row.portfolio.userId !== userId) {
      throw new ForbiddenException('본인의 항목만 삭제할 수 있습니다.');
    }
    return this.prisma.portfolioLink.delete({ where: { id } });
  }
}
