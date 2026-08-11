import * as z from "zod";

import type { ProjectConfig } from "../config";

const pattern = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value, "Patterns cannot have surrounding spaces")
  .refine((value) => !value.includes("**"), 'Use "*" for glob-like wildcard matching');

const patterns = z.union([z.literal("*"), pattern, z.array(pattern).min(1)]);

export function getTargetSchema(projectConfig: ProjectConfig) {
  const tag = z.string().refine((value) => projectConfig.tags.includes(value), {
    message: "Unknown tag",
  });

  return z
    .object({
      key: z.string().optional(),
      description: z.string().min(1),
      tag: tag.optional(),
      tags: z
        .union([
          z.array(tag).min(1),
          z.object({ or: z.array(tag).min(1) }).strict(),
          z.object({ and: z.array(tag).min(1) }).strict(),
        ])
        .optional(),
      includeEvents: patterns.optional(),
      excludeEvents: patterns.optional(),
      includeAttributes: patterns.optional(),
      excludeAttributes: patterns.optional(),
      includeDestinations: patterns.optional(),
      excludeDestinations: patterns.optional(),
      includeEffects: patterns.optional(),
      excludeEffects: patterns.optional(),
      pretty: z.boolean().optional(),
      stringify: z.boolean().optional(),
      revisionFromHash: z.boolean().optional(),
      promotable: z.boolean().optional(),
    })
    .strict()
    .refine((value) => !(value.tag && value.tags), {
      message: 'Only one of "tag" or "tags" can be defined',
      path: ["tags"],
    });
}
