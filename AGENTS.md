## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

> Agent note: in an AI-agent environment Astro auto-runs `dev` in the background and
> gives up if it is not ready within 30s. A cold start (Vite re-optimizing deps)
> can exceed that. If it reports "failed to start within 30s", run it in the
> foreground instead: `ASTRO_DEV_BACKGROUND=1 astro dev --host 127.0.0.1`.

### Testing on a phone / LAN (WSL2)

`npm run dev:lan` binds all interfaces. WSL2 is NAT'd, so a phone can't reach the
WSL IP directly; run the forwarder once from an **elevated** PowerShell on Windows:

```
powershell -ExecutionPolicy Bypass -File C:\Users\<you>\sidequest-lan.ps1 -WslIp <wsl-ip>
```

(`scripts/lan-forward.ps1` in the repo; find the WSL IP with `hostname -I`.)
Then open `http://<windows-lan-ip>:4321/` on the phone. The WSL IP changes on
reboot, so re-run it. Alternative: `[wsl2] networkingMode=mirrored` in
`%UserProfile%\.wslconfig` + `wsl --shutdown`.

## Database (local testing)

The dev database is a single SQLite file (default `data/sidequest.db`, WAL mode).
**Never `rm` it while the dev server is running** — the server keeps the file open,
so it keeps writing to the unlinked inode and the DB silently diverges. Use the
helper instead:

- `npm run db:stats` — row counts + uploaded-media size
- `npm run db:reset` — clear all rows **and** uploads (safe while the server runs)
- `npm run db:clear-uploads` — delete uploaded media only
- `npm run db:reset:hard` — delete the DB file + WAL/SHM and re-apply migrations
  (stop the dev server first)

`npm run db:reset` preserves the schema and the `_prisma_migrations` history. On
NixOS the Prisma CLI needs `PRISMA_SCHEMA_ENGINE_BINARY`, which the dev shell
provides via its `shellHook`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
