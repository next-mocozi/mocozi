import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // TODO: POST /auth/register
  // TODO: POST /auth/login
  // TODO: GET /auth/verify-email
}
