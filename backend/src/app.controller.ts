import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';
import { AppService } from './app.service';

@ApiTags('system')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'pickme-backend',
      },
    },
  })
  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
