import { z } from "zod";
import { CATEGORIES, OWNERS, OWNER_BY_CATEGORY, PRIORITIES } from "./taxonomy";

const CategorySchema = z.enum(CATEGORIES);
const PrioritySchema = z.enum(PRIORITIES);
const OwnerSchema = z.enum(OWNERS);

export const MAX_EVIDENCE_ITEMS = 5;
export const MAX_QUOTE_CHARS = 200;
// Character safety bound only; the 150-word limit is enforced by the prompt/pipeline.
export const MAX_DRAFT_CHARS = 1200;

const text = (max: number) => z.string().min(1).max(max);

export const EvidenceSchema = z.strictObject({
  for: z.enum(["priority", "dataExposure", "criticalOutage"]),
  quote: z.string().min(1).max(MAX_QUOTE_CHARS),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** Same shape as Evidence, but only produced after the quote was found verbatim in the request. */
export const VerifiedEvidenceSchema = EvidenceSchema;
export type VerifiedEvidence = z.infer<typeof VerifiedEvidenceSchema>;

/**
 * Validated but untrusted model proposal. Property order is the generation
 * order sent to the model: reasoning fields come before the verdict.
 */
export const ModelAnalysisSchema = z
  .strictObject({
    summary: text(300),
    flags: z.strictObject({
      dataExposure: z.boolean(),
      criticalOutage: z.boolean(),
    }),
    evidence: z.array(EvidenceSchema).max(MAX_EVIDENCE_ITEMS),
    category: CategorySchema,
    priority: PrioritySchema,
    priorityReason: text(250),
    needsReview: z.boolean(),
    reviewReason: text(250).nullable(),
    draftResponse: text(MAX_DRAFT_CHARS),
  });
export type ModelAnalysis = z.infer<typeof ModelAnalysisSchema>;

/** A policy override. Only these three fields can ever be adjusted. */
export const AdjustmentSchema = z.discriminatedUnion("field", [
  z.strictObject({
    field: z.literal("category"),
    from: CategorySchema,
    to: CategorySchema,
    reason: text(250),
  }),
  z.strictObject({
    field: z.literal("priority"),
    from: PrioritySchema,
    to: PrioritySchema,
    reason: text(250),
  }),
  z.strictObject({
    field: z.literal("needsReview"),
    from: z.boolean(),
    to: z.boolean(),
    reason: text(250),
  }),
]);
export type Adjustment = z.infer<typeof AdjustmentSchema>;

/** Trusted final output after deterministic policy. Raw model flags are not carried over. */
export const TriageResultSchema = z
  .strictObject({
    summary: text(300),
    category: CategorySchema,
    priority: PrioritySchema,
    priorityReason: text(250),
    owner: OwnerSchema,
    needsReview: z.boolean(),
    reviewReason: text(250).nullable(),
    evidence: z.array(VerifiedEvidenceSchema).max(MAX_EVIDENCE_ITEMS),
    draftResponse: text(MAX_DRAFT_CHARS),
    adjustments: z.array(AdjustmentSchema),
    /** Human-readable escalation note (e.g. data exposure), or null. */
    escalation: text(500).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.owner !== OWNER_BY_CATEGORY[value.category]) {
      ctx.addIssue({
        code: "custom",
        path: ["owner"],
        message: `owner must be ${OWNER_BY_CATEGORY[value.category]} for category ${value.category}`,
      });
    }
  });
export type TriageResult = z.infer<typeof TriageResultSchema>;
