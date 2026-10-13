import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const diagrams = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/diagrams' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    order: z.number().int().positive(),
    tags: z.array(z.string()).default([]),
    diagram: z.string(),
  }),
});

export const collections = { diagrams };
