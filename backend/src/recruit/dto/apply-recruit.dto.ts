import { IsString, IsNotEmpty } from 'class-validator';

/** 구인 지원 DTO */
export class ApplyRecruitDto {
  /** 지원 메시지 */
  @IsString()
  @IsNotEmpty({ message: '지원 메시지를 입력해주세요.' })
  message: string;
}
