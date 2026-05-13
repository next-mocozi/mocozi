import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** 사용자 컨트롤러 - 프로필 조회/수정 API */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** GET /users/me - 내 프로필 조회 */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyProfile(@CurrentUser() user: { id: string }) {
    return this.userService.getProfile(user.id);
  }

  /**
   * GET /users/count - 전체 가입자 수 (랜딩 페이지 CTA용, 공개).
   * 인증 불필요 — 비로그인 방문자도 통계 노출.
   * :id 라우트 위에 둬야 'count'가 id로 잡히지 않음 (NestJS 선언 순서 매칭).
   */
  @Get('count')
  async getUserCount() {
    const count = await this.userService.getUserCount();
    return { count };
  }

  /** GET /users/:id - 다른 사용자 프로필 조회 */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getProfile(@Param('id') id: string) {
    return this.userService.getProfile(id);
  }

  /** PUT /users/me - 내 프로필 수정 */
  @UseGuards(JwtAuthGuard)
  @Put('me')
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }
}
