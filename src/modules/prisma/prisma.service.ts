import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { secureDatabaseUrl } from '../../common/database-connection';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const url = secureDatabaseUrl(process.env.DATABASE_URL);
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
    const roles = await this.$queryRaw<Array<{ name: string; unsafe: boolean }>>`
      SELECT current_user AS name, (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole
        OR has_schema_privilege(current_user, 'public', 'CREATE')
        OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND pg_has_role(current_user, c.relowner, 'MEMBER'))) AS unsafe
      FROM pg_roles WHERE rolname = current_user`;
    if (roles[0]?.name !== 'enako_runtime' || roles[0].unsafe) throw new Error('Backend requires the separately provisioned, non-owner enako_runtime database role');
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
