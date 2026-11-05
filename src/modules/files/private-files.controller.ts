import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { CashAccessGuard } from '../cash-collections/cash-access.guard';
import { CashPrincipal, RequireCashPermission } from '../cash-collections/cash-access';
import { SecureFilesService } from './secure-files.service';

@Controller('files/private')
@UseGuards(JwtAuthGuard)
export class PrivateFilesController {
  constructor(private readonly files: SecureFilesService) {}
  @Get(':id') async read(@Param('id') id: string, @CurrentUser() user: JwtUser, @Res() response: Response) { this.files.respond(response, await this.files.read(id, user)); }
}
