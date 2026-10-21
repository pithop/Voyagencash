const { HttpError } = require("./http.js");
let pool;
function database() {
  if (!process.env.DATABASE_URL)
    throw new HttpError(
      503,
      "Le stockage sécurisé des réservations doit être configuré.",
    );
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}
async function transaction(fn) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
module.exports = { database, transaction };
