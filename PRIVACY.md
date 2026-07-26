# Privacy

Premium Kanban is local-first and does not operate a service.

## Data the plugin accesses

The plugin receives records selected by an Obsidian Base and reads the corresponding local
Markdown metadata needed to render cards. Current write operations are limited to:

- The grouped task property, currently `Status`, when a card moves.
- New Markdown task files created through Obsidian's file APIs.
- Per-view Kanban configuration such as column order and column colors in the corresponding
  `.base` file.

## Network and telemetry

Premium Kanban currently:

- Sends no telemetry or analytics.
- Creates no user account.
- Runs no cloud service.
- Makes no plugin-initiated network requests.
- Does not upload vault content.

The plugin bundles its runtime dependencies into `main.js`; they are not loaded from a CDN.

Obsidian Sync, Git, third-party plugins, and links opened by the user are outside Premium Kanban's
control and have their own privacy behavior.

## Retention and removal

The plugin has no remote data store. Task data remains in Markdown and `.base` files in the vault.
Disabling or uninstalling Premium Kanban does not require migration or export.

Privacy behavior will be documented here before any future feature introduces network access,
telemetry, or an external service.
