import { Module } from '@nestjs/common';
import { SalonStaffDraftsController } from './salon-staff-drafts.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalonStaffDraftsController],
})
export class SalonStaffDraftsModule {}
