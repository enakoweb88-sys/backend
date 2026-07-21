import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FilesModule } from './modules/files/files.module';
import { GoalsModule } from './modules/goals/goals.module';
import { KycModule } from './modules/kyc/kyc.module';
import { MealsModule } from './modules/meals/meals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RolesModule } from './modules/roles/roles.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';
import { FinanceModule } from './modules/finance/finance.module';
import { BdModule } from './modules/bd/bd.module';
import { DigitalModule } from './modules/digital/digital.module';
import { AdminModule } from './modules/admin/admin.module';
import { SupportModule } from './modules/support/support.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PublicModule } from './modules/public/public.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { InvestmentsModule } from './modules/investments/investments.module';

import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    CacheModule.register({ isGlobal: true, ttl: 60000 }),
    // Core
    PrismaModule,
    AuthModule,
    // User & Access Management
    UsersModule,
    RolesModule,
    EmployeesModule,
    // Financial Operations
    TransactionsModule,
    ExpensesModule,
    // Compliance
    KycModule,
    // Operations
    MealsModule,
    TasksModule,
    GoalsModule,
    PerformanceModule,
    // Communications
    AnnouncementsModule,
    NotificationsModule,
    CommunicationsModule,
    // Analytics & Reporting
    AnalyticsModule,
    DashboardModule,
    // Infrastructure
    AuditLogsModule,
    FilesModule,
    FinanceModule,
    BdModule,
    DigitalModule,
    AdminModule,
    SupportModule,
    SubscriptionsModule,
    ReportsModule,
    PublicModule,
    OutreachModule,
    InvestmentsModule,
  ],
})
export class AppModule {}
