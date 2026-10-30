import assert from "node:assert/strict";
import { deliveryDecision, deliveryRequest } from "./streaming_metrics.ts";

const delivered = { assetId: "asset-1", creatorId: "creator-1", bytes: 10, processingSeconds: 30, delivered: true };
const held = { ...delivered, processingSeconds: 121 };

assert.equal(deliveryDecision(deliveryRequest.parse(delivered)), "delivered");
assert.equal(deliveryDecision(deliveryRequest.parse(held)), "held");
assert.throws(() => deliveryRequest.parse({ ...delivered, bytes: 0 }));
console.log("delivery decision test passed");
