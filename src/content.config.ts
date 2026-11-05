import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/work" }),
  schema: z.object({
    title: z.string(),
    // Add other frontmatter fields you might use later
    description: z.string().optional(),
    tags: z.array(z.string()),
    order: z.number().default(99), // Controls the display order
  }),
});

export const collections = { work };