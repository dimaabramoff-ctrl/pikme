import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e') {
      return;
    }

    await this.$connect();
  }
}
