import { z } from "zod";

export const compilationDiagnosticSeveritySchema = z.enum(["error", "warning"]);

export const compilationDiagnosticLocationSchema = z.object({
  entityType: z.enum([
    "workspace",
    "theme",
    "template",
    "global_section",
    "menu",
    "assignment",
    "extension",
  ]),
  entityId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  blockId: z.string().min(1).optional(),
  fieldKey: z.string().min(1).optional(),
}).strict();

export const compilationDiagnosticSchema = z.object({
  severity: compilationDiagnosticSeveritySchema,
  code: z.string().trim().min(1).regex(/^[A-Z0-9_]+$/),
  message: z.string().trim().min(1),
  location: compilationDiagnosticLocationSchema.optional(),
}).strict();

export type CompilationDiagnosticSeverity = z.infer<typeof compilationDiagnosticSeveritySchema>;
export type CompilationDiagnosticLocation = z.infer<typeof compilationDiagnosticLocationSchema>;
export type CompilationDiagnostic = z.infer<typeof compilationDiagnosticSchema>;
