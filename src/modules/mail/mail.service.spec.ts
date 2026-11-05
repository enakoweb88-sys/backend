import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { EMAIL_SENDERS, DEFAULT_REPLY_TO, VERIFIED_EMAIL_DOMAIN, getSenderAddress } from './mail.constants';
import { PrismaService } from '../prisma/prisma.service';

describe('MailService & Resend Integration', () => {
  let service: MailService;
  let mockConfigService: Partial<ConfigService>;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return 'fixture-not-a-real-key';
        if (key === 'SECURITY_ALERT_EMAIL') return 'security-test@enakoos.com';
        return undefined;
      }),
    };

    mockPrismaService = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    // Exercise real message construction with a mocked provider; never send mail.
    service['resend'] = { emails: { send: jest.fn().mockResolvedValue({ data: { id: 'fixture-provider-id' }, error: null }) } } as unknown as NonNullable<typeof service['resend']>;
    service['transporter'] = null;
  });

  describe('1. Initialization & Configuration', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should report failed delivery when no provider is configured', async () => {
      service['resend'] = null;
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test In Simulation Mode',
        html: '<p>Hello world</p>',
      });

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
    });
  });

  describe('2. Verified Domain & Sender Addresses', () => {
    it('should enforce verified domain mail.enakoos.com for all predefined senders', () => {
      expect(VERIFIED_EMAIL_DOMAIN).toBe('mail.enakoos.com');
      expect(EMAIL_SENDERS.SECURITY).toBe('security@mail.enakoos.com');
      expect(EMAIL_SENDERS.NOTIFICATIONS).toBe('notifications@mail.enakoos.com');
      expect(EMAIL_SENDERS.KYC).toBe('kyc@mail.enakoos.com');
      expect(EMAIL_SENDERS.NOREPLY).toBe('noreply@mail.enakoos.com');
      expect(EMAIL_SENDERS.SUPPORT).toBe('support@mail.enakoos.com');
      expect(EMAIL_SENDERS.HELP).toBe('help@mail.enakoos.com');
      expect(EMAIL_SENDERS.CONTACT).toBe('contact@mail.enakoos.com');

      Object.values(EMAIL_SENDERS).forEach((addr) => {
        expect(addr.endsWith(`@${VERIFIED_EMAIL_DOMAIN}`)).toBe(true);
      });
    });

    it('should format sender string with display name and verified domain address', () => {
      const formattedKyc = getSenderAddress('KYC');
      expect(formattedKyc).toBe('"ENAKO KYC Team" <kyc@mail.enakoos.com>');

      const formattedSecurity = getSenderAddress('SECURITY');
      expect(formattedSecurity).toBe('"ENAKO Security" <security@mail.enakoos.com>');
    });

    it('should default Reply-To to support@enakoos.com for automated dispatches', () => {
      expect(DEFAULT_REPLY_TO).toBe('support@enakoos.com');
    });
  });

  describe('3. Transactional Business Workflows', () => {
    it('should dispatch KYC Submission Received alert safely', async () => {
      const res = await service.sendKycSubmissionReceived('applicant@example.com', 'Alex Smith', 'kyc-sub-12345');
      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it('should dispatch KYC Approval notification safely', async () => {
      const res = await service.sendKycApproved('applicant@example.com', 'Alex Smith');
      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it('should dispatch KYC Rejection alert safely', async () => {
      const res = await service.sendKycRejected(
        'applicant@example.com',
        'Alex Smith',
        'Document image was blurry and unreadable.',
      );
      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it('should dispatch Task Assigned alert safely', async () => {
      const res = await service.sendTaskAssignedAlert({
        toEmail: 'dev@enakoos.com',
        assigneeName: 'Jane Developer',
        assignerName: 'Operations Lead',
        taskTitle: 'Audit Quarterly Invoices',
        priority: 'HIGH',
      });
      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it('should dispatch Password Changed alert safely', async () => {
      const res = await service.sendPasswordChangedAlert('staff@enakoos.com', 'Staff Member');
      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });
  });

  describe('4. Error Handling & Resilience', () => {
    it('should reject dispatch gracefully if recipient email is invalid or missing', async () => {
      const res = await service.sendEmail({
        to: 'invalid-address-without-at',
        subject: 'Test Subject',
        html: '<p>Content</p>',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('should never throw an unhandled exception when audit log fails', async () => {
      mockPrismaService.auditLog.create.mockRejectedValueOnce(new Error('DB unreachable'));

      const res = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test With Audit Failure',
        html: '<p>Should still succeed</p>',
      });

      expect(res.success).toBe(true);
    });
  });
});
