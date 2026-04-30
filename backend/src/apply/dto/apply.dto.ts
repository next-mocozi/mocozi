import { IsString, IsNotEmpty } from 'class-validator';

export class ApplyDto {
  @IsString()
  @IsNotEmpty({ message: '지원 메시지를 입력해주세요.' })
  message: string;
}
