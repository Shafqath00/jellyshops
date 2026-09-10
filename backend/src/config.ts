import path from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  AUTH_PROVIDER: z.enum(["development", "firebase"]).default("development"),
  REPOSITORY_PROVIDER: z.enum(["local-json", "prisma"]).default("local-json"),
  MEDIA_PROVIDER: z.enum(["local-files", "gcs"]).default("local-files"),
  DATA_DIRECTORY: z.string().default(path.resolve(".data")),
  UPLOAD_DIRECTORY: z.string().default(path.resolve("uploads")),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  DEMO_STORE_ID: z.string().min(1).default("store-demo"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  GCS_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
});

export interface AppConfig {
  port: number;
  nodeEnv: "development" | "test" | "production";
  corsOrigins: string[];
  authProvider: "development" | "firebase";
  repositoryProvider: "local-json" | "prisma";
  mediaProvider: "local-files" | "gcs";
  dataDirectory: string;
  uploadDirectory: string;
  maxUploadBytes: number;
  demoStoreId: string;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);

  if (parsed.NODE_ENV === "production" && parsed.AUTH_PROVIDER === "development") {
    throw new Error("AUTH_PROVIDER=development is not allowed in production");
  }
  if (parsed.AUTH_PROVIDER === "firebase" && !parsed.FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID is required when AUTH_PROVIDER=firebase");
  }
  if (parsed.REPOSITORY_PROVIDER === "prisma" && !parsed.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when REPOSITORY_PROVIDER=prisma");
  }
  if (parsed.MEDIA_PROVIDER === "gcs" && (!parsed.GCS_BUCKET || !parsed.GCS_PROJECT_ID)) {
    throw new Error("GCS_BUCKET and GCS_PROJECT_ID are required when MEDIA_PROVIDER=gcs");
  }

  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    authProvider: parsed.AUTH_PROVIDER,
    repositoryProvider: parsed.REPOSITORY_PROVIDER,
    mediaProvider: parsed.MEDIA_PROVIDER,
    dataDirectory: path.resolve(parsed.DATA_DIRECTORY),
    uploadDirectory: path.resolve(parsed.UPLOAD_DIRECTORY),
    maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
    demoStoreId: parsed.DEMO_STORE_ID,
  };
}
