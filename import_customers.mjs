// Import customers from Excel into Convex via importMany mutation
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";
import { api } from "./convex/_generated/api.js";

const CONVEX_URL = "https://rightful-parakeet-660.convex.cloud";
const rows = JSON.parse(readFileSync("./customers-import.json", "utf-8"));

console.log(`Importing ${rows.length} customers...`);

const client = new ConvexHttpClient(CONVEX_URL);

try {
  const result = await client.mutation(api.customers.importMany, { rows });
  console.log("✅ Result:", result);
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
