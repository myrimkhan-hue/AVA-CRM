import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth-user.type';
import { LoginDto } from './dto/login.dto';

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const authUser: AuthUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles.map(({ role }) => role.code),
      departmentId: user.departmentId,
    };
    return this.issueToken(authUser);
  }

  async refresh(user: AuthUser): Promise<AuthResponse> {
    return this.issueToken(user);
  }

  private async issueToken(user: AuthUser): Promise<AuthResponse> {
    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id }),
      user,
    };
  }
}
