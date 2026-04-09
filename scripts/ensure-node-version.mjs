#!/usr/bin/env node
/**
 * Prisma 7+ requires a current Node.js (see package.json engines and prisma.io system requirements).
 * Wrong versions used to fail obscurely during `prisma generate` (ERR_REQUIRE_ESM / zeptomatch).
 */
const required = [22, 12, 0];
const cur = process.version
  .replace(/^v/, "")
  .split(".")
  .map((s) => Number.parseInt(s, 10));
const [a, b, c] = [cur[0] ?? 0, cur[1] ?? 0, cur[2] ?? 0];
const [ra, rb, rc] = required;
const ok =
  a > ra ||
  (a === ra && b > rb) ||
  (a === ra && b === rb && c >= rc);

if (!ok) {
  console.error(
    `[fjelllift] Node.js >= ${ra}.${rb}.${rc} is required (Prisma 7 / project engines). Current: ${process.version}`,
  );
  console.error("Use the version in .nvmrc (e.g. nvm use, fnm use, mise use).");
  process.exit(1);
}
