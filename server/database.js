const { HttpError } = require("./http.js");
let pool;
function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.STORAGE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  );
}
function database() {
  const connectionString = getConnectionString();
  if (!connectionString)
    throw new HttpError(
      503,
      "Le stockage sécurisé des réservations doit être configuré.",
    );
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      query_timeout: 6000,
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
