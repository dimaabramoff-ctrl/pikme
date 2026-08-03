import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogProvidersModule } from '../catalog-providers/catalog-providers.module';

@Module({
  imports: [PrismaModule, CatalogProvidersModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
