import { UserRole } from "@prisma/client";

export function isAdmin(role: UserRole) {
  return role === UserRole.ADMIN;
}

export function canManageUsers(role: UserRole) {
  return isAdmin(role);
}

export function canApplyDiscount(role: UserRole) {
  return isAdmin(role);
}

export function canCancelTicket(role: UserRole) {
  return isAdmin(role);
}
