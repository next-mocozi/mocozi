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
