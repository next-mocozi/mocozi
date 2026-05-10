import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { UpdatePortfolioMetaDto } from './dto/update-portfolio-meta.dto';

/** 포트폴리오 서비스 - 포트폴리오 CRUD */
@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  /** 내 포트폴리오 조회 (없으면 생성) */
  async getMyPortfolio(userId: string) {
    let portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: { items: { orderBy: { createdAt: 'desc' } } },
    });

    if (!portfolio) {
      portfolio = await this.prisma.portfolio.create({
        data: { userId },
        include: { items: true },
      });
    }

    return portfolio;
  }

  /** 내 포트폴리오 메타 부분 수정 (isPublic, firstPostAt) */
  async updateMyMeta(userId: string, dto: UpdatePortfolioMetaDto) {
    const portfolio = await this.getMyPortfolio(userId);
    return this.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(dto.firstPostAt !== undefined
          ? { firstPostAt: new Date(dto.firstPostAt) }
          : {}),
      },
    });
  }

  /** 포트폴리오 아이템 추가 */
  async createItem(userId: string, dto: CreatePortfolioDto) {
    const portfolio = await this.getMyPortfolio(userId);

    const { details, ...rest } = dto;
    return this.prisma.portfolioItem.create({
      data: {
        portfolioId: portfolio.id,
        ...rest,
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
      throw new ForbiddenException('본인의 포트폴리오 아이템만 수정할 수 있습니다.');
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

  /** 포트폴리오 아이템 삭제 */
  async deleteItem(userId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { portfolio: true },
    });

    if (!item) {
      throw new NotFoundException('포트폴리오 아이템을 찾을 수 없습니다.');
    }

    if (item.portfolio.userId !== userId) {
      throw new ForbiddenException('본인의 포트폴리오 아이템만 삭제할 수 있습니다.');
    }

    return this.prisma.portfolioItem.delete({
      where: { id: itemId },
    });
  }
}
