import fulfil from "../server/fulfil.js";
import db from "../server/database.js";
if (
  !process.env.DUFFEL_API_TOKEN ||
  process.env.LIVE_CHECKOUT_ENABLED !== "true"
)
  throw new Error("DUFFEL_API_TOKEN requis.");
try {
  console.log(JSON.stringify(await fulfil.fulfilOne()));
} finally {
  await db.database().end();
}
