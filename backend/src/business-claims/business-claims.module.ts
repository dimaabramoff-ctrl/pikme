import { Module } from '@nestjs/common';
import { BusinessClaimsService } from './business-claims.service';
import { BusinessClaimsController } from './business-claims.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessClaimsController],
  providers: [BusinessClaimsService],
  exports: [BusinessClaimsService],
})
export class BusinessClaimsModule {}
