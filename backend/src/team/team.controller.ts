import { Controller } from '@nestjs/common';
import { TeamService } from './team.service';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // TODO: POST   /teams              → 팀 생성
  // TODO: POST   /teams/:id/proposal → 기획서 등록
  // TODO: GET    /teams              → 팀 목록
  // TODO: GET    /teams/:id          → 팀 상세
  // TODO: PATCH  /teams/:id/proposal/visibility → 공개 범위 설정
}
