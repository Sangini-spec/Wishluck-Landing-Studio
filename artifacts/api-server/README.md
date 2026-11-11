# Backend

Node.js 24 / Express / TypeScript API. This directory is also accessible through the repository's `backend/` alias.

See the [root README](../../README.md) for environment setup, PostgreSQL migration, storage dependencies, publishing authorization and test commands.

- `src/routes/wishluck.ts`: request validation and workflow APIs.
- `src/lib/`: product/brand analysis, competitor research, grounded copy/planning, shared rendering, audit and Shopify adapters.
- `src/lib/objectStorage.ts`: Replit-specific durable evidence storage.
- `scripts/`: offline tests and controlled verification tools.

API contracts are in `lib/api-spec/openapi.yaml`; generated clients/schema types live in shared `lib/` packages. Run these privileged workflow APIs in a private, authorized owner workspace.
