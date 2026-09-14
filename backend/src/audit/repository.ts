import type { AuditEventRecord, CreateAuditEventInput } from "./types.js";

export interface AuditRepository {
  create(input: CreateAuditEventInput): Promise<AuditEventRecord>;
}
