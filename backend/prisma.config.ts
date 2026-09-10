import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    // Migration/admin connection only. Runtime code reads DATABASE_URL.
    url: env("DIRECT_URL"),
  },
});
