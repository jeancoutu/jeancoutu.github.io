// Run once to seed all built-in meals into Supabase:
//   node scripts/seed-meals.mjs
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
const meals = [
  {
    name: "Sauté Thaï",
    duration: "short",
    supperDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    url: "",
    instructions: [
      "Faire boullir de l'eau et faire cuire les nouilles.",
      "Mélangr tous les ingrédients pour faire la sauce.",
      "Faire cuire le poulet avec de l'huile d'olive.",
      "Ajouter les légumes congelé à mi-cuisson du poulet",
      "Une fois le poulet/légume cuit, ajouter la sauce et faire cuire 2 minutes",
      "Ajouter des dumplings au besoin",
    ],
    ingredients: [
      { name: "Haut de cuisse de poulet", quantity: "6", category: "meat" },
      { name: "Légumes thaï surgelés", quantity: "1", category: "fridge" },
      { name: "Nouille asiatique", quantity: "1", category: "aisle" },
      { name: "Sauce soya", quantity: "5 c. à soupe", category: "aisle" },
      { name: "Ketchup", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Jus de lime", quantity: "1 c. à soupe", category: "vegetables" },
      { name: "Cassonade", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Srirache", quantity: "1 c. à thé", category: "aisle" },
      { name: "Huile de sésame", quantity: "1 c. à thé", category: "aisle" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
    ],
  },
  {
    name: "Gnocchi",
    duration: "medium",
    supperDays: ["wednesday", "friday", "saturday", "sunday"],
    url: "https://www.mealime.com/recipes/cheesy-one-pot-gnocchi-italian-sausage-spinach/9156",
    instructions: [
      "Couper l'oignon et l'ail.",
      "Faire cuire l'oignon et l'ail à feu moyen.",
      "Avec un sciseau/couteau, enlever l'emballage (comdon?) des saussices",
      "Avec un sciseau/couteau, couper les saucisses en morceau et ajouter dans la poèle avec l'oignon et l'ail",
      "Rapper le fromage",
      "Une foid les saucisses cuit, ajouter les gnocchis, tomate en dés, 1/2 tasse d'eau, épice italienne et sel",
      "Couvrir et laisser cuire jusqu'a ce que les gnocchis soient prêt (~5 mintues)",
      "Ajouter les épinards et laisser cuire 2 minutes",
      "Ajouter le fromage et laisser fondre",
    ],
    ingredients: [
      { name: "Épinard", quantity: "142g", category: "vegetables" },
      { name: "Tomate en dés", quantity: "796 ml", category: "aisle" },
      { name: "Ail", quantity: "4 gousses", category: "vegetables" },
      { name: "Fromage Mozzarela", quantity: "1/2 block", category: "fridge" },
      { name: "Saucisse", quantity: "4 à 6", category: "meat" },
      { name: "Gnocchi", quantity: "1", category: "aisle" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
      { name: "Épice Italienne", quantity: "1", category: "aisle" },
    ],
  },
  {
    name: "Sandwich",
    duration: "short",
    supperDays: [],
    url: "",
    instructions: ["Pas besoin d'instruction"],
    ingredients: [
      { name: "Viande à sandwich", quantity: "1", category: "meat" },
      { name: "Pain à sandwich", quantity: "1", category: "bakery" },
      { name: "Tomate", quantity: "1", category: "vegetables" },
    ],
  },
  {
    name: "Casserole Mexicaine",
    duration: "medium",
    supperDays: ["wednesday", "friday", "saturday", "sunday"],
    url: "https://www.circulaire-en-ligne.ca/recette/casserole-mexicaine-de-riz-au-boeuf",
    instructions: ["TBD"],
    ingredients: [
      { name: "Viande hachée", quantity: "1", category: "meat" },
      { name: "Fromage rapé", quantity: "1/2 block", category: "fridge" },
      { name: "Riz blanc", quantity: "1 tasse", category: "aisle" },
      { name: "Assaisonnement à tacos", quantity: "1", category: "aisle" },
      { name: "Légumes surgellés", quantity: "1", category: "fridge" },
      { name: "Tomate en dés", quantity: "796 ml", category: "aisle" },
      { name: "Salsa", quantity: "1 tasse", category: "aisle" },
      { name: "Bouillon de poulet", quantity: "1 tasse", category: "aisle" },
    ],
  },
  {
    name: "Macaroni",
    duration: "short",
    supperDays: ["monday", "tuesday", "thursday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Viande hachée", quantity: "1", category: "meat" },
      { name: "Poiveron rouge", quantity: "1", category: "vegetables" },
      { name: "Échalotte", quantity: "1", category: "vegetables" },
      { name: "Soupe tomate", quantity: "3 cannes", category: "aisle" },
      { name: "Macaroni", quantity: "3 tasses", category: "aisle" },
    ],
  },
  {
    name: "Pizza",
    duration: "medium",
    supperDays: ["friday", "saturday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Pain pizza", quantity: "4", category: "bakery" },
      { name: "Pepperoni", quantity: "1", category: "meat" },
      { name: "Sauce pizza", quantity: "1", category: "aisle" },
      { name: "Champignon", quantity: "1", category: "vegetables" },
      { name: "Olive", quantity: "1", category: "aisle" },
      { name: "Échalotte", quantity: "1", category: "vegetables" },
    ],
  },
  {
    name: "Tacos",
    duration: "medium",
    supperDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Pain taco", quantity: "1", category: "bakery" },
      { name: "Viande hachée", quantity: "1", category: "meat" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
      { name: "Assaisonnement à tacos", quantity: "1", category: "aisle" },
      { name: "Poiveron rouge", quantity: "1", category: "vegetables" },
      { name: "Tomate", quantity: "1", category: "vegetables" },
      { name: "Crème sure", quantity: "1", category: "fridge" },
      { name: "Salsa", quantity: "1", category: "aisle" },
    ],
  },
  {
    name: "Paté chinois",
    duration: "medium",
    supperDays: ["sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Patate", quantity: "8", category: "vegetables" },
      { name: "Viande hachée", quantity: "1", category: "meat" },
      { name: "Maïs en grain", quantity: "1 canne", category: "aisle" },
      { name: "Maïs en grain/jus", quantity: "2 cannes", category: "aisle" },
    ],
  },
  {
    name: "Saumon et légume",
    duration: "short",
    supperDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Saumon", quantity: "1", category: "meat" },
      { name: "Carotte", quantity: "3", category: "vegetables" },
      { name: "Épice à saumon", quantity: "1", category: "aisle" },
      { name: "Mayonnaise", quantity: "1/2 tasse", category: "fridge" },
      { name: "Jus de citron", quantity: "1 c. à soupe", category: "vegetables" },
      { name: "Relish", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Cornichon", quantity: "1", category: "aisle" },
    ],
  },
  {
    name: "Salade de Pâte",
    duration: "medium",
    supperDays: ["wednesday", "saturday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Pâte courte", quantity: "1", category: "aisle" },
      { name: "Poulet/Viande", quantity: "1", category: "meat" },
      { name: "Poiveron rouge", quantity: "1", category: "vegetables" },
      { name: "Fromage Feta", quantity: "1", category: "fridge" },
      { name: "Oignon rouge", quantity: "1", category: "vegetables" },
      { name: "Concombre", quantity: "1", category: "vegetables" },
      { name: "Tomate cerise", quantity: "1", category: "vegetables" },
      { name: "Olive noir", quantity: "1", category: "aisle" },
      { name: "Mayonnaise", quantity: "3/4 tasse", category: "fridge" },
      { name: "Jus de lime", quantity: "1 c. à soupe", category: "vegetables" },
      { name: "Vinaigre de vin rouge", quantity: "2 c. à soupe", category: "aisle" },
      { name: "yogourt grec nature", quantity: "1/4 tasse", category: "fridge" },
      { name: "Ail", quantity: "1 gousse", category: "vegetables" },
    ],
  },
  {
    name: "Fajitas",
    duration: "long",
    supperDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Poulet", quantity: "1", category: "meat" },
      { name: "Assaisonnement fajitas", quantity: "1", category: "aisle" },
      { name: "Pain fajitas", quantity: "1", category: "bakery" },
      { name: "Poiveron rouge", quantity: "1", category: "vegetables" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
      { name: "Crème sure", quantity: "1", category: "fridge" },
      { name: "Salsa", quantity: "1", category: "aisle" },
    ],
  },
  {
    name: "Quesedias au Poulet",
    duration: "medium",
    supperDays: ["wednesday", "friday", "saturday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Poulet", quantity: "1", category: "meat" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
      { name: "Poiveron rouge", quantity: "1", category: "vegetables" },
      { name: "Ketchup", quantity: "4 c. à soupe", category: "aisle" },
      { name: "Miel", quantity: "2 c. à soupe", category: "aisle" },
      { name: "Sauce soya", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Vinaigre de cidre (ou balsamique)", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Paprika", quantity: "1 c. à café", category: "aisle" },
      { name: "Crème sure (optionnel)", quantity: "1", category: "fridge" },
    ],
  },
  {
    name: "Hamberger",
    duration: "short",
    supperDays: ["friday", "saturday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Viande hachée", quantity: "1", category: "meat" },
      { name: "Pain hamberger", quantity: "1", category: "bakery" },
      { name: "Tomate", quantity: "1", category: "vegetables" },
      { name: "Cornichon", quantity: "1", category: "aisle" },
      { name: "Oignon", quantity: "1", category: "vegetables" },
    ],
  },
  {
    name: "Hot dog",
    duration: "short",
    supperDays: ["friday", "saturday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Saucisse hot dog", quantity: "1", category: "meat" },
      { name: "Pain hot dog", quantity: "1", category: "bakery" },
    ],
  },
  {
    name: "Spaghetti",
    duration: "short",
    supperDays: ["monday", "tuesday", "thursday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Pâte spaghetti", quantity: "1", category: "aisle" },
      { name: "Sauce spaghetti", quantity: "1", category: "aisle" },
    ],
  },
  {
    name: "Coquilles farcies",
    duration: "medium",
    supperDays: ["sunday"],
    url: "https://www.troisfoisparjour.com/fr/recettes/plats-principaux/pates/coquilles-geantes-farcies-au-poulet-epinards-fromage/",
    instructions: ["TBD"],
    ingredients: [
      { name: "Coquilles géantes", quantity: "1", category: "aisle" },
      { name: "Cuisse de poulet", quantity: "1", category: "meat" },
      { name: "Sauce tomate et basilic", quantity: "2 1/2 tasses", category: "aisle" },
      { name: "Oignon rouge", quantity: "1", category: "vegetables" },
      { name: "Ail", quantity: "2 gousses", category: "vegetables" },
      { name: "Épinard", quantity: "1 tasse", category: "vegetables" },
      { name: "Fromage ricotta", quantity: "1 tasse", category: "fridge" },
      { name: "Zeste citron", quantity: "1/2", category: "vegetables" },
      { name: "Mayonnaise", quantity: "1/4 tasse", category: "fridge" },
      { name: "Fromage mozzarella", quantity: "2 tassess", category: "fridge" },
      { name: "Oeuf", quantity: "1", category: "fridge" },
    ],
  },
  {
    name: "Poulet général tao",
    duration: "long",
    supperDays: ["saturday", "sunday"],
    url: "https://www.ricardocuisine.com/recettes/6076-poulet-general-tao-sans-friteuse",
    instructions: ["TBD"],
    ingredients: [
      { name: "Sauce soya", quantity: "6 c. à soupe", category: "aisle" },
      { name: "Bouillon de poulet", quantity: "6 c. à soupe", category: "aisle" },
      { name: "Vinaigre de riz", quantity: "6 c. à soupe", category: "aisle" },
      { name: "Gingembre", quantity: "2 c. à soupe", category: "vegetables" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
      { name: "Fécule de maïs", quantity: "4 c. à thé", category: "aisle" },
      { name: "Paprika doux", quantity: "2 c. à thé", category: "aisle" },
      { name: "Sambal oelek", quantity: "2 c. à thé", category: "aisle" },
      { name: "Huile de sésame grillé", quantity: "1 c. à thé", category: "aisle" },
      { name: "Sucre", quantity: "1 tasse", category: "aisle" },
      { name: "Poiveron rouge", quantity: "2", category: "vegetables" },
      { name: "Haut de cuisse de poulet", quantity: "1", category: "meat" },
      { name: "Farine tout usage", quantity: "1/2 tasse", category: "aisle" },
      { name: "Oignon vert", quantity: "2 (optionel)", category: "vegetables" },
    ],
  },
  {
    name: "Jambon et patate",
    duration: "short",
    supperDays: ["wednesday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Jambon", quantity: "1", category: "meat" },
      { name: "Patate", quantity: "6", category: "vegetables" },
      { name: "Carotte", quantity: "3", category: "vegetables" },
      { name: "Sirop d'érable", quantity: "1", category: "aisle" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
    ],
  },
  {
    name: "Saucisses et légumes",
    duration: "short",
    supperDays: ["monday", "tuesday", "wednesday", "thursday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Saussice", quantity: "8", category: "meat" },
      { name: "Poiveron rouge", quantity: "2", category: "vegetables" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
    ],
  },
  {
    name: "Shawarma et poulet grek",
    duration: "short",
    supperDays: ["monday", "tuesday", "wednesday", "thursday", "sunday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Cuisse de poulet", quantity: "1", category: "meat" },
      { name: "Fromage à la crème", quantity: "1", category: "fridge" },
      { name: "Mayonnaise", quantity: "1", category: "fridge" },
      { name: "Pain pita", quantity: "1", category: "bakery" },
      { name: "Tomate", quantity: "1", category: "vegetables" },
    ],
  },
  {
    name: "Boulettes aux pêches",
    duration: "medium",
    supperDays: ["wednesday", "saturday", "sunday"],
    url: "https://www.recettes.qc.ca/recettes/recette/boulettes-aux-peches-1967",
    instructions: ["TBD"],
    ingredients: [
      { name: "Viande hachée", quantity: "1", category: "meat" },
      { name: "Canne pêche", quantity: "1", category: "aisle" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
      { name: "Sauce chili", quantity: "1 tasse", category: "aisle" },
      { name: "Cassonade", quantity: "1/4 tasse", category: "aisle" },
      { name: "Moutarde", quantity: "1 c. à thé", category: "aisle" },
      { name: "Jus de citron", quantity: "1 c. à thé", category: "vegetables" },
    ],
  },
  {
    name: "Wrap poulet",
    duration: "short",
    supperDays: ["monday", "tuesday", "thursday"],
    url: "",
    instructions: ["TBD"],
    ingredients: [
      { name: "Croquette de poulet", quantity: "1", category: "meat" },
      { name: "Wrap", quantity: "1", category: "bakery" },
      { name: "Sauce ranch", quantity: "1", category: "fridge" },
      { name: "Tomate", quantity: "1", category: "vegetables" },
      { name: "Échalotte", quantity: "1", category: "vegetables" },
    ],
  },
  {
    name: "Tacos Carne Asada",
    duration: "long",
    supperDays: ["sunday"],
    url: "https://cocinarodriguez.com/carne-asada-tacos/",
    instructions: [
      "Dans un grand bol ou un sac de congélation, mélanger le jus de lime, le jus d'orange, la sauce soya, la coriandre hachée, le sel, l'oignon émincé, l'ail, le cumin, le poivron vert, l'origan, l'huile végétale et la bière brune.",
      "Ajouter le steak à la marinade et bien l'enrober.",
      "Couvrir et laisser mariner au réfrigérateur pendant au moins 1 heure, idéalement de 4 à 8 heures.",
      "Préchauffer le BBQ ou une poêle-grill à feu élevé.",
      "Retirer la viande de la marinade et jeter l'excédent de marinade.",
      "Cuire le steak de 2 à 4 minutes par côté, selon son épaisseur et la cuisson désirée.",
      "Retirer la viande du feu et la laisser reposer de 5 à 10 minutes.",
      "Couper la viande contre le grain en fines tranches, puis la hacher grossièrement en morceaux pour les tacos.",
      "Réchauffer les tortillas de maïs sur le BBQ ou dans une poêle sèche pendant quelques secondes de chaque côté.",
      "Garnir chaque tortilla de viande, d'oignon blanc en dés, de coriandre fraîche et de salsa.",
      "Servir avec des quartiers de lime et déguster immédiatement.",
    ],
    ingredients: [
      { name: "Steak mince (bavette, flanc, surlonge, hampe ou ribeye)", quantity: "2 lb", category: "meat" },
      { name: "Jus de lime", quantity: "2 limes", category: "vegetables" },
      { name: "Jus d'orange", quantity: "1 orange", category: "aisle" },
      { name: "Sauce soya", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Coriandre fraîche hachée", quantity: "1/2 tasse", category: "vegetables" },
      { name: "Sel", quantity: "2 c. à thé", category: "aisle" },
      { name: "Oignon blanc émincé", quantity: "1/2 oignon", category: "vegetables" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
      { name: "Cumin", quantity: "1 c. à thé", category: "aisle" },
      { name: "Poivron vert finement haché", quantity: "1/2 petit poivron", category: "vegetables" },
      { name: "Origan", quantity: "1 c. à thé", category: "aisle" },
      { name: "Huile végétale", quantity: "1/3 tasse", category: "aisle" },
      { name: "Bière brune", quantity: "1/4 tasse", category: "aisle" },
      { name: "Tortillas de maïs", quantity: "12", category: "bakery" },
      { name: "Coriandre fraîche (garniture)", quantity: "Au goût", category: "vegetables" },
      { name: "Oignon blanc en dés (garniture)", quantity: "Au goût", category: "vegetables" },
      { name: "Salsa", quantity: "Au goût", category: "aisle" },
      { name: "Limes en quartiers", quantity: "Au goût", category: "vegetables" },
    ],
  },
  {
    name: "Fête",
    duration: "short",
    supperDays: [],
    url: "",
    instructions: [],
    ingredients: [],
  },
  {
    name: "Dal de lentilles rouges au lait de coco",
    duration: "medium",
    supperDays: [],
    url: "",
    instructions: [
      "Base aromatique : Faire revenir l'oignon haché dans l'huile 4 minutes. Ajouter l'ail et le gingembre, puis la pâte de curry rouge. Cuire 1 minute jusqu'à ce que ça embaume.",
      "Ajouter les lentilles rincées, les tomates en conserve et le lait de coco. Porter à ébullition, puis réduire à feu doux.",
      "Laisser mijoter 20 minutes en remuant de temps en temps. Les lentilles vont absorber le liquide et épaissir la sauce naturellement.",
      "Cuire le riz basmati en parallèle. Terminer le dal avec le jus de lime, ajuster le sel. Servir sur le riz.",
    ],
    ingredients: [
      { name: "Lentilles rouges sèches", quantity: "200g", category: "aisle" },
      { name: "Lait de coco", quantity: "400ml", category: "aisle" },
      { name: "Tomate en dés", quantity: "400g", category: "aisle" },
      { name: "Oignon jaune", quantity: "1", category: "vegetables" },
      { name: "Ail", quantity: "3 gousses", category: "vegetables" },
      { name: "Gingembre", quantity: "1 c. à thé", category: "vegetables" },
      { name: "Pâte de curry rouge", quantity: "2 c. à soupe", category: "aisle" },
      { name: "Riz blanc", quantity: "200g", category: "aisle" },
      { name: "Huile de coco", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Jus de lime", quantity: "1", category: "vegetables" },
    ],
  },
  {
    name: "Bowl poulet honey butter & alfredo toscan",
    duration: "medium",
    supperDays: [],
    url: "https://www.youtube.com/watch?v=dOtcA8L-uA0&list=LL&index=1",
    instructions: [
      "Assaisonner les cubes de poulet avec sel, flocons de piment, persil, poudre d'ail, poudre d'oignon et paprika fumé.",
      "Cuire le poulet à feu moyen 3-4 minutes de chaque côté dans une seule couche jusqu'à ce qu'il soit doré et croustillant.",
      "Réduire le feu, ajouter le beurre, le miel et la sauce soya. Mélanger 1 minute jusqu'à ce que le poulet soit bien enrobé.",
      "Dans une autre poêle, faire revenir l'ail haché et les tomates séchées à feu moyen-doux 3-4 minutes. Ajouter les herbes italiennes et le sel, cuire 1 minute de plus.",
      "Réduire le feu, ajouter le lait, le fromage à la crème et le parmesan. Remuer 2-3 minutes jusqu'à légèrement épaissi.",
      "Cuire les pâtes en parallèle. Incorporer les pâtes cuites à la sauce alfredo.",
      "Servir les pâtes alfredo dans un bol, garnir de poulet honey butter et de persil frais.",
    ],
    ingredients: [
      { name: "Poulet", quantity: "4 poitrines", category: "meat" },
      { name: "Flocons de piment", quantity: "1.5 c. à thé", category: "aisle" },
      { name: "Persil séché", quantity: "2 c. à thé", category: "aisle" },
      { name: "Poudre d'ail", quantity: "2 c. à thé", category: "aisle" },
      { name: "Poudre d'oignon", quantity: "2 c. à thé", category: "aisle" },
      { name: "Paprika", quantity: "2 c. à thé", category: "aisle" },
      { name: "Huile d'olive", quantity: "3 c. à thé", category: "aisle" },
      { name: "Beurre", quantity: "40g", category: "fridge" },
      { name: "Miel", quantity: "20g", category: "aisle" },
      { name: "Sauce soya", quantity: "15g", category: "aisle" },
      { name: "Ail", quantity: "30g", category: "vegetables" },
      { name: "Tomates séchées", quantity: "150g", category: "aisle" },
      { name: "Épice Italienne", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Lait 2%", quantity: "350g", category: "fridge" },
      { name: "Fromage à la crème", quantity: "200g", category: "fridge" },
      { name: "Parmesan râpé", quantity: "60g", category: "fridge" },
      { name: "Linguine", quantity: "275g", category: "aisle" },
    ],
  },
  {
    name: "Bowl de riz au poulet teriyaki & avocat",
    duration: "medium",
    supperDays: [],
    url: "",
    instructions: [
      "Mélanger la sauce soya, le miel, l'ail haché, le gingembre et l'huile de sésame. Faire mariner le poulet au moins 20 minutes (idéalement 1h).",
      "Cuire le riz selon les instructions du paquet.",
      "Dans une poêle à feu moyen-vif, cuire le poulet 12 minutes par côté jusqu'à caramélisation. Verser le reste de la marinade en fin de cuisson.",
      "Assembler dans un bol : riz, tranches de poulet, avocat en tranches. Garnir de graines de sésame et d'oignons verts hachés.",
    ],
    ingredients: [
      { name: "Poulet", quantity: "400g", category: "meat" },
      { name: "Riz blanc", quantity: "200g", category: "aisle" },
      { name: "Avocat", quantity: "1", category: "vegetables" },
      { name: "Sauce soya", quantity: "3 c. à soupe", category: "aisle" },
      { name: "Miel", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Ail", quantity: "2 gousses", category: "vegetables" },
      { name: "Gingembre", quantity: "1 c. à thé", category: "vegetables" },
      { name: "Huile de sésame", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Graines de sésame", quantity: "1 c. à soupe", category: "aisle" },
      { name: "Oignon vert", quantity: "2 (optionel)", category: "vegetables" },
    ],
  },
];

async function seed() {
  console.log(`Seeding ${meals.length} meals into Supabase...`);

  for (const meal of meals) {
    const { data: existing } = await supabase
      .from("meals")
      .select("id")
      .eq("name", meal.name)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP  "${meal.name}" (already exists)`);
      continue;
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
      continue;
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
        continue;
      }
    }

    console.log(`  OK    "${meal.name}"`);
  }

  console.log("Done.");
}

seed().catch(console.error);
