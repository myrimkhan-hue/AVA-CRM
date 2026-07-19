import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService, AuthResponse } from './auth.service';
import { AuthUser } from './auth-user.type';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@CurrentUser() user: AuthUser): Promise<AuthResponse> {
    return this.authService.refresh(user);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
