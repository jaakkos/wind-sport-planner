const BUILD_DATABASE_URL =
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.DATABASE_URL ?? BUILD_DATABASE_URL;
}
