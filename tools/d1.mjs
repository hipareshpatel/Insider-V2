// D1 helper for CI (no secrets in output). Usage:
//   node tools/d1.mjs ensure            create missing databases (6 domains x production/staging)
//   node tools/d1.mjs config <dir> <env>  write <dir>/wrangler.migrate.json for migrations of all domains
// Database names: disclo-<domain>[-staging] (D43: staging has its own copies).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DOMAINS = ["market", "filings", "announce", "memory", "graph", "app"];
export const ENVS = ["production", "staging"];
export const dbName = (domain, env) => `disclo-${domain}${env === "staging" ? "-staging" : ""}`;

function wrangler(args) {
  // Cloudflare API rate limit (code 971 / Retry-After): wait and retry, up to 5 times.
  for (let attempt = 1; ; attempt++) {
    try {
      return execFileSync("npx", ["--yes", "wrangler@4.156.1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      const msg = String(e.stderr ?? e.message);
      if (attempt >= 5 || !/971|throttl|Retry-After/i.test(msg)) throw e;
      const wait = Number(/wait (\d+) second/.exec(msg)?.[1] ?? 30) + 2;
      console.log(`Cloudflare API rate limit; waiting ${wait}s (attempt ${attempt})`);
      execFileSync("sleep", [String(wait)]);
    }
  }
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
} else if (cmd === "worker") {
  // node tools/d1.mjs worker <dir>: fill ${domain} / ${domain-staging} ids in <dir>/wrangler.template.json -> wrangler.json
  const have = listDbs();
  const tpl = readFileSync(join(a, "wrangler.template.json"), "utf8");
  const out = tpl.replace(/\$\{([a-z]+)(-staging)?\}/g, (_m, d, st) => {
    const id = have.get(dbName(d, st ? "staging" : "production"));
    if (!id) throw new Error(`missing database for ${d}${st ?? ""}`);
    return id;
  });
  writeFileSync(join(a, "wrangler.json"), out);
  console.log(`wrote ${a}/wrangler.json`);
} else {
  console.error("usage: d1.mjs ensure|ids|config <dir> <env>|worker <dir>");
  process.exit(2);
}
