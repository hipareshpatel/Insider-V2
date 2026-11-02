// D1 helper for CI (no secrets in output). Usage:
//   node tools/d1.mjs ensure            create missing databases (6 domains x production/staging)
//   node tools/d1.mjs config <dir> <env>  write <dir>/wrangler.migrate.json for migrations of all domains
// Database names: disclo-<domain>[-staging] (D43: staging has its own copies).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const DOMAINS = ["market", "filings", "announce", "memory", "graph", "app"];
export const ENVS = ["production", "staging"];
export const dbName = (domain, env) => `disclo-${domain}${env === "staging" ? "-staging" : ""}`;

function wrangler(args) {
  return execFileSync("npx", ["--yes", "wrangler@4.156.1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
export function listDbs() {
  const out = wrangler(["d1", "list", "--json"]);
  const json = JSON.parse(out.slice(out.indexOf("[")));
  return new Map(json.map((d) => [d.name, d.uuid]));
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "ensure") {
  const have = listDbs();
  for (const env of ENVS) for (const d of DOMAINS) {
    const name = dbName(d, env);
    if (have.has(name)) { console.log(`exists  ${name}`); continue; }
    wrangler(["d1", "create", name, "--location", "apac"]);
    console.log(`created ${name}`);
  }
} else if (cmd === "ids") {
  const have = listDbs();
  for (const env of ENVS) for (const d of DOMAINS) console.log(`${dbName(d, env)} ${have.get(dbName(d, env)) ? "ok" : "MISSING"}`);
} else if (cmd === "config") {
  const have = listDbs();
  const env = b ?? "production";
  const cfg = {
    name: "disclo-migrate",
    compatibility_date: "2026-10-01",
    d1_databases: DOMAINS.map((d) => {
      const id = have.get(dbName(d, env));
      if (!id) throw new Error(`missing database ${dbName(d, env)}`);
      return { binding: `DB_${d.toUpperCase()}`, database_name: dbName(d, env), database_id: id, migrations_dir: `db/migrations/${d}` };
    }),
  };
  writeFileSync(join(a, "wrangler.migrate.json"), JSON.stringify(cfg, null, 2));
  console.log(`wrote config for ${env}`);
} else {
  console.error("usage: d1.mjs ensure|ids|config <dir> <env>");
  process.exit(2);
}
