import pg from "pg";
import fs from "fs";

const SOURCE_URL = process.env.DATABASE_URL;
if (!SOURCE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: SOURCE_URL, connectionTimeoutMillis: 10000 });

function escapeVal(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    const items = val.map((v) => {
      if (v === null) return "NULL";
      const s = String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${s}"`;
    });
    return `'{${items.join(",")}}'`;
  }
  if (val instanceof Date) return `'${val.toISOString()}'`;
  const s = String(val).replace(/'/g, "''");
  return `'${s}'`;
}

async function exportTable(client: pg.PoolClient, tableName: string): Promise<string[]> {
  let rows: Record<string, unknown>[];
  try {
    const res = await client.query(`SELECT * FROM "${tableName}" ORDER BY created_at ASC NULLS LAST`);
    rows = res.rows;
  } catch {
    try {
      const res = await client.query(`SELECT * FROM "${tableName}"`);
      rows = res.rows;
    } catch (err2) {
      console.warn(`  Skipping ${tableName}: ${err2}`);
      return [];
    }
  }

  if (rows.length === 0) return [];

  const cols = Object.keys(rows[0]);
  const stmts: string[] = [];

  for (const row of rows) {
    const values = cols.map((c) => escapeVal(row[c])).join(", ");
    stmts.push(`INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
  }
  return stmts;
}

const TABLES_IN_ORDER = [
  "users",
  "sessions",
  "clubs",
  "club_page_sections",
  "section_events",
  "join_requests",
  "user_quiz_answers",
  "events",
  "event_form_questions",
  "event_form_responses",
  "event_ticket_types",
  "event_rsvps",
  "club_ratings",
  "club_faqs",
  "club_schedule_entries",
  "club_moments",
  "moment_likes",
  "moment_comments",
  "event_comments",
  "notifications",
  "club_announcements",
  "club_polls",
  "poll_votes",
  "kudos",
  "club_proposals",
  "platform_transactions",
];

async function main() {
  const client = await pool.connect();
  try {
    const lines: string[] = [
      "-- CultFam data export",
      `-- Exported at ${new Date().toISOString()}`,
      "",
      "SET session_replication_role = 'replica';",
      "",
    ];

    for (const table of TABLES_IN_ORDER) {
      console.log(`  Exporting ${table}...`);
      const stmts = await exportTable(client, table);
      if (stmts.length > 0) {
        lines.push(`-- ${table} (${stmts.length} rows)`);
        lines.push(...stmts);
        lines.push("");
      } else {
        console.log(`    (empty)`);
      }
    }

    lines.push("SET session_replication_role = 'origin';");
    lines.push("");

    const out = lines.join("\n");
    fs.writeFileSync("scripts/data-export.sql", out, "utf8");
    console.log(`\nExport written to scripts/data-export.sql (${stmts_total(lines)} statements)`);
  } finally {
    client.release();
    await pool.end();
  }
}

function stmts_total(lines: string[]) {
  return lines.filter((l) => l.startsWith("INSERT")).length;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
