# sciget.org

Source for the [sciget.org](https://sciget.org) website. Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

## Local development

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # production build → dist/
pnpm preview      # serve the production build locally
```

## Project structure

```
.
├── astro.config.mjs        # Starlight config: sidebar, integrations, site URL
├── public/                 # Static assets served as-is (favicons, docs images, videos)
├── src/
│   ├── assets/             # Images processed by Astro's image pipeline
│   ├── content/
│   │   └── docs/           # Markdown / MDX content (each file is a route)
│   ├── content.config.ts   # Starlight content collection schema
│   └── styles/
│       └── custom.css      # Project-specific styles (loaded via Starlight customCss)
```

## Content

- **Landing**: `src/content/docs/index.mdx` (uses `template: splash`).
- **Docs pages**: any `.md` / `.mdx` file under `src/content/docs/` is a route.
- **Components demo**: `src/content/docs/components-demo.mdx` — reference for all built-in Starlight components.

## Deployment

The site deploys to **Cloudflare Pages** from `main`. Build settings:

- Framework preset: **Astro**
- Build command: `pnpm build`
- Build output directory: `dist`
- `NODE_VERSION=22`
