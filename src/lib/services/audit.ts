import { AuditAction, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type AuditInput = {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: input,
  });
}
