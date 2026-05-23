import { z } from "zod";

export const performanceEventTypes = [
  "web_vital",
  "navigation",
  "fetch",
  "client_error",
  "api",
  "repository",
  "db_phase",
  "mutation",
] as const;

export type PerformanceEventType = (typeof performanceEventTypes)[number];

const metadataValueSchema = z.union([z.string().max(160), z.number().finite(), z.boolean(), z.null()]);

export const performanceMetadataSchema = z
  .record(z.string().min(1).max(64), metadataValueSchema)
  .refine((value) => Object.keys(value).length <= 24, "metadata may contain at most 24 keys");

export const clientPerformanceEventSchema = z.object({
  event_type: z.enum(["web_vital", "navigation", "fetch", "client_error"]),
  name: z.string().min(1).max(160),
  route: z.string().min(1).max(240).optional(),
  method: z.string().min(1).max(12).optional(),
  status: z.number().int().min(100).max(599).optional(),
  duration_ms: z.number().finite().nonnegative().max(120_000).optional(),
  phase: z.string().min(1).max(80).optional(),
  metadata: performanceMetadataSchema.optional(),
});

export const clientPerformanceEventBatchSchema = z.object({
  events: z.array(clientPerformanceEventSchema).min(1).max(25),
});

export type ClientPerformanceEventInput = z.infer<typeof clientPerformanceEventSchema>;

export type PerformanceEventInput = {
  event_type: PerformanceEventType;
  name: string;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  duration_ms?: number | null;
  phase?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};
