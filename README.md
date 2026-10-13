# Home Infrastructure

An Astro static site for architecture diagrams and notes about the home NUC, Proxmox, Home Assistant, and Hermes services.

## Development

This project requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

The development server is available at `http://localhost:4321`.

## Production build

```sh
npm run build
npm test
npm run preview
```

Astro writes the production site to `dist/`.

## Adding diagrams

Each diagram has two parts:

1. A self-contained HTML file under `public/diagrams/`.
2. A Markdown catalogue entry under `src/content/diagrams/`.

The Markdown frontmatter supplies the title, summary, date, display order,
tags, and path to the HTML diagram. The home-page catalogue and dynamic detail
route are generated from the collection automatically.

Markdown `##` and `###` headings become the per-page **On this page** table of
contents. Add or remove headings in the entry; no navigation markup needs to be
edited manually.

Use `src/content/diagrams/proxmox-hermes.md` as the reference entry.

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds and deploys the site whenever a commit is pushed to `master`. It also supports manual runs through `workflow_dispatch`.

Before the first deployment, create a GitHub repository, push this project, and set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

The Astro configuration derives the correct GitHub Pages base path from `GITHUB_REPOSITORY`, supporting both project sites and `<owner>.github.io` repositories.
