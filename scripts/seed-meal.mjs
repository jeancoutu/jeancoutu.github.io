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
  name: "Poulet aux herbes et à l'ail",
  duration: "medium",
  supperDays: [],
  tags: [],
  url: "https://www.youtube.com/shorts/vAzMBfiVDaY",
  instructions: [
    "Couper les hauts de cuisse de poulet en cubes. Ajouter l'assaisonnement et l'huile d'olive, bien mélanger puis réserver.",
    "Trancher l'oignon rouge et l'oignon blanc, ajouter dans un grand plat à four avec les tomates séchées égouttées et hachées, les assaisonnements et l'huile d'avocat en vaporisateur. Bien mélanger, placer la gousse d'ail entière au centre puis couvrir de papier d'aluminium.",
    "Cuire au four 45 minutes à 190C/380F en vérifiant à mi-cuisson. Les oignons devraient être dorés et caramélisés.",
    "Presser l'ail, bien mélanger et pendant que le plat est encore chaud, ajouter le persil, la sauce soya foncée, le parmesan, le lait et le fromage à la crème.",
    "Remuer continuellement jusqu'à ce que ce soit fondu et crémeux. Vous pouvez remettre au four à basse température pour épaissir légèrement la sauce. Ajouter les pâtes cuites et incorporer délicatement jusqu'à consistance riche et généreuse.",
    "Sur une grande plaque de cuisson doublée, étaler le poulet puis cuire au four 18 minutes à 200C/400F et griller (broil) 5 minutes de plus jusqu'à ce qu'il soit doré et croustillant. Servir avec les pâtes aux oignons caramélisés et ENJOY!",
  ],
  ingredients: [
    { name: "Hauts de cuisse de poulet", quantity: "1200g", category: "meat" },
    { name: "Sel", quantity: "2 c. à thé", category: "aisle" },
    { name: "Assaisonnement italien épicé", quantity: "4 c. à thé", category: "aisle" },
    { name: "Persil séché", quantity: "3 c. à thé", category: "aisle" },
    { name: "Poudre d'ail", quantity: "4 c. à thé", category: "aisle" },
    { name: "Paprika", quantity: "4 c. à thé", category: "aisle" },
    { name: "Huile d'olive", quantity: "6 c. à thé (30 g)", category: "aisle" },
    { name: "Oignon rouge", quantity: "200g", category: "vegetables" },
    { name: "Oignon blanc", quantity: "200g", category: "vegetables" },
    { name: "Tomates séchées", quantity: "100g", category: "aisle" },
    { name: "Sel", quantity: "1 c. à thé", category: "aisle" },
    { name: "Épice Italienne", quantity: "3 c. à thé", category: "aisle" },
    { name: "Paprika", quantity: "2 c. à thé", category: "aisle" },
    { name: "Ail", quantity: "1 gousse entière", category: "vegetables" },
    { name: "Huile d'avocat", quantity: "10 secondes", category: "aisle" },
    { name: "Lait évaporé", quantity: "400-450g", category: "fridge" },
    { name: "Fromage à la crème", quantity: "120g", category: "fridge" },
    { name: "Parmesan râpé", quantity: "90-100g", category: "fridge" },
    { name: "Sauce soya", quantity: "20-25g", category: "aisle" },
    { name: "Persil frais", quantity: "1-2 c. à soupe", category: "vegetables" },
    { name: "Pâte spaghetti", quantity: "350g", category: "aisle" },
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
