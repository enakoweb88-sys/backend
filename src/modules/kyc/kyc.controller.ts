import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { KycReviewDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('submissions')
  submit(@Body() body: any) {
    return this.kyc.submit(body);
  }

  @Get('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.CEO, RoleName.MANAGER)
  list(@Query() query: QueryDto & any) {
    return this.kyc.list(query);
  }

  @Patch('submissions/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.CEO, RoleName.MANAGER)
  review(@Param('id') id: string, @Body() dto: KycReviewDto, @CurrentUser() user: JwtUser) {
    return this.kyc.review(id, dto, user);
  }
}
