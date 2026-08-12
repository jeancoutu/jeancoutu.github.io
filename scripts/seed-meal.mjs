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
  name: "Poulet grec grillé, patates et tzatziki",
  duration: "long",
  supperDays: [],
  tags: ["grec"],
  url: "https://www.instagram.com/reels/DayU1BPp5wf/",
  instructions: [
    "Mélanger les ingrédients de la marinade, ajouter le poulet et laisser mariner de 6 à 24 heures au réfrigérateur. Cuire au BBQ à 400 °F jusqu’à ce que le poulet soit bien cuit et caramélisé.",
    "Faire bouillir les quartiers de pommes de terre de 6 à 10 minutes, jusqu’à ce qu’ils soient tendres. Égoutter, mélanger avec le reste des ingrédients, puis cuire au four à 350 °F jusqu’à ce qu’elles soient dorées et croustillantes. Remuer toutes les 10 minutes.",
    "Râper et essorer le concombre. Mélanger tous les ingrédients de la sauce tzatziki et laisser reposer au réfrigérateur au moins 30 minutes.",
    "Couper la tomate, le poivron et le concombre en dés. Trancher l’oignon rouge en fines lanières, puis mélanger tous les ingrédients de la salade grecque.",
  ],
  ingredients: [
    { name: "Hauts de cuisse de poulet", quantity: "8", category: "meat", section: "Marinade" },
    { name: "Vinaigre de vin blanc", quantity: "1 c. à soupe", category: "aisle", section: "Marinade" },
    { name: "Moutarde", quantity: "2 c. à soupe", category: "aisle", section: "Marinade" },
    { name: "Huile d'olive", quantity: "1/4 tasse", category: "aisle", section: "Marinade" },
    { name: "Jus de citron", quantity: "1 citron", category: "vegetables", section: "Marinade" },
    { name: "Ail", quantity: "5 gousses", category: "aisle", section: "Marinade" },
    { name: "Origan", quantity: "1 1/2 c. à soupe", category: "aisle", section: "Marinade" },
    { name: "Cumin", quantity: "1 c. à soupe", category: "aisle", section: "Marinade" },
    { name: "Sel", quantity: "1 1/2 c. à thé", category: "aisle", section: "Marinade" },
    { name: "Poivre", quantity: "1 1/2 c. à thé", category: "aisle", section: "Marinade" },
    { name: "Patate", quantity: "6 à 8", category: "vegetables", section: "Patates grecques" },
    { name: "Bouillon de poulet", quantity: "1 cube", category: "aisle", section: "Patates grecques" },
    { name: "Huile d'olive", quantity: "1/2 tasse", category: "aisle", section: "Patates grecques" },
    { name: "Origan", quantity: "1 c. à soupe", category: "aisle", section: "Patates grecques" },
    { name: "Paprika", quantity: "1 c. à soupe", category: "aisle", section: "Patates grecques" },
    { name: "Ail", quantity: "2 à 3 gousses", category: "aisle", section: "Patates grecques" },
    { name: "Thym séché", quantity: "1/2 c. à soupe", category: "aisle", section: "Patates grecques" },
    { name: "Sel", quantity: "Au goût", category: "aisle", section: "Patates grecques" },
    { name: "Poivre", quantity: "Au goût", category: "aisle", section: "Patates grecques" },
    { name: "yogourt grec nature", quantity: "1 tasse", category: "fridge", section: "Sauce tzatziki" },
    { name: "Concombre", quantity: "1/2 concombre anglais", category: "vegetables", section: "Sauce tzatziki" },
    { name: "Ail", quantity: "2 gousses", category: "aisle", section: "Sauce tzatziki" },
    { name: "Vinaigre de vin blanc", quantity: "1 c. à soupe", category: "aisle", section: "Sauce tzatziki" },
    { name: "Huile d'olive", quantity: "1 c. à soupe", category: "aisle", section: "Sauce tzatziki" },
    { name: "Sel", quantity: "Au goût", category: "aisle", section: "Sauce tzatziki" },
    { name: "Poivre", quantity: "Au goût", category: "aisle", section: "Sauce tzatziki" },
    { name: "Tomate", quantity: "1", category: "vegetables", section: "Salade grecque" },
    { name: "Poivron vert", quantity: "1", category: "vegetables", section: "Salade grecque" },
    { name: "Concombre", quantity: "1/2 concombre anglais", category: "vegetables", section: "Salade grecque" },
    { name: "Fromage Feta", quantity: "Au goût", category: "fridge", section: "Salade grecque" },
    { name: "Oignon rouge", quantity: "1/2 petit", category: "vegetables", section: "Salade grecque" },
    { name: "Huile d'olive", quantity: "1 c. à soupe", category: "aisle", section: "Salade grecque" },
    { name: "Vinaigre de vin rouge", quantity: "1 c. à soupe", category: "aisle", section: "Salade grecque" },
    { name: "Sel", quantity: "Au goût", category: "aisle", section: "Salade grecque" },
    { name: "Poivre", quantity: "Au goût", category: "aisle", section: "Salade grecque" },
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
      tags: meal.tags,
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
        section: ing.section ?? null,
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
