import { Module } from '@nestjs/common';
import { BusinessAccessCodesService } from './business-access-codes.service';
import { BusinessAccessCodesController } from './business-access-codes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogProvidersModule } from '../catalog-providers/catalog-providers.module';

@Module({
  imports: [PrismaModule, AuthModule, CatalogProvidersModule],
  controllers: [BusinessAccessCodesController],
  providers: [BusinessAccessCodesService],
  exports: [BusinessAccessCodesService],
})
export class BusinessAccessCodesModule {}
