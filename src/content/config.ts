import { defineCollection, z } from "astro:content";

const recipes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    cuisine: z.string(),
    // Optional Norwegian headnote (italic body between title and columns)
    intro: z.string().optional(),
    // Rough "added" date — drives newest-first home sort
    date: z.coerce.date().optional(),
    foodType: z.string().optional(),
    tags: z.array(z.string()).default([]),
    servings: z.number().int().positive().optional(),
    totalTimeMinutes: z.number().int().positive().optional(),
    // Most recipes carry prep + cook instead of a single total; deriveTotalTime unifies them
    prepTimeMinutes: z.number().int().nonnegative().optional(),
    cookTimeMinutes: z.number().int().nonnegative().optional(),
    season: z.string().optional(),
    image: z.string().optional(),
    ingredients: z
      .union([z.array(z.string()), z.string()])
      .transform((value) => {
        if (typeof value === "string") {
          return value
            .split(/\r?\n/)
            .map((line) => line.trim().replace(/^-+\s*/, ""))
            .filter(Boolean);
        }
        return value;
      })
      .optional(),
  }),
});

const meta = defineCollection({
  type: "data",
  // Union: cuisines.json | country-regions.json | staples.json
  schema: z.union([
    z.object({
      cuisines: z.array(
        z.object({
          slug: z.string(),
          label: z.string(),
          parent: z.string().nullable().optional(),
        })
      ),
    }),
    z.object({
      countries: z.record(
        z.object({
          name: z.string(),
          region: z.string().nullable(),
        })
      ),
    }),
    z.object({
      staples: z.array(z.string()),
    }),
  ]),
});

export const collections = {
  recipes,
  meta,
};
