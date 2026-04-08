import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/database-url";

// Render (and other hosts) often omit DATABASE_URL during `npm run build` even
// though `prisma generate` never connects.  Migrations and the running app
// always use the real URL from the environment when it is set.
const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
