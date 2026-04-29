import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
// TODO: 로그인 요청 데이터 정의
export class LoginDto {
  @IsEmail()
  @IsNotEmpty({message: '이메일을 입력해주세요.'})
  email: string;

  @IsString()
  @IsNotEmpty({message: '비밀번호를 입력해주세요.'})
  password: string;
}