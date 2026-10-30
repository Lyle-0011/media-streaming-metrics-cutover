import { z } from "zod";
import { InfraiClient, infrai } from "./infrai.ts";

export const deliveryRequest = z.object({
  assetId: z.string().min(1),
  creatorId: z.string().min(1),
  bytes: z.number().int().positive(),
  processingSeconds: z.number().nonnegative(),
  delivered: z.boolean(),
});

export type DeliveryRequest = z.infer<typeof deliveryRequest>;

export function deliveryDecision(input: DeliveryRequest): "delivered" | "held" {
  return input.delivered && input.processingSeconds <= 120 ? "delivered" : "held";
}

export async function reportDelivery(client: InfraiClient, input: DeliveryRequest): Promise<string> {
  const request = deliveryRequest.parse(input);
  const decision = deliveryDecision(request);
  await infrai.metrics.report(client, {
    type: "counter",
    name: "media.creator_delivery",
    value: 1,
    tags: { asset_id: request.assetId, creator_id: request.creatorId, state: decision },
    idempotency_key: `delivery:${request.assetId}:${request.creatorId}`,
  });
  return decision;
}

export async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the example");
  const client = new InfraiClient(key);
  const input = { assetId: "asset-demo-01", creatorId: "creator-demo-01", bytes: 48000000, processingSeconds: 84, delivered: true };
  const state = await reportDelivery(client, input);
  const usage = await infrai.account.usage.timeseries(client, { period: "day" });
  console.log(JSON.stringify({ state, usage }, null, 2));
}

if (import.meta.main) await main();
