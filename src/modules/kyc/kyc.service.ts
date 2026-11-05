import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  findDocument(submissionId: string, id: string) {
    return this.prisma.kycDocument.findFirst({ where: { id, submissionId } });
  }

  async submit(body: {
    applicantType: string;
    applicantName: string;
    email?: string;
    phone?: string;
    payload: Record<string, unknown>;
    documents?: Array<{ documentType: string; fileName: string; fileUrl: string; mimeType?: string }>;
  }, prepared: Array<any> = []) {
    const submission = await this.prisma.$transaction(async tx => {
    const created = await tx.kycSubmission.create({
      data: {
        applicantType: body.applicantType,
        applicantName: body.applicantName,
        email: body.email,
        phone: body.phone,
        payload: body.payload as any,
        documents: prepared.length ? { create: prepared.map(file => ({ documentType: file.documentType, fileName: file.fileName, mimeType: file.mimeType, fileUrl: '/api/v1/files/private/' + file.id })) } : undefined,
      },
      include: { documents: true },
    });

    for (const file of prepared) { const { documentType, ...data } = file; await tx.secureFile.create({ data: { ...data, parentId: created.id, expiresAt: null } }); }
    await tx.auditLog.create({ data: { action: 'KYC_SUBMITTED', entity: 'kyc', entityId: created.id } });
    return created;
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
    if (!['CEO', 'MANAGER'].includes(user.role)) throw new ForbiddenException('KYC review permission required');
    if (dto.status === KycStatus.APPROVED && user.role !== RoleName.CEO) throw new ForbiddenException('Final KYC approval requires the CEO');
    const current = await this.prisma.kycSubmission.findUnique({ where: { id }, include: { documents: true } });
    if (!current) throw new NotFoundException('KYC submission not found');
    if (current.status === dto.status) return current;
    if (current.status === KycStatus.APPROVED) throw new ConflictException('Approved KYC is read-only');
    if (dto.status === KycStatus.APPROVED && current.email?.toLowerCase() === user.email.toLowerCase()) throw new ForbiddenException('You cannot approve your own KYC');
    const approved = dto.status === KycStatus.APPROVED && user.role === RoleName.CEO;
    const submission = await this.prisma.$transaction(async tx => {
    const changed = await tx.kycSubmission.updateMany({
      where: { id, status: current.status },
      data: {
        status: dto.status as any,
        rejectionReason: dto.rejectionReason,
        reviewedById: user.sub,
        reviewedAt: new Date(),
        ...(approved ? { approvedById: user.sub, approvedAt: new Date() } : {}),
      },
    });
    if (changed.count !== 1) throw new ConflictException('KYC review changed concurrently');
    await tx.auditLog.create({ data: { actorId: user.sub, action: 'KYC_REVIEWED', entity: 'kyc', entityId: id, metadata: { status: dto.status } } });
    return tx.kycSubmission.findUniqueOrThrow({ where: { id }, include: { documents: true } });
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

