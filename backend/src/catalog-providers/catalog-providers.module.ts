import { Module } from '@nestjs/common';
import { ExternalPlacesProvider } from './external-places.provider';

@Module({
  providers: [ExternalPlacesProvider],
  exports: [ExternalPlacesProvider],
})
export class CatalogProvidersModule {}
