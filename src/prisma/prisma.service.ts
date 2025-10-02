import {
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('[Prisma] Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('[Prisma] Database disconnected');
  }

  // Helper para limpar o banco em desenvolvimento
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key !== 'constructor',
    );

    return Promise.all(
      models
        .map((modelKey) => {
          const model = this[modelKey as keyof this];
          if (model && typeof model === 'object' && 'deleteMany' in model) {
            return (
              model as { deleteMany: () => Promise<unknown> }
            ).deleteMany();
          }
          return null;
        })
        .filter((result): result is Promise<unknown> => result !== null), // garante tipos seguros
    );
  }
}
