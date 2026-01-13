# Repository Guidelines

## Project Structure & Module Organization
- `src/background/`: Extension background scripts (timers, storage, messaging).
- `src/content/` and `src/page-scripts/`: In-page bridges/interceptors.
- `src/ui/`: React UI for the popup and dashboard (`src/ui/popup`, `src/ui/dashboard`).
- `src/shared/`: Reusable types, utils, and constants.
- `e2e/`: Playwright end-to-end tests. `src/**/__tests__`: unit/integration tests.
- `dist/`: Production build output (load as unpacked extension). `public/`: static assets.
- `scripts/`: Local helpers (verification and release checks).

## Build, Test, and Development Commands
- `pnpm dev`: Start Vite dev server for rapid UI iteration.
- `pnpm build`: Type-check and build extension (outputs to `dist/`).
- `pnpm preview`: Preview built assets locally.
- `pnpm typecheck`: Run TypeScript project references build (no emit).
- `pnpm test`: Run unit tests with Vitest. `pnpm test:coverage` for coverage.
- `pnpm test:e2e`: Run Playwright E2E. Use `:headed`, `:ui`, or `:debug` to iterate.
- `pnpm verify`: Validate the built extension (scripts/verify-extension.js).

## Coding Style & Naming Conventions
- Language: TypeScript + React. Prefer function components and hooks.
- Indentation: Match surrounding file (tabs appear in some UI files; 2 spaces common elsewhere). Avoid large reformat-only diffs.
- Filenames: Components `PascalCase.tsx` (e.g., `DashboardTable.tsx`); utilities/types `camelCase.ts` (e.g., `dateUtils.ts`).
- Imports: Use path aliases (e.g., `@/shared/...`). Prefer named exports where reasonable.
- Linting: ESLint packages exist but the `lint` script is placeholder. Rely on `typecheck` and tests until linting is finalized.

## Testing Guidelines
- Unit: Vitest + Testing Library. Place near source in `__tests__` with `*.test.ts(x)`.
- E2E: Playwright specs in `e2e/*.spec.js`. Artifacts in `test-results/` and `playwright-report/`.
- Minimum: Add coverage for new logic and UI states. Run `pnpm test:ci` before PRs.

## Commit & Pull Request Guidelines
- Commits: Use conventional prefixes (`feat:`, `fix:`, `refactor:`, `test:`). Scope narrowly and write imperative subjects.
- PRs: Include description, linked issues, repro steps, and screenshots/GIFs for UI changes. Note any manifest or background changes. Ensure `pnpm build && pnpm test:ci` pass.

## Security & Configuration Tips
- Do not commit secrets. Configuration lives in `manifest.config.ts`; verify with `pnpm verify` and `pnpm validate:pre-deployment`.
- Ship only `dist/`. Load the extension by selecting `dist/` as an unpacked extension in Chrome.

