import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type { AuditRepository } from "./repository.js";
import type { AuditEventRecord, CreateAuditEventInput } from "./types.js";

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateAuditEventInput): Promise<AuditEventRecord> {
    const event = await this.client.auditEvent.create({
      data: {
        storeId: input.storeId,
        actorUserId: input.actorUserId,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return {
      id: event.id,
      storeId: event.storeId,
      actorUserId: event.actorUserId,
      action: event.action,
      subjectType: event.subjectType,
      ...(event.subjectId ? { subjectId: event.subjectId } : {}),
      ...(event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? { metadata: event.metadata as Record<string, unknown> }
        : {}),
      createdAt: event.createdAt,
    };
  }
}
