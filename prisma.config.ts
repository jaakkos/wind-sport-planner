import "dotenv/config";
import { defineConfig } from "prisma/config";

// Render (and other hosts) often omit DATABASE_URL during `npm run build` even
// though `prisma generate` never connects.  Migrations and the running app
// always use the real URL from the environment when it is set.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
