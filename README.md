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
npm run preview
```

Astro writes the production site to `dist/`.

## Diagram source

The current self-contained architecture diagram is stored at:

```text
public/diagrams/proxmox-hermes-architecture.html
```

The home page embeds that file and also provides a direct link to it.

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds and deploys the site whenever a commit is pushed to `master`. It also supports manual runs through `workflow_dispatch`.

Before the first deployment, create a GitHub repository, push this project, and set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

The Astro configuration derives the correct GitHub Pages base path from `GITHUB_REPOSITORY`, supporting both project sites and `<owner>.github.io` repositories.
