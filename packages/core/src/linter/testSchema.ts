import * as z from "zod";
import { Dependencies } from "../dependencies";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getTestSchema(deps: Dependencies) {
  const withLookupsSchema = z.record(z.string(), z.any());
  const withAttributesSchema = z.record(z.string(), z.any());
  const matrixSchema = z
    .record(z.string(), z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).min(1))
    .refine((matrix) => Object.keys(matrix).length > 0, "Matrix must contain at least one entry");

  const actionSchema = z
    .object({
      type: z.enum(["track", "setAttribute", "removeAttribute"]),
      name: z.string(),
      value: z.any().optional(),
    })
    .strict();

  const attributeAssertionSchema = z
    .object({
      description: z.string().optional(),
      matrix: matrixSchema.optional(),
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
      matrix: matrixSchema.optional(),
      withAttributes: withAttributesSchema.optional(),
      withLookups: withLookupsSchema.optional(),
      track: z.any().optional(),
      actions: z.array(actionSchema).min(1).optional(),
      expectedToBeValid: z.boolean().optional(),
      expectedToBeTracked: z.boolean().optional(),
      expectedEvent: z.any().optional(),
      expectedDestinations: z.array(z.string()).optional(),
      expectedDestinationsByTag: z.record(z.string(), z.array(z.string())).optional(),
    })
    .strict()
    .superRefine((assertion, ctx) => {
      if (!Object.prototype.hasOwnProperty.call(assertion, "track") && !assertion.actions) {
        ctx.addIssue({ code: "custom", message: "Event assertion requires track or actions" });
      }
      if (
        ![
          "expectedToBeValid",
          "expectedToBeTracked",
          "expectedEvent",
          "expectedDestinations",
          "expectedDestinationsByTag",
        ].some((key) => key in assertion)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Event assertion requires at least one expectation",
        });
      }
    });

  const effectAssertionSchema = z
    .object({
      description: z.string().optional(),
      matrix: matrixSchema.optional(),
      withAttributes: withAttributesSchema.optional(),
      withLookups: withLookupsSchema.optional(),
      actions: z.array(actionSchema).min(1),
      expectedState: z.any().optional(),
      expectedToBeHandled: z.boolean().optional(),
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
    .strict()
    .refine(
      (assertion) =>
        ["expectedState", "expectedToBeHandled", "expectedToBeCalled"].some(
          (key) => key in assertion,
        ),
      {
        message: "Effect assertion requires at least one expectation",
      },
    );

  const destinationAssertionSchema = z
    .object({
      description: z.string().optional(),
      matrix: matrixSchema.optional(),
      withAttributes: withAttributesSchema.optional(),
      withLookups: withLookupsSchema.optional(),
      actions: z.array(actionSchema).min(1),
      assertAfter: z.number().int().min(0).optional(),
      expectedToBeTransported: z.boolean().optional(),
      expectedBody: z.any().optional(),
      expectedBodies: z.array(z.any()).optional(),
    })
    .strict()
    .superRefine((assertion, ctx) => {
      if (
        !["expectedToBeTransported", "expectedBody", "expectedBodies"].some(
          (key) => key in assertion,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Destination assertion requires at least one expectation",
        });
      }
      if ("expectedBody" in assertion && "expectedBodies" in assertion) {
        ctx.addIssue({ code: "custom", message: "Use expectedBody or expectedBodies, not both" });
      }
    });

  return z.union([
    z
      .object({
        promotable: z.boolean().optional(),
        attribute: z.string(),
        assertions: z.array(attributeAssertionSchema).min(1),
      })
      .strict(),
    z
      .object({
        promotable: z.boolean().optional(),
        event: z.string(),
        assertions: z.array(eventAssertionSchema).min(1),
      })
      .strict(),
    z
      .object({
        promotable: z.boolean().optional(),
        effect: z.string(),
        assertions: z.array(effectAssertionSchema).min(1),
      })
      .strict(),
    z
      .object({
        promotable: z.boolean().optional(),
        destination: z.string(),
        assertions: z.array(destinationAssertionSchema).min(1),
      })
      .strict(),
  ]);
}
