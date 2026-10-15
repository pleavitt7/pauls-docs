import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema({
    extend: z.object({
      date: z.coerce.date().optional(),
      order: z.number().int().positive().optional(),
      tags: z.array(z.string()).default([]),
      diagram: z.string().optional(),
    }),
  }),
});

const i18n = defineCollection({
  loader: i18nLoader(),
  schema: i18nSchema(),
});

export const collections = { docs, i18n };
