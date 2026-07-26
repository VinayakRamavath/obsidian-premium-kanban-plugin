# Security Policy

Premium Kanban reads and modifies files inside an Obsidian vault. Please report vulnerabilities
privately so users have time to update before details are disclosed.

## Supported versions

While the project is pre-1.0, only the latest published release receives security fixes.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability.

Use
[GitHub private vulnerability reporting](https://github.com/VinayakRamavath/obsidian-premium-kanban-plugin/security/advisories/new)
and include:

- The affected plugin and Obsidian versions.
- The operating system.
- Reproduction steps using synthetic or redacted vault data.
- The potential impact on Markdown files, `.base` files, or the local system.
- Any suggested mitigation, if known.

Do not attach a private vault or real task notes. A minimal synthetic reproduction is preferred.

Reports will be acknowledged as soon as practical. Confirmed issues will be fixed and released
with coordinated disclosure after an update is available.

## Security boundaries

The plugin is designed to:

- Use Obsidian's public APIs.
- Mutate only the relevant task property during a card move.
- Serialize competing mutations for the same file.
- Roll back failed optimistic changes.
- Keep Markdown and frontmatter usable without the plugin.

Security reports about dependencies, unexpected network access, path handling, unsafe Markdown
mutation, or data loss are especially welcome.
