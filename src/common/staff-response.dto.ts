import { Prisma } from '@prisma/client';

export const STAFF_DIRECTORY_SELECT = {
  id: true, fullName: true, email: true, title: true, avatarUrl: true, status: true, createdAt: true,
  role: { select: { id: true, name: true } }, department: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

export const STAFF_HR_SELECT = {
  ...STAFF_DIRECTORY_SELECT, phone: true, dateOfBirth: true, address: true, personalEmail: true,
  employmentType: true, salary: true, emergencyContact: true, hireDate: true,
  responsibilities: true, goalsText: true, ledDepartments: { select: { name: true } },
} satisfies Prisma.UserSelect;

export class StaffDirectoryResponseDto {
  id: string; fullName: string; email: string; title: string | null; avatarUrl: string | null;
  status: string; createdAt: Date; role: { id: string; name: string } | null; department: { id: string; name: string } | null;
  constructor(user: any) {
    this.id = user.id; this.fullName = user.fullName; this.email = user.email; this.title = user.title ?? null;
    this.avatarUrl = user.avatarUrl ?? null; this.status = user.status; this.createdAt = user.createdAt;
    this.role = user.role ? { id: user.role.id, name: user.role.name } : null;
    this.department = user.department ? { id: user.department.id, name: user.department.name } : null;
  }
}

export class EmployeeDirectoryResponseDto {
  id: string; fullName: string; email: string; title: string | null; avatarUrl: string | null;
  status: string; createdAt: Date; role: string | null; department: string | null;
  constructor(user: any) {
    const safe = new StaffDirectoryResponseDto(user);
    this.id = safe.id; this.fullName = safe.fullName; this.email = safe.email; this.title = safe.title;
    this.avatarUrl = safe.avatarUrl; this.status = safe.status; this.createdAt = safe.createdAt;
    this.role = safe.role?.name ?? null; this.department = safe.department?.name ?? null;
  }
}

// Cash legacy JSON can contain credentials. It is not an OS job-description field.
export function safeResponsibilities(value: string | null | undefined) {
  if (!value || /^[\s]*[\[{]/.test(value)) return null;
  return value;
}
