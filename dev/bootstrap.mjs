// Fills in a dev Convex deployment: the environment variables the app needs,
// the admin account, and the seed locations. dev/setup.sh runs it inside the
// `convex` container (which carries CONVEX_SELF_HOSTED_URL/ADMIN_KEY):
//
//   docker compose exec -T -e DEV_ADMIN_EMAIL=... -e DEV_ADMIN_PASSWORD=... \
//     -e SITE_URL=... convex node dev/bootstrap.mjs
//
// Idempotent: generated secrets (JWT keys, VAPID keys) are only created when
// missing, so re-running never signs anyone out or breaks push subscriptions.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import webpush from "web-push";

const { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, SITE_URL } = process.env;
if (!DEV_ADMIN_EMAIL || !DEV_ADMIN_PASSWORD || !SITE_URL) {
  console.error("Set DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD and SITE_URL.");
  process.exit(1);
}

// stdout is captured; the CLI's stderr (progress, function logs) passes through.
const convex = (...args) =>
  execFileSync("npx", ["convex", ...args], { encoding: "utf8" });

const existing = new Map(
  execFileSync("npx", ["convex", "env", "list"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"], // "No environment variables set"
  })
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

// Values go through --from-file so PEM keys (which start with "-----") and
// JSON never meet the argument parser.
const scratch = mkdtempSync(join(tmpdir(), "convex-env-"));
function setEnv(name, value) {
  if (existing.get(name) === value) return;
  const file = join(scratch, name);
  writeFileSync(file, value);
  convex("env", "set", name, "--from-file", file);
}

try {
  // Convex Auth signing keys (same shape as `npx @convex-dev/auth` writes).
  if (!existing.has("JWT_PRIVATE_KEY") || !existing.has("JWKS")) {
    const { publicKey, privateKey } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const pkcs8 = await exportPKCS8(privateKey);
    setEnv("JWT_PRIVATE_KEY", pkcs8.trimEnd().replace(/\n/g, " "));
    setEnv(
      "JWKS",
      JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(publicKey)) }] }),
    );
  }
  setEnv("SITE_URL", SITE_URL);

  // Web push. Admins re-subscribe if these ever change, so keep them.
  if (!existing.has("VAPID_PUBLIC_KEY") || !existing.has("VAPID_PRIVATE_KEY")) {
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();
    setEnv("VAPID_PUBLIC_KEY", publicKey);
    setEnv("VAPID_PRIVATE_KEY", privateKey);
  }
  setEnv("VAPID_SUBJECT", `mailto:${DEV_ADMIN_EMAIL}`);

  // Read by seedAdmin:run.
  setEnv("ADMIN_EMAIL", DEV_ADMIN_EMAIL);
  setEnv("ADMIN_PASSWORD", DEV_ADMIN_PASSWORD);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

convex("run", "seedAdmin:run");
console.log(`admin account: ${DEV_ADMIN_EMAIL}`);

const seed = JSON.parse(readFileSync("docs/seed-data/pickup-games.json", "utf8"));
const locations = seed.locations.map((location) =>
  Object.fromEntries(Object.entries(location).filter(([key]) => !key.startsWith("_"))),
);
const inserted = convex(
  "run",
  "seedLocations:run",
  JSON.stringify({ ownerEmail: DEV_ADMIN_EMAIL, locations }),
).trim();
console.log(
  inserted === "0"
    ? "seed locations: skipped (deployment already has locations)"
    : `seed locations: imported ${inserted}`,
);
