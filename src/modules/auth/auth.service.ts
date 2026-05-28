import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { role: true, department: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');
    if (user.role.name !== dto.role) throw new ForbiddenException('This account is not assigned to the selected role');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(user.id, user.email, user.role.name);

    return { user: this.publicUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { include: { role: true, department: true } } },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const tokenRecord = (
      await Promise.all(candidates.map(async token => ((await bcrypt.compare(refreshToken, token.tokenHash)) ? token : null)))
    ).find(Boolean);

    if (!tokenRecord) throw new UnauthorizedException('Invalid refresh token');

    return {
      user: this.publicUser(tokenRecord.user),
      ...(await this.issueTokens(tokenRecord.user.id, tokenRecord.user.email, tokenRecord.user.role.name)),
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: await bcrypt.hash(refreshToken, 12),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private publicUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: { name: string };
    department?: { name: string } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      department: user.department?.name ?? null,
    };
  }
}
