import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { GoalsModule } from './modules/goals/goals.module';
import { KycModule } from './modules/kyc/kyc.module';
import { MealsModule } from './modules/meals/meals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    AnalyticsModule,
    EmployeesModule,
    ExpensesModule,
    MealsModule,
    TasksModule,
    TransactionsModule,
    KycModule,
    AnnouncementsModule,
    NotificationsModule,
    CommunicationsModule,
    GoalsModule,
  ],
})
export class AppModule {}
