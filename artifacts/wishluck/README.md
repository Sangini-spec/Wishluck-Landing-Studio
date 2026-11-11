# Frontend

React / Vite / TypeScript dashboard. This directory is also accessible through the repository's `frontend/` alias.

See the [root README](../../README.md) for setup and evidence. The dashboard performs input/review, research, generation/viewport previews, feedback, publishing progress and accurate uploaded/live history.

The development server requires `PORT` and `BASE_PATH`; its `/api` proxy targets the local backend or `API_PROXY_TARGET`. Runtime browser requests stay same-origin. Real credentials never belong in a `VITE_*` variable or browser bundle.

`pnpm --filter @workspace/wishluck test` runs isolated component/workflow tests without Shopify writes.
