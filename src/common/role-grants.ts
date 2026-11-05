import { ForbiddenException } from '@nestjs/common';
import { JwtUser } from './current-user.decorator';

export function assertRoleGrant(actor: JwtUser | undefined, requestedRole: string, target?: { id: string; role: { name: string } }) {
  if (!actor || !['CEO', 'MANAGER'].includes(actor.role)) throw new ForbiddenException('Employee administration permission required');
  if (!['CEO', 'MANAGER', 'EMPLOYEE', 'OUTREACH_MANAGER'].includes(requestedRole)) throw new ForbiddenException('Unsupported role');
  if (target?.id === actor.sub && requestedRole !== target.role.name) throw new ForbiddenException('You cannot change your own privileges');
  if (actor.role === 'MANAGER' && (requestedRole !== 'EMPLOYEE' || (target && target.role.name !== 'EMPLOYEE'))) throw new ForbiddenException('Only the CEO may administer privileged roles');
}
