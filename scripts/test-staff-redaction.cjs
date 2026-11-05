require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Reflector } = require('@nestjs/core');
const { UsersService } = require('../src/modules/users/users.service.ts');
const { EmployeesService } = require('../src/modules/employees/employees.service.ts');
const { AdminService } = require('../src/modules/admin/admin.service.ts');
const { AdminController } = require('../src/modules/admin/admin.controller.ts');
const { RolesGuard } = require('../src/common/roles.guard.ts');

const raw = { id:'fixture-user',fullName:'Fixture User',email:'fixture@example.invalid',role:{id:'role',name:'EMPLOYEE',internal:'not-public'},department:{id:'dept',name:'Fixture',internal:'not-public'},title:'Fixture',status:'ACTIVE',createdAt:new Date(0),passwordHash:'fixture-private-hash',salary:999,dateOfBirth:new Date(0),address:'fixture-private-address',phone:'fixture-private-phone',personalEmail:'private@example.invalid',emergencyContact:'fixture-private-contact',responsibilities:JSON.stringify({password:'fixture-private-password',terminalId:'TRM-FIXTURE'}),goalsText:'fixture-private-goal',activityLogs:[] };
const assertDirectory = value => assert.doesNotMatch(JSON.stringify(value),/password|salary|dateOfBirth|address|phone|personalEmail|emergencyContact|responsibilities|goals|fixture-private|not-public/i);

test('user directory selects public fields and redacts unexpected database fields', async () => {
  let query;const service=new UsersService({user:{findMany:async args=>{query=args;return [raw];}}});
  const result=await service.listAll();assertDirectory(result);assert.equal(query.include,undefined);assert.equal(query.select.passwordHash,undefined);assert.equal(query.select.salary,undefined);assert.equal(result[0].role.name,'EMPLOYEE');
});

for(const role of ['EMPLOYEE','OUTREACH_MANAGER'])test(role+' employee directory cannot retrieve HR or credential fields',async()=>{
  let query;const service=new EmployeesService({user:{findMany:async args=>{query=args;return [raw]},count:async()=>1}},{});
  const result=await service.list({},{sub:'fixture-viewer',role});assertDirectory(result.items);assert.equal(query.select.salary,undefined);assert.equal(query.include,undefined);assert.equal(result.items[0].role,'EMPLOYEE');
});

test('HR listing remains available to manager with credential metadata suppressed',async()=>{
  let query;const service=new EmployeesService({user:{findMany:async args=>{query=args;return [raw]},count:async()=>1}},{});
  const result=await service.list({},{sub:'fixture-manager',role:'MANAGER'});assert.equal(query.select.salary,true);assert.equal(query.select.passwordHash,undefined);assert.equal(result.items[0].salary,999);assert.equal(result.items[0].responsibilities,null);assert.doesNotMatch(JSON.stringify(result),/fixture-private-hash|fixture-private-password/);
});

test('admin overview denies ordinary staff before querying HR data',async()=>{
  const service=new AdminService({user:{count:()=>{throw Error('must not read fixture')}}});
  await assert.rejects(()=>service.getOverview({sub:'fixture',role:'EMPLOYEE'}),/permission required/);
  const guard=new RolesGuard(new Reflector());
  assert.equal(guard.canActivate({getHandler:()=>AdminController.prototype.getOverview,getClass:()=>AdminController,switchToHttp:()=>({getRequest:()=>({user:{role:'EMPLOYEE'}})})}),false);
});

test('manager admin overview returns a safe recent-staff DTO',async()=>{
  let query;const service=new AdminService({user:{count:async()=>1,findMany:async args=>{query=args;return [raw]}},leaveRequest:{findMany:async()=>[]},kycSubmission:{count:async()=>0}});
  const result=await service.getOverview({sub:'fixture',role:'MANAGER'});assertDirectory(result.recentStaff);assert.equal(query.select.passwordHash,undefined);
});

test('personal export cannot return legacy collector passwords or raw account records',async()=>{
  const result=await new UsersService({user:{findUnique:async()=>raw}}).exportData({sub:raw.id});assert.equal(result.data.responsibilities,null);assert.doesNotMatch(JSON.stringify(result),/passwordHash|fixture-private-hash|fixture-private-password/);
});
