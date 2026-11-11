# Upload and Lighthouse recovery

## Durable receipts

CLI upload requests return immediately with a publication whose `jobId` is a
durable receipt. The publication ID and upload job ID are the same. Inspect
`GET /api/shopify/jobs` for selected-store progress, or
`GET /api/shopify/cli` for progress plus theme links and remote roles.
Lighthouse requests return the design with `lighthouse.jobId`.

The existing PostgreSQL database stores receipts, selected shop, source and
generated-content hashes, phases, exact creation name, pre-upload theme IDs,
created theme ID and assignment results. Credentials and generated file bodies
are not stored in jobs. Apply the additive schema with
`pnpm --filter @workspace/db push`; the post-merge setup runs this command too.

The frontend polls saved progress, survives navigation/reloads, and refreshes
publication and audit results when phases change. A reserved Shopify tab opens
after verification. If the tab/page was closed, the saved editor link remains.

## Idempotency and interruption

- A database unique key binds an upload to its shop, design, source file hash
  and destination/assignment choices. Concurrent requests and retries of
  unchanged content return that receipt, including after a failed attempt.
- A PostgreSQL session lock permits only one worker per receipt. Losing an HTTP
  connection does not cancel the worker. Process termination releases its lock.
- The full UUID theme name and pre-upload inventory are committed before
  `push --unpublished --nodelete`. Recovery can identify an unrecorded theme by
  its exact name only if it was not already in that inventory.
- Recovery uses a saved theme ID when available, including after merchant
  renaming or native Shopify activation. It never pushes files, activates or
  deletes themes, or repeats product updates.
- An uncertain attempt becomes **attention**, with its existing theme links.
  It is not falsely marked verified. No unique match means no automatic retry:
  review Shopify rather than risk creating a duplicate. Retrying that receipt
  performs read-only reconciliation again, allowing a delayed CLI creation to
  become visible.
- Interrupted assignment reads the saved product's current template suffix
  through the selected store's app; it does not reapply the suffix or SEO.
  A different selected store cannot supply that readback.
- Lighthouse interruption records a failed/attention attempt rather than
  leaving a permanent running indicator or inventing scores. An explicit audit
  rerun creates the next receipt. Results already committed before a restart
  remain intact.

Changing generated content or destination choices starts a different upload.
There is deliberately no “retry push” for an uncertain receipt. Merchant edits
must be preserved. Clearing local publication history does not remove durable
idempotency receipts or modify any Shopify theme.

## Local verification

`pnpm --filter @workspace/api-server test` includes synthetic Shopify transport
fixtures with isolated new unpublished themes. They exercise concurrent
requests, dropped create responses, delayed creation, restart checkpoints,
merchant renaming/edits, assignment reconciliation, deletion safeguards and
Lighthouse recovery. No test accesses or writes to a real Shopify store.
