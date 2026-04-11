import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

/** 회원가입 요청 DTO */
export class RegisterDto {
  /** 대학교 메일 주소 (.ac.kr 필수) */
  @IsEmail()
  @Matches(/\.ac\.kr$/, { message: '대학교 메일(.ac.kr)만 사용 가능합니다.' })
  email: string;

  /** 비밀번호 (최소 8자) */
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;

  /** 이름 */
  @IsString()
  @IsNotEmpty({ message: '이름을 입력해주세요.' })
  name: string;

  /** 대학교명 */
  @IsString()
  @IsNotEmpty({ message: '대학교를 입력해주세요.' })
  university: string;

  /** 학과 */
  @IsString()
  @IsNotEmpty({ message: '학과를 입력해주세요.' })
  department: string;
}
