import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { DepartmentsController } from './departments.controller';

@Module({
  controllers: [EmployeesController, DepartmentsController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
