require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Reflector } = require('@nestjs/core');
const { assertRoleGrant } = require('../src/common/role-grants.ts');
const { PermissionPolicy, PermissionsGuard } = require('../src/common/permissions.ts');
const { OutreachController } = require('../src/modules/outreach/outreach.controller.ts');
const { OutreachService } = require('../src/modules/outreach/outreach.service.ts');
const { PublicService } = require('../src/modules/public/public.service.ts');
const { MealsService } = require('../src/modules/meals/meals.service.ts');
const { SupportService } = require('../src/modules/support/support.service.ts');
const { ExpensesService } = require('../src/modules/expenses/expenses.service.ts');
const { KycService } = require('../src/modules/kyc/kyc.service.ts');

test('managers cannot create CEO/manager/outreach-manager identities or modify privileged accounts', () => {
  for (const role of ['CEO', 'MANAGER', 'OUTREACH_MANAGER']) assert.throws(() => assertRoleGrant({sub:'manager',role:'MANAGER'},role));
  assert.throws(() => assertRoleGrant({sub:'manager',role:'MANAGER'},'EMPLOYEE',{id:'ceo',role:{name:'CEO'}}));
  assert.throws(() => assertRoleGrant({sub:'ceo',role:'CEO'},'EMPLOYEE',{id:'ceo',role:{name:'CEO'}}));
  assert.doesNotThrow(() => assertRoleGrant({sub:'manager',role:'MANAGER'},'EMPLOYEE'));
  assert.doesNotThrow(() => assertRoleGrant({sub:'ceo',role:'CEO'},'MANAGER'));
});
test('private OS permissions require verified role or explicit server grant, never job title', () => {
  const policy=new PermissionPolicy({get:()=>JSON.stringify({'accountant':['finance.read']})});
  assert.throws(()=>policy.require({sub:'employee',role:'EMPLOYEE',title:'CEO'},'finance.read'));
  assert.doesNotThrow(()=>policy.require({sub:'accountant',role:'EMPLOYEE'},'finance.read'));
  assert.throws(()=>policy.require({sub:'accountant',role:'EMPLOYEE'},'finance.write'));
  assert.throws(()=>policy.require({sub:'outreach',role:'OUTREACH_MANAGER'},'hr.manage'));
});
test('all administrative Outreach handlers declare authentication and permission checks',()=>{
  const names=['getDonations','getStats','getApplications','sendNewsletter','createEvent','updateEventStatus','createPost','updatePost','updatePostStatus','getWebInsights','createCommunityProject','updateCommunityProject','deleteCommunityProject','createPublicImpactStat','updatePublicImpactStat','deletePublicImpactStat','adminSearch','adminEvents','adminPosts'];
  const guard=new PermissionsGuard(new Reflector(),new PermissionPolicy({get:()=>undefined}));
  for(const name of names){const handler=OutreachController.prototype[name];const guards=Reflect.getMetadata('__guards__',handler)||[];assert.ok(guards.some(g=>g.name==='JwtAuthGuard'),name);assert.ok(guards.some(g=>g.name==='PermissionsGuard'),name);assert.throws(()=>guard.canActivate({getHandler:()=>handler,getClass:()=>OutreachController,switchToHttp:()=>({getRequest:()=>({user:{sub:'employee',role:'EMPLOYEE'}})})}));}
});
test('public impact never queries internal report exports',async()=>{
  const p={publicImpactStat:{findMany:async()=>[]},publicMilestone:{findMany:async()=>[]},publicImpactChart:{findMany:async()=>[]},reportFile:{findMany:()=>{throw Error('private export accessed')}}};
  assert.deepEqual((await new PublicService(p).getImpactData()).reports,[]);
});
test('public Outreach post queries cannot select drafts',async()=>{
  let query;const service=new OutreachService({blogPost:{findMany:async q=>{query=q;return []}}},{},{});
  await service.getPosts('DRAFT');assert.equal(query.where.status,'PUBLISHED');await service.getPosts('DRAFT',true);assert.equal(query.where.status,'DRAFT');
});
test('meal disputes bind ordinary users to the actual employee FK',async()=>{
  let where;const p={mealRecord:{updateMany:async q=>{where=q.where;return{count:q.where.employeeId==='employee'?1:0}},findFirst:async()=>({id:'fixture'})}};
  await new MealsService(p).dispute('fixture','Fixture dispute reason',{sub:'employee',role:'EMPLOYEE'});assert.equal(where.employeeId,'employee');
  await assert.rejects(()=>new MealsService(p).dispute('fixture','Fixture dispute reason',{sub:'other',role:'EMPLOYEE'}),/not found/);
});
test('support replies cannot mutate another employee ticket',async()=>{
  let writes=0;const p={supportTicket:{findFirst:async()=>null},supportTicketReply:{create:async()=>writes++}};
  await assert.rejects(()=>new SupportService(p).addReply('other-ticket','Fixture reply',{sub:'employee',role:'EMPLOYEE',email:'fixture@example.invalid'}),/not found/);assert.equal(writes,0);
});
test('expense self-approval and repeated review are rejected',async()=>{
  const p={expense:{findUnique:async()=>({id:'fixture',submittedById:'employee'}),updateMany:async()=>({count:0})}};p.$transaction=cb=>cb(p);
  await assert.rejects(()=>new ExpensesService(p).review('fixture','APPROVED','employee'),/own expense/);
  await assert.rejects(()=>new ExpensesService(p).review('fixture','APPROVED','manager'),/already been reviewed/);
});
test('manager cannot perform final KYC approval and repeated approval sends no duplicate mail',async()=>{
  let sends=0;const service=new KycService({kycSubmission:{findUnique:async()=>({status:'APPROVED',documents:[]})}},{sendKycApproved:async()=>sends++});
  await assert.rejects(()=>service.review('fixture',{status:'APPROVED'},{sub:'manager',role:'MANAGER',email:'fixture@example.invalid'}),/requires the CEO/);
  await service.review('fixture',{status:'APPROVED'},{sub:'ceo',role:'CEO',email:'fixture@example.invalid'});assert.equal(sends,0);
});
