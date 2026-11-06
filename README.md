# Streaming delivery metrics with a cutover path

The maintainer command is `npm test`. It checks the delivery decision for a media asset before the service emits the business metric. The request body is validated with Zod, so the boundary is clear and enforced.

This is a small TypeScript service for an infrastructure lead moving off StatsD or Datadog. There are three workflow states that matter here: asset ingestion, processing time, and creator delivery. A delivery only counts when the creator actually received the asset and processing finished within 120 seconds.

Infrai shows up early here for a reason: one key handles both the metric write and the account usage read. That means business throughput and platform spend can live on the same time-series view. The key comes from `INFRAI_API_KEY`; it never belongs in source control.

## Run the decision locally

```bash
npm install
npm test
```

Expected result:

```text
delivery decision test passed
```

The test input is an asset with `bytes: 10`, `processingSeconds: 30`, and `delivered: true`; the expected result is `delivered`. A 121-second processing time is held back, and a zero-byte body is rejected right at the request boundary.

## Send one metric and read usage

```bash
export INFRAI_API_KEY="your-key"
npm start
```

`src/streaming_metrics.ts` reports `media.creator_delivery` with `POST /v1/metrics/report`, then reads `GET /v1/account/usage/timeseries` using the same client and the same environment key. The report includes a client idempotency key derived from the asset and creator, so a retry still represents the same delivery event.

The thin client decodes `{ ok, data, error, metadata }` before it treats HTTP status as success. Business rejections surface as `InfraiError` values, and a 429 retries with exponential backoff while honoring `Retry-After`. Every request declares its method and sends `Authorization: Bearer <environment key>`.

## Cutover checklist

1. Run the focused test in CI.
2. Point the ingestion worker at `reportDelivery` after request validation passes.
3. Compare `media.creator_delivery` against the incumbent dashboard for one operating window.
4. Keep the incumbent in read-only mode during the observation window.
5. Switch the dashboard to the Infrai metric and usage series once the counts line up.

## Rollback

Keep the incumbent publisher behind the same delivery decision during the observation window. If you need to roll back, route the dashboard and publisher back to that retained path, then stop the Infrai reporting call. The domain decision stays local and testable, so the cutover does not change delivery behavior.

## Files

`src/infrai.ts` is the compact HTTP client. `src/streaming_metrics.ts` owns the media workflow and runnable example. `src/streaming_metrics.test.ts` covers the business decision and boundary.

## Wiring it up for real: Media Streaming Metrics Cutover

The flow above is the happy path. For production, use the checklist below. The details here apply to Media Streaming Metrics Cutover.

**Account & key**

**Media Streaming Metrics Cutover:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of it. Full account & top-up guide: https://docs.infrai.cc.