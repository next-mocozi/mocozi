import { IsString, IsNotEmpty } from 'class-validator';

/** 팀 생성 요청 DTO */
export class CreateTeamDto {
  /** 팀명 */
  @IsString()
  @IsNotEmpty({ message: '팀명을 입력해주세요.' })
  name: string;
}
