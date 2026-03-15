import * as z from "zod";
import { Dependencies } from "../dependencies";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getTestSchema(deps: Dependencies) {
  const withLookupsSchema = z.record(z.string(), z.any());

  const actionSchema = z
    .object({
      type: z.enum(["track", "setAttribute"]),
      name: z.string(),
      value: z.any().optional(),
    })
    .strict();

  const attributeAssertionSchema = z
    .object({
      description: z.string().optional(),
      setAttribute: z.any().optional(),
      withLookups: withLookupsSchema.optional(),
      expectedToBeValid: z.boolean().optional(),
      expectedToBeSet: z.boolean().optional(),
      expectedAttribute: z.any().optional(),
    })
    .strict();

  const eventAssertionSchema = z
    .object({
      description: z.string().optional(),
      withLookups: withLookupsSchema.optional(),
      track: z.any().optional(),
      actions: z.array(actionSchema).optional(),
      expectedToBeValid: z.boolean().optional(),
      expectedEvent: z.any().optional(),
      expectedDestinations: z.array(z.string()).optional(),
    })
    .strict();

  const effectAssertionSchema = z
    .object({
      description: z.string().optional(),
      withLookups: withLookupsSchema.optional(),
      actions: z.array(actionSchema).optional(),
      expectedState: z.any().optional(),
      expectedToBeCalled: z
        .array(
          z
            .object({
              handler: z.string(),
              times: z.number().int().min(0).optional(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict();

  const destinationAssertionSchema = z
    .object({
      description: z.string().optional(),
      withLookups: withLookupsSchema.optional(),
      actions: z.array(actionSchema).optional(),
      expectedToBeTransported: z.boolean().optional(),
      expectedBody: z.any().optional(),
    })
    .strict();

  return z.union([
    z
      .object({
        attribute: z.string(),
        assertions: z.array(attributeAssertionSchema),
      })
      .strict(),
    z
      .object({
        event: z.string(),
        assertions: z.array(eventAssertionSchema),
      })
      .strict(),
    z
      .object({
        effect: z.string(),
        assertions: z.array(effectAssertionSchema),
      })
      .strict(),
    z
      .object({
        destination: z.string(),
        assertions: z.array(destinationAssertionSchema),
      })
      .strict(),
  ]);
}
