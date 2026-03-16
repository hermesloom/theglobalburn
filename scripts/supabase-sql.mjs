#!/usr/bin/env node
/**
 * Run arbitrary SQL against Supabase production database.
 * Requires SUPABASE_DB_URL in .env (from Supabase Dashboard > Project Settings > Database > Connection string).
 *
 * Usage:
 *   npm run supabase:sql -- -f misc/verify-webhook-affected-users.sql
 *   npm run supabase:sql -- "SELECT 1"
 *   npm run supabase:sql:verify-webhook
 */

import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

// Load .env
function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  try {
    const env = readFileSync(envPath, "utf8");
    for (const line of env.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1).replace(/\\(.)/g, "$1");
        }
        process.env[key] = value;
      }
    }
  } catch {}
}

loadEnv();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "Error: SUPABASE_DB_URL not set. Add it to .env from Supabase Dashboard > Project Settings > Database > Connection string"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
let sql;
if (args[0] === "-f" || args[0] === "--file") {
  const filePath = args[1] || "";
  const fullPath = join(process.cwd(), filePath);
  sql = readFileSync(fullPath, "utf8");
} else if (args.length > 0) {
  sql = args.join(" ");
} else {
  console.error("Usage: supabase-sql.mjs [-f <file>] [SQL...]");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function run() {
  try {
    await client.connect();
    const result = await client.query(sql);

    if (result.rows && result.rows.length > 0) {
      const columns = Object.keys(result.rows[0]);
      const widths = columns.map((c) =>
        Math.max(c.length, ...result.rows.map((r) => String(r[c] ?? "").length))
      );
      const header = columns
        .map((c, i) => c.padEnd(widths[i]))
        .join(" | ");
      const separator = columns.map((_, i) => "-".repeat(widths[i])).join("-+-");
      console.log(header);
      console.log(separator);
      for (const row of result.rows) {
        console.log(
          columns
            .map((c, i) => String(row[c] ?? "").padEnd(widths[i]))
            .join(" | ")
        );
      }
      console.log(`\n(${result.rowCount} row${result.rowCount === 1 ? "" : "s"})`);
    } else if (result.command) {
      console.log(result.command, result.rowCount ?? 0, "rows affected");
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
