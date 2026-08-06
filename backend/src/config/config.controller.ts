import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

export interface PublicConfig {
  adminContactEmail: string | null;
  adminWhatsappNumber: string | null;
  presentationMode: boolean;
}

@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Return safe public configuration (admin contact, presentation mode)' })
  @ApiOkResponse({ description: 'Public platform config' })
  getPublicConfig(): PublicConfig {
    const email = this.configService.get<string>('ADMIN_CONTACT_EMAIL') ?? null;
    const whatsapp = this.configService.get<string>('ADMIN_WHATSAPP_NUMBER') ?? null;
    const presentation = this.configService.get<string>('PRESENTATION_MODE') === 'true';

    if (!email && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[PickMe] ADMIN_CONTACT_EMAIL is not configured — admin contact will be hidden from users.');
    }

    return {
      adminContactEmail: email,
      adminWhatsappNumber: whatsapp,
      presentationMode: presentation,
    };
  }
}
