// Run once to seed a single meal into Supabase:
//   node scripts/seed-meal-mexican-grilled-chicken.mjs
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

const meal = {
  name: "Poulet grillé mexicain",
  duration: "long",
  supperDays: [],
  url: "https://www.youtube.com/shorts/Q-EaDLrhzQE",
  instructions: [
    "Retirer l'excédent de gras des hauts de cuisse de poulet désossés. Ajouter dans un bol avec l'assaisonnement mexicain, le jus de lime et l'huile d'olive. Bien mélanger pour mariner.",
    "Ajouter le riz cru rincé dans une casserole d'eau, porter à ébullition puis laisser mijoter à feu doux jusqu'à cuisson complète. Une fois cuit, laisser refroidir, ajouter la coriandre hachée avec le jus de lime et une pincée de sel. Bien mélanger puis réserver.",
    "Sur une grande plaque de cuisson doublée, étaler le poulet mariné uniformément puis cuire au four 23 minutes à 200C/390F et griller (broil) 5-6 minutes jusqu'à ce qu'il soit doré, légèrement carbonisé et juteux.",
    "Retirer le poulet de la plaque, ajouter le maïs sucré, l'oignon rouge, la poudre d'ail et le paprika. Mélanger avec tout le jus de cuisson du poulet puis étaler uniformément. Cuire au four 15 minutes de plus jusqu'à ce que ce soit croustillant.",
    "Ajouter le maïs rôti dans un grand bol à mélanger, avec tous les ingrédients listés puis bien mélanger jusqu'à consistance crémeuse.",
    "Couper le poulet en cubes, servir avec le riz à la coriandre et lime ainsi que la salade de maïs crémeuse et ENJOY!",
  ],
  ingredients: [
    { name: "Hauts de cuisse de poulet", quantity: "1300g", category: "meat" },
    { name: "Sel", quantity: "2.5 c. à thé", category: "aisle" },
    { name: "Paprika", quantity: "4 c. à thé", category: "aisle" },
    { name: "Cumin", quantity: "2.5 c. à thé", category: "aisle" },
    { name: "Poudre d'ail", quantity: "4 c. à thé", category: "aisle" },
    { name: "Poudre d'oignon", quantity: "3 c. à thé", category: "aisle" },
    { name: "Origan", quantity: "4 c. à thé", category: "aisle" },
    { name: "Poudre de chili", quantity: "1.5 c. à thé", category: "aisle" },
    { name: "Huile d'olive", quantity: "6 c. à thé (30 g)", category: "aisle" },
    { name: "Maïs en grain", quantity: "600 g", category: "aisle" },
    { name: "Oignon rouge", quantity: "1", category: "vegetables" },
    { name: "Poudre d'ail", quantity: "2 c. à thé", category: "aisle" },
    { name: "Paprika", quantity: "2 c. à thé", category: "aisle" },
    { name: "Poivron rouge", quantity: "1", category: "vegetables" },
    { name: "Jalapeño", quantity: "80 g", category: "vegetables" },
    { name: "Yogourt", quantity: "300 g", category: "fridge" },
    { name: "Mayonnaise", quantity: "100 g", category: "fridge" },
    { name: "Fromage feta", quantity: "70 g", category: "fridge" },
    { name: "Coriandre", quantity: "2 c. à soupe", category: "vegetables" },
    { name: "Assaisonnement Tajin", quantity: "3 c. à thé", category: "aisle" },
    { name: "Riz blanc", quantity: "250 g", category: "aisle" },
    { name: "Coriandre", quantity: "1", category: "vegetables" },
    { name: "Jus de lime", quantity: "1 c. à thé", category: "vegetables" },
    { name: "Sel, au goût", quantity: "1 c. à thé", category: "aisle" },
  ],
};

async function seed() {
  console.log(`Seeding meal "${meal.name}" into Supabase...`);

  const { data: existing } = await supabase
    .from("meals")
    .select("id")
    .eq("name", meal.name)
    .maybeSingle();

  if (existing) {
    console.log(`  SKIP  "${meal.name}" (already exists)`);
    return;
  }

  const { data: inserted, error: mealError } = await supabase
    .from("meals")
    .insert({
      household_id: householdId,
      name: meal.name,
      duration: meal.duration,
      url: meal.url,
      supper_days: meal.supperDays,
      instructions: meal.instructions,
    })
    .select("id")
    .single();

  if (mealError) {
    console.error(`  ERROR "${meal.name}":`, mealError.message);
    return;
  }

  if (meal.ingredients.length > 0) {
    const { error: ingError } = await supabase.from("meal_ingredients").insert(
      meal.ingredients.map((ing) => ({
        meal_id: inserted.id,
        name: ing.name,
        quantity: ing.quantity,
        category: ing.category,
      })),
    );
    if (ingError) {
      console.error(`  ERROR ingredients for "${meal.name}":`, ingError.message);
      return;
    }
  }

  console.log(`  OK    "${meal.name}"`);
  console.log("Done.");
}

seed().catch(console.error);
