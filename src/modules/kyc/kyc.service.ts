import { Injectable, Logger } from '@nestjs/common';
import { KycStatus, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { KycReviewDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async submit(body: {
    applicantType: string;
    applicantName: string;
    email?: string;
    phone?: string;
    payload: Record<string, unknown>;
    documents?: Array<{ documentType: string; fileName: string; fileUrl: string; mimeType?: string }>;
  }) {
    const submission = await this.prisma.kycSubmission.create({
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

    // Dispatch confirmation email to applicant via Resend (kyc@mail.enakoos.com)
    if (body.email) {
      this.mailService
        .sendKycSubmissionReceived(body.email, body.applicantName, submission.id)
        .catch((err) => {
          this.logger.error(`Failed to send KYC confirmation email to ${body.email}: ${err?.message}`);
        });
    }

    return submission;
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
    const submission = await this.prisma.kycSubmission.update({
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

    // Transactional KYC decision notifications via Resend (kyc@mail.enakoos.com)
    if (submission.email) {
      if (dto.status === KycStatus.APPROVED) {
        this.mailService
          .sendKycApproved(submission.email, submission.applicantName)
          .catch((err) => {
            this.logger.error(`Failed to send KYC approval email to ${submission.email}: ${err?.message}`);
          });
      } else if (dto.status === KycStatus.REJECTED) {
        this.mailService
          .sendKycRejected(submission.email, submission.applicantName, dto.rejectionReason)
          .catch((err) => {
            this.logger.error(`Failed to send KYC rejection email to ${submission.email}: ${err?.message}`);
          });
      }
    }

    return submission;
  }
}

