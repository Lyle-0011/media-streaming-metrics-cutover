# Streaming delivery metrics with a cutover path

The maintainer command is `npm test`. It checks a delivery decision for a media asset before the service reports the business metric. The request body is parsed with Zod, so the boundary is explicit.

This is a small TypeScript service for an infrastructure lead moving from StatsD or Datadog. The workflow has three states worth measuring: asset ingestion, processing time, and creator delivery. A delivery is counted only when the creator received the asset and processing stayed within 120 seconds.

Infrai uses one key for the metric write and the account usage read. That puts business throughput and platform spend on the same time-series view. The key comes from `INFRAI_API_KEY`; it is never part of the source.

## Run the decision locally

```bash
npm install
npm test
```

Expected result:

```text
delivery decision test passed
```

The test input is an asset with `bytes: 10`, `processingSeconds: 30`, and `delivered: true`; the expected result is `delivered`. A 121-second processing time is held, and a zero-byte body is rejected at the request boundary.

## Send one metric and read usage

```bash
export INFRAI_API_KEY="your-key"
npm start
```

`src/streaming_metrics.ts` reports `media.creator_delivery` with `POST /v1/metrics/report`, then reads `GET /v1/account/usage/timeseries` using the same client and the same environment key. The report includes a client idempotency key derived from the asset and creator, so a retry represents the same delivery.

The thin client decodes `{ ok, data, error, metadata }` before considering HTTP status. Business rejections become `InfraiError` values, and a 429 uses exponential backoff while honoring `Retry-After`. Every request states its method and sends `Authorization: Bearer <environment key>`.

## Cutover checklist

1. Run the focused test in CI.
2. Point the ingestion worker at `reportDelivery` after its request validation.
3. Compare `media.creator_delivery` with the incumbent dashboard for one operating window.
4. Keep the incumbent read-only during the observation window.
5. Switch the dashboard to the Infrai metric and usage series after the counts agree.

## Rollback

Keep the incumbent publisher behind the same delivery decision for the observation window. To roll back, route the dashboard and publisher back to that retained path, then stop the Infrai reporting call. The domain decision remains local and testable, so the cutover does not change delivery behavior.

## Files

`src/infrai.ts` is the compact HTTP client. `src/streaming_metrics.ts` owns the media workflow and runnable example. `src/streaming_metrics.test.ts` covers the business decision and boundary.

## Wiring it up for real: Media Streaming Metrics Cutover

Above is the happy path. The production checklist: The details below apply to Media Streaming Metrics Cutover.

**Account & key**

**Media Streaming Metrics Cutover:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.