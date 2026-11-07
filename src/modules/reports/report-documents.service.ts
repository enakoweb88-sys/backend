import { previewMimeType, attachmentDisposition } from '../../common/document-content';
export { previewMimeType, attachmentDisposition } from '../../common/document-content';
import { SecureFilesService } from '../files/secure-files.service';
import { assertNonExecutableDocument } from '../../common/upload-validation';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { JwtUser } from "../../common/current-user.decorator";
import { ReportsService } from "./reports.service";

export const REPORT_FILE_LIMIT = 20 * 1024 * 1024;
export const REPORT_FILE_COUNT = 5;
export const reportDocumentMetadata = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

@Injectable()
export class ReportDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly secureFiles: SecureFilesService,
  ) {}



  async save(
    body: {
      title?: string;
      note?: string;
      type?: string;
      status?: string;
      retainedDocumentIds?: string;
    },
    files: Express.Multer.File[],
    user: JwtUser,
    reportId?: string,
  ) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!title || title.length > 200)
      throw new BadRequestException(
        "Enter a report title of up to 200 characters",
      );
    if (note.length > 4000)
      throw new BadRequestException(
        "The note must be at most 4,000 characters",
      );
    const type = body.type || "DAILY";
    if (!["DAILY", "WEEKLY", "MONTHLY", "GENERAL"].includes(type))
      throw new BadRequestException("Invalid report type");
    const status = body.status || "SUBMITTED";
    if (!["DRAFT", "SUBMITTED"].includes(status))
      throw new BadRequestException("Choose draft or submit");
    if (
      files.length > REPORT_FILE_COUNT ||
      files.some(
        (file) =>
          !file.buffer?.length || file.buffer.length > REPORT_FILE_LIMIT,
      )
    ) {
      throw new BadRequestException(
        "Upload up to 5 non-empty documents, at most 20 MB each",
      );
    }
    let retained: string[] | undefined;
    if (body.retainedDocumentIds !== undefined) {
      try {
        retained = JSON.parse(body.retainedDocumentIds);
      } catch {
        throw new BadRequestException("Invalid retained document list");
      }
      if (
        !Array.isArray(retained) ||
        retained.some((id) => typeof id !== "string")
      )
        throw new BadRequestException("Invalid retained document list");
      retained = [...new Set(retained)];
    }
    for (const file of files) {
      assertNonExecutableDocument(file.originalname, file.buffer);
      await this.secureFiles.scan(file.buffer);
    }
    const newDocuments = files.map((file) => ({
      originalName:
        file.originalname
          .split(/[\\/]/)
          .pop()
          ?.replace(/[\x00-\x1f\x7f]/g, "_")
          .slice(0, 250) || "document",
      mimeType: previewMimeType(file.originalname, file.buffer),
      sizeBytes: file.buffer.length,
      sha256: createHash("sha256").update(file.buffer).digest("hex"),
      data: file.buffer,
    }));
    return this.prisma
      .$transaction(
        async (tx) => {
          const existing = reportId
            ? await tx.dailyReport.findFirst({
                where: { id: reportId, userId: user.sub },
                include: { documents: { select: reportDocumentMetadata } },
              })
            : null;
          if (reportId && !existing)
            throw new NotFoundException("Report not found");
          if (existing?.status === "VERIFIED" || existing?.ceoCompletedAt)
            throw new ForbiddenException(
              "Accepted or completed reports cannot be revised",
            );
          if (existing && existing.status !== "DRAFT" && status === "DRAFT")
            throw new BadRequestException(
              "Submitted reports cannot be made private again",
            );
          if (existing?.type === "FIELD")
            throw new BadRequestException(
              "Revise field reports from the field reporting workspace",
            );
          const available =
            existing?.documents.map((document) => document.id) || [];
          const keep = retained ?? available;
          if (keep.some((id) => !available.includes(id)))
            throw new BadRequestException(
              "A document does not belong to this report",
            );
          if (
            keep.length + files.length < 1 ||
            keep.length + files.length > REPORT_FILE_COUNT
          )
            throw new BadRequestException("Attach between 1 and 5 documents");
          const include = {
            user: { select: { id: true, fullName: true, email: true } },
            reviewer: { select: { id: true, fullName: true } },
            documents: { select: reportDocumentMetadata },
          };
          const content = `Title: ${title}\n\n${note}`;
          const report = existing
            ? await tx.dailyReport.update({
                where: {
                  id: existing.id,
                  updatedAt: existing.updatedAt,
                  status: existing.status,
                  ceoCompletedAt: null,
                },
                data: {
                  content,
                  type,
                  status,
                  reviewerId: null,
                  reviewerComments: null,
                  reviewedAt: null,
                  documents: {
                    deleteMany: { id: { notIn: keep } },
                    create: newDocuments,
                  },
                },
                include,
              })
            : await tx.dailyReport.create({
                data: {
                  content,
                  type,
                  status,
                  userId: user.sub,
                  documents: { create: newDocuments },
                },
                include,
              });
          if (status === "SUBMITTED")
            await this.reports.notifyReviewers(tx, report, user.role);
          return report;
        },
        { timeout: 60_000 },
      )
      .catch((error: unknown) => {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          throw new BadRequestException(
            "This report changed. Reload it before resubmitting your documents.",
          );
        }
        throw error;
      });
  }

  async read(reportId: string, documentId: string, user: JwtUser) {
    await this.reports.findDaily(reportId, user);
    const document = await this.prisma.reportDocument.findFirst({
      where: { id: documentId, reportId },
    });
    if (!document) throw new NotFoundException("Document not found");
    const data = Buffer.from(document.data);
    if (createHash("sha256").update(data).digest("hex") !== document.sha256)
      throw new InternalServerErrorException(
        "The document could not be verified. Please contact support.",
      );
    return { ...document, data };
  }
}
