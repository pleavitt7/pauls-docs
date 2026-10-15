// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isGitHubPagesRoot = repository === `${owner}.github.io`;

// GitHub project pages are served from /<repository>/, while local development
// and <owner>.github.io repositories are served from the domain root.
const base = process.env.GITHUB_ACTIONS && repository && !isGitHubPagesRoot
  ? `/${repository}`
  : '/';

export default defineConfig({
  site: owner ? `https://${owner}.github.io` : 'http://localhost:4321',
  base,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: "Paul's docs",
      description: 'Architecture diagrams and operational notes for the home NUC.',
      customCss: ['./src/styles/starlight.css'],
      disable404Route: true,
      editLink: {
        baseUrl: 'https://github.com/pleavitt7/pauls-docs/edit/master/',
      },
      lastUpdated: true,
      sidebar: [
        { label: 'Home', link: '/' },
        { autogenerate: { directory: 'diagrams' } },
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/pleavitt7/pauls-docs',
        },
      ],
    }),
  ],
});
