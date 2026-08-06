import { Module } from '@nestjs/common';
import { SalonEditorController } from './salon-editor.controller';
import { SalonEditorService } from './salon-editor.service';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';

@Module({
  controllers: [SalonsController, SalonEditorController],
  providers: [SalonsService, SalonEditorService],
  exports: [SalonsService],
})
export class SalonsModule {}
