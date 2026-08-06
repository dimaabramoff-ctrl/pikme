import { Module } from '@nestjs/common';
import { PartnerAccessRequestsController } from './partner-access-requests.controller';
import { AdminPartnerAccessRequestsController } from './admin-partner-access-requests.controller';
import { PartnerAccessRequestsService } from './partner-access-requests.service';
import { VouchersModule } from '../vouchers/vouchers.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [VouchersModule, UsersModule],
  controllers: [PartnerAccessRequestsController, AdminPartnerAccessRequestsController],
  providers: [PartnerAccessRequestsService],
  exports: [PartnerAccessRequestsService],
})
export class PartnerAccessRequestsModule {}
