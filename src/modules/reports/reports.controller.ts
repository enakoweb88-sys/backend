import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Query,
  UploadedFiles,
  UseInterceptors,
  Res,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Response } from "express";
import {
  ReportDocumentsService,
  REPORT_FILE_COUNT,
  REPORT_FILE_LIMIT,
  previewMimeType,
  attachmentDisposition,
} from "./report-documents.service";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly documents: ReportDocumentsService,
  ) {}

  @Get()
  @Roles("CEO", "MANAGER", "OUTREACH_MANAGER")
  list() {
    return this.reportsService.list();
  }

  @Post()
  @Roles("CEO", "MANAGER", "OUTREACH_MANAGER")
  generate(
    @Body() body: { title: string; type: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.reportsService.generate(body.title, body.type, user);
  }

  @Get("daily")
  listDaily(@CurrentUser() user: JwtUser, @Query("type") type?: string) {
    return this.reportsService.listDaily(user, type);
  }

  @Post("daily")
  createDaily(
    @Body()
    body: {
      content: string;
      type?: string;
      loginTime?: string;
      logoutTime?: string;
      pdfUrl?: string;
      status?: string;
      attachments?: any;
    },
    @CurrentUser() user: JwtUser,
  ) {
    return this.reportsService.createDaily(body, user);
  }

  @Get("daily/:id")
  findDaily(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.reportsService.findDaily(id, user);
  }

  @Post("daily/upload")
  @UseInterceptors(
    FilesInterceptor("documents", REPORT_FILE_COUNT, {
      storage: memoryStorage(),
      limits: {
        fileSize: REPORT_FILE_LIMIT,
        files: REPORT_FILE_COUNT,
        fields: 6,
      },
    }),
  )
  uploadReport(
    @Body()
    body: {
      title?: string;
      note?: string;
      type?: string;
      status?: string;
      retainedDocumentIds?: string;
    },
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtUser,
  ) {
    return this.documents.save(body, files || [], user);
  }

  @Post("daily/:id/ceo-review")
  @Roles("CEO")
  ceoReview(
    @Param("id") id: string,
    @Body() body: { comment?: string; complete?: boolean },
    @CurrentUser() user: JwtUser,
  ) {
    return this.reportsService.ceoReview(id, body, user);
  }

  @Post("daily/:id/upload")
  @UseInterceptors(
    FilesInterceptor("documents", REPORT_FILE_COUNT, {
      storage: memoryStorage(),
      limits: {
        fileSize: REPORT_FILE_LIMIT,
        files: REPORT_FILE_COUNT,
        fields: 6,
      },
    }),
  )
  reviseUpload(
    @Param("id") id: string,
    @Body()
    body: {
      title?: string;
      note?: string;
      type?: string;
      status?: string;
      retainedDocumentIds?: string;
    },
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtUser,
  ) {
    return this.documents.save(body, files || [], user, id);
  }

  @Get("daily/:id/documents/:documentId")
  async file(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Query("preview") preview: string | undefined,
    @CurrentUser() user: JwtUser,
    @Res() response: Response,
  ) {
    const document = await this.documents.read(id, documentId, user);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Type",
      preview === "1"
        ? previewMimeType(document.originalName, document.data)
        : "application/octet-stream",
    );
    response.setHeader(
      "Content-Disposition",
      attachmentDisposition(document.originalName),
    );
    response.setHeader("Content-Length", document.data.length);
    response.send(document.data);
  }

  @Post("daily/:id")
  updateDaily(
    @Body()
    body: {
      content?: string;
      type?: string;
      status?: string;
      attachments?: any;
    },
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
  ) {
    return this.reportsService.updateDaily(id, body, user);
  }

  @Post("daily/:id/review")
  @Roles("CEO", "MANAGER", "OUTREACH_MANAGER")
  reviewDaily(
    @Param("id") id: string,
    @Body() body: { status: string; reviewerComments?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.reportsService.reviewDaily(id, body, user);
  }
}
