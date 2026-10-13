// @ts-check
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
});
