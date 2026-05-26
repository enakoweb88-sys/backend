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
        payload: body.payload,
        documents: body.documents?.length ? { create: body.documents } : undefined,
      },
      include: { documents: true },
    });
  }

  list(query: QueryDto & { status?: KycStatus }) {
    return this.prisma.kycSubmission.findMany({
      where: {
        status: query.status,
        ...(query.search
          ? {
              OR: [
                { applicantName: { contains: query.search, mode: 'insensitive' as const } },
                { email: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { documents: true, reviewedBy: { select: { fullName: true } }, approvedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  async review(id: string, dto: KycReviewDto, user: JwtUser) {
    const approved = dto.status === KycStatus.APPROVED && user.role === RoleName.CEO;
    return this.prisma.kycSubmission.update({
      where: { id },
      data: {
        status: dto.status as KycStatus,
        rejectionReason: dto.rejectionReason,
        reviewedById: user.sub,
        reviewedAt: new Date(),
        approvedById: approved ? user.sub : undefined,
        approvedAt: approved ? new Date() : undefined,
      },
      include: { documents: true },
    });
  }
}
