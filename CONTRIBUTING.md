# Contributing to Premium Kanban

Thanks for helping improve Premium Kanban. The project is currently a focused public alpha: a
high-quality Kanban view for Obsidian Bases with Markdown and frontmatter as the source of truth.

## Before opening a change

- Search existing issues before creating a new one.
- Open an issue before starting a large feature or architectural change.
- Keep proposals within the current plugin scope. Standalone applications, sync services,
  collaboration systems, proprietary task storage, and unrelated project-management features are
  out of scope.
- Never include private vault data, access tokens, private links, or identifying screenshots in an
  issue, fixture, test, or pull request.

## Development setup

Requirements:

- Node.js 20 or newer
- npm
- Obsidian 1.10.0 or newer with the Bases core plugin enabled

```bash
git clone https://github.com/VinayakRamavath/obsidian-premium-kanban-plugin.git
cd obsidian-premium-kanban-plugin
npm install
npm run dev:setup
npm run dev
```

Open `dev-vault/` in Obsidian and enable **Premium Kanban** under **Settings → Community
plugins**. The repository's README contains the complete vault and Bases setup.

## Project boundaries

Keep these layers separate:

1. `src/bases/` normalizes Bases results and view configuration.
2. `src/board/` owns grouping, ranks, drag state, and optimistic state.
3. `src/mutations/` performs serialized, property-specific Markdown mutations.
4. `src/ui/` renders and animates the React interface.

Use Obsidian's public API. Avoid undocumented internals unless the public API cannot provide an
essential capability and the limitation is documented.

## Data-safety requirements

Changes that write to a vault must:

- Update only the intended frontmatter property.
- Avoid rewriting stale full-file snapshots for property-only changes.
- Serialize competing writes to the same file.
- Roll back failed optimistic updates.
- Use Obsidian trash instead of permanent deletion.
- Preserve useful Markdown data when the plugin is disabled or uninstalled.

Add or update tests for mutation, rollback, reconciliation, and malformed input behavior whenever
those paths change.

## Validate your work

```bash
npm run format
npm run lint
npm test
npx playwright install chromium
npm run test:interaction
npm run build
```

Pull requests should explain the user-visible change, data-safety implications, tests performed,
and any remaining limitations. Include screenshots or a short recording for visual interaction
changes.

## Commit and pull-request scope

- Keep changes focused and avoid unrelated formatting churn.
- Do not commit `main.js`; production artifacts belong in GitHub releases.
- Do not commit generated load-test tasks or Obsidian workspace state.
- By contributing, you agree that your contribution is provided under this repository's MIT
  license.
