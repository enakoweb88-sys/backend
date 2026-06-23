import { Injectable } from '@nestjs/common';
import { KycStatus, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { KycReviewDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  submit(body: {
    applicantType: string;
    applicantName: string;
    email?: string;
    phone?: string;
    payload: Record<string, unknown>;
    documents?: Array<{ documentType: string; fileName: string; fileUrl: string; mimeType?: string }>;
  }) {
    return this.prisma.kycSubmission.create({
      data: {
        applicantType: body.applicantType,
        applicantName: body.applicantName,
        email: body.email,
        phone: body.phone,
        payload: body.payload as any,
        documents: body.documents?.length ? { create: body.documents } : undefined,
      },
      include: { documents: true },
    });
  }

  list(query: QueryDto & { status?: string }) {
    return this.prisma.kycSubmission.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                { applicantName: { contains: query.search, mode: 'insensitive' as const } },
                { email: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        documents: true,
        reviewedBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ? Number(query.limit) : 50,
    });
  }

  async review(id: string, dto: KycReviewDto, user: JwtUser) {
    const approved = dto.status === KycStatus.APPROVED && user.role === RoleName.CEO;
    return this.prisma.kycSubmission.update({
      where: { id },
      data: {
        status: dto.status as any,
        rejectionReason: dto.rejectionReason,
        reviewedById: user.sub,
        reviewedAt: new Date(),
        ...(approved ? { approvedById: user.sub, approvedAt: new Date() } : {}),
      },
      include: { documents: true },
    });
  }
}
