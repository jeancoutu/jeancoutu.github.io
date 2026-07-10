// Fetches every distinct (name, category) ingredient pair already in Supabase,
// grouped by category, for reuse when drafting a new meal:
//   node scripts/fetch-ingredients.mjs
// Requires SUPABASE_SERVICE_ROLE_KEY in .env (bypasses RLS).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const [key, ...val] = line.split("=");
      return [key.trim(), val.join("=").trim()];
    }),
);

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const householdId = env.HOUSEHOLD_ID;

async function main() {
  const { data, error } = await supabase
    .from("meal_ingredients")
    .select("name, category, meals!inner(household_id)")
    .eq("meals.household_id", householdId);
  if (error) {
    console.error("ERROR fetching ingredients:", error.message);
    process.exit(1);
  }

  const seen = new Map();
  for (const { name, category } of data) {
    const key = `${name.toLowerCase()}|${category}`;
    if (!seen.has(key)) seen.set(key, { name, category });
  }

  const byCategory = {};
  for (const { name, category } of seen.values()) {
    (byCategory[category] ??= []).push(name);
  }

  for (const category of Object.keys(byCategory).sort()) {
    byCategory[category].sort((a, b) => a.localeCompare(b, "fr"));
    console.log(`\n${category}:`);
    for (const name of byCategory[category]) console.log(`  - ${name}`);
  }
}

main();
