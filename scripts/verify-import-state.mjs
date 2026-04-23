import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL не знайдено");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

async function count(tableName) {
  const result = await pool.query(`select count(*)::int as c from "${tableName}"`);
  return result.rows[0]?.c ?? 0;
}

async function main() {
  const users = await pool.query(`select email, name from "User" order by email`);
  const payload = {
    users: await count("User"),
    deals: await count("Deal"),
    procurementRequests: await count("ProcurementRequest"),
    procurementItems: await count("ProcurementItem"),
    userEmails: users.rows.map((u) => u.email),
    demoLikeUsers: users.rows.filter((u) =>
      /demo|admin@enver|vera\.blochytska|admin@|demo@/i.test(u.email),
    ),
  };

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
