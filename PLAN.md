# Weekly Meal Planner PWA

## Overview

Build a simple Progressive Web App (PWA) that helps users plan meals for the week.

The application should:

* Display a list of meals.
* Allow viewing recipe details and cooking instructions.
* Allow assigning meals to days of the week.
* Allow automatically generating a weekly meal plan.
* Display ingredients required for the planned meals.
* Store all data locally without a backend or database.

---

# Technology Stack

## Frontend

* Svelte 5
* TypeScript
* Vite

## Styling

* TailwindCSS

## State & Storage

* Svelte stores
* LocalStorage for persistence

## PWA

* vite-plugin-pwa

## Deployment

Application must be deployable as a static website:

* GitHub Pages
* Cloudflare Pages
* Netlify
* Vercel

No backend services required.

---

# Core Features

## 1. Meals Library

Users can browse available meals.

### Requirements

* Display all meals.
* Search meals by name.
* Filter meals by duration.
* Open a meal to view details.

### Duration Tags

Meals must contain one of:

* `short`
* `medium`
* `long`

### Example Meal Card

```text
Spaghetti

Duration: Medium

[ View Recipe ]
```

---

## 2. Meal Details

Users can view complete recipe information.

### Display

* Meal name
* Duration tag
* Ingredients list
* Step-by-step instructions

### Example

```text
Spaghetti

Duration: Medium

Ingredients
- 500 g Ground beef
- 1 jar (650 mL) Tomato sauce
- 1 Onion
- 2 Garlic cloves
- 450 g Spaghetti noodles

Instructions
1. Cook onions.
2. Brown beef.
3. Add sauce.
4. Cook pasta.
5. Combine and serve.
```

---

## 3. Weekly Planner

Main feature of the application.

### Days

Display:

* Monday
* Tuesday
* Wednesday
* Thursday
* Friday
* Saturday
* Sunday

### Manual Planning

Each day contains a meal selector.

Example:

```text
Monday
[ Spaghetti ▼ ]
```

Changes must be saved immediately.

---

## 4. Auto Fill Week

Button:

```text
Auto Fill Week
```

### Behavior

* Randomly select meals from available meals.
* Avoid duplicates whenever possible.
* Fill all currently empty days.
* Save automatically.

### Initial Algorithm

```ts
const shuffledMeals = shuffle(meals);

for (const day of days) {
  if (!day.hasMeal) {
    assignNextMeal();
  }
}
```

---

## 5. Clear Week

Button:

```text
Clear Week
```

### Behavior

* Remove all selected meals.
* Save automatically.

---

## 6. Ingredient Summary

Displayed below the weekly planner.

### Title

```text
Ingredients Needed This Week
```

### Behavior

* Show only meals currently selected in the week.
* Group ingredients under each meal.
* Do not merge ingredients.
* Do not create a grocery list.
* Ignore duplicate ingredients across meals.

### Example

```text
Spaghetti

- 500 g Ground beef
- 1 jar (650 mL) Tomato sauce
- 1 Onion

Chicken Stir Fry

- 500 g Chicken breast
- 2 tbsp Soy sauce
- 1 Broccoli
```

---

# Navigation

Mobile-first navigation.

Bottom tab bar:

```text
Planner
Meals
```

---

# Data Model

## Duration

```ts
export type DurationTag =
  | "short"
  | "medium"
  | "long";
```

---

## Meal

```ts
export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Meal {
  id: string;
  name: string;
  duration: DurationTag;

  ingredients: Ingredient[];

  instructions: string[];
}
```

### Example

```ts
{
  id: "spaghetti",
  name: "Spaghetti",
  duration: "medium",

  ingredients: [
    {
      name: "Ground beef",
      quantity: "500 g"
    },
    {
      name: "Tomato sauce",
      quantity: "1 jar (650 mL)"
    },
    {
      name: "Onion",
      quantity: "1"
    },
    {
      name: "Garlic cloves",
      quantity: "2"
    },
    {
      name: "Spaghetti noodles",
      quantity: "450 g"
    }
  ],

  instructions: [
    "Cook onions.",
    "Brown beef.",
    "Add sauce.",
    "Cook pasta.",
    "Combine and serve."
  ]
}
```

---

## Weekly Plan

```ts
export interface WeeklyPlan {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}
```

### Storage

Use LocalStorage.

Key:

```text
weekly-plan
```

---

# File Structure

```text
src/
├── data/
│   └── meals.ts
│
├── routes/
│   ├── planner/
│   ├── meals/
│   └── meal/[id]/
│
├── lib/
│   ├── components/
│   ├── stores/
│   └── utils/
│
├── app.html
└── main.ts
```

---

# Seed Data

Provide at least 15 predefined meals.

## Short

* Grilled Cheese
* Quesadillas
* Omelette
* Sandwiches
* Caesar Salad

## Medium

* Spaghetti
* Chicken Stir Fry
* Tacos
* Fried Rice
* Burgers

## Long

* Lasagna
* Beef Stew
* Chili
* Pulled Pork
* Shepherd's Pie

Every meal must include:

* Name
* Duration tag
* Ingredient list
* Cooking instructions

---

# PWA Requirements

The application must be installable on iPhone.

## Manifest

```json
{
  "name": "Weekly Meal Planner",
  "short_name": "Meals",
  "display": "standalone",
  "theme_color": "#ffffff",
  "background_color": "#ffffff"
}
```

## Requirements

* Installable as a PWA
* Offline support
* App icon
* Service worker generated through vite-plugin-pwa

---

# Non-Goals

Do not implement:

* User accounts
* Authentication
* Backend API
* Database
* Cloud synchronization
* Grocery list generation
* Pantry tracking
* Nutrition tracking
* AI meal generation
* Recipe import from URLs

These may be added later.

---

# Definition of Done

The project is complete when:

* User can browse meals.
* User can search meals.
* User can filter meals by duration.
* User can view recipe details.
* User can manually assign meals to each day.
* User can auto-fill the week.
* User can clear the week.
* Weekly plan persists after page refresh.
* Ingredient summary updates automatically.
* Application works offline.
* Application is installable as an iPhone PWA.
* No backend or database is required.
