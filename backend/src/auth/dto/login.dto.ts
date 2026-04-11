import { IsEmail, IsString, MinLength } from 'class-validator';

/** 로그인 요청 DTO */
export class LoginDto {
  /** 이메일 */
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  /** 비밀번호 */
  @IsString()
  @MinLength(8)
  password: string;
}
