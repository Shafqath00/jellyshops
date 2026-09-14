export type AuditMetadata = Record<string, unknown>;

export interface CreateAuditEventInput {
  storeId: string;
  actorUserId: number;
  action: string;
  subjectType: string;
  subjectId?: string;
  metadata?: AuditMetadata;
}

export interface AuditEventRecord extends CreateAuditEventInput {
  id: string;
  createdAt: Date;
}
