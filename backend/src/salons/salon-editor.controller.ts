import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { SalonEditorService } from './salon-editor.service';
import type {
  SalonEditorDraftPayload,
  SalonEditorDraftSaveResponse,
  SalonEditorPublishResponse,
  SalonEditorStateResponse,
} from './salon-editor.service';

@ApiTags('salon-editor')
@ApiBearerAuth()
@Controller('salons/:salonId/editor')
export class SalonEditorController {
  constructor(private readonly salonEditorService: SalonEditorService) {}

  @Get()
  @Roles(Role.SALON_OWNER, Role.SALON_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get owner editor draft and published state for a salon' })
  getEditorState(
    @Param('salonId') salonId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<SalonEditorStateResponse> {
    return this.salonEditorService.getEditorState(salonId, req.user);
  }

  @Put('draft')
  @Roles(Role.SALON_OWNER, Role.SALON_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Save owner editor draft for a salon' })
  saveDraft(
    @Param('salonId') salonId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: SalonEditorDraftPayload,
  ): Promise<SalonEditorDraftSaveResponse> {
    return this.salonEditorService.saveDraft(salonId, req.user, body);
  }

  @Post('publish')
  @Roles(Role.SALON_OWNER, Role.SALON_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publish owner editor draft to the public salon profile' })
  publish(
    @Param('salonId') salonId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<SalonEditorPublishResponse> {
    return this.salonEditorService.publishDraft(salonId, req.user);
  }
}