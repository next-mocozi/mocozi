import { IsString, IsNotEmpty } from 'class-validator';

export class ScoutDto {
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsNotEmpty({ message: '메시지를 입력해주세요.' })
  message: string;
}
