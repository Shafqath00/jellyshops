import type { AuditRepository } from "./repository.js";
import type { AuditEventRecord, CreateAuditEventInput } from "./types.js";

const sensitiveKey = /(token|secret|password|authorization)/i;

function assertSafeMetadata(value: unknown, path = "metadata"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafeMetadata(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;

  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKey.test(key)) {
      throw new Error(`Audit metadata contains a sensitive key at ${path}.${key}`);
    }
    assertSafeMetadata(nested, `${path}.${key}`);
  }
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async record(input: CreateAuditEventInput): Promise<AuditEventRecord> {
    if (input.metadata) assertSafeMetadata(input.metadata);
    return this.repository.create(input);
  }
}
