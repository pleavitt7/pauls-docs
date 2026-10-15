import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const project = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, project), 'utf8');
}

async function readBuiltPage(path) {
  return readFile(new URL(path, dist), 'utf8');
}

test('the Astro project is configured with Starlight', async () => {
  const config = await readProjectFile('astro.config.mjs');
  const packageJson = JSON.parse(await readProjectFile('package.json'));

  assert.match(config, /from ['"]@astrojs\/starlight['"]/);
  assert.match(config, /starlight\(\{/);
  assert.equal(typeof packageJson.dependencies['@astrojs/starlight'], 'string');
});

test('the Starlight home page lists diagram documentation', async () => {
  const html = await readBuiltPage('index.html');

  assert.match(html, /Paul's docs|Paul&#39;s docs/);
  assert.match(html, /Architecture diagrams and operational notes/);
  assert.match(html, /class="sl-markdown-content"/);
  assert.match(html, /href="(?:\/[^\/"]+)?\/diagrams\/proxmox-hermes\/"/);
  assert.match(html, /NUC automation and agent architecture/);
});

test('the Starlight diagram page includes its diagram and generated table of contents', async () => {
  const html = await readBuiltPage('diagrams/proxmox-hermes/index.html');

  assert.match(html, /class="sl-markdown-content"/);
  assert.match(html, /id="starlight__on-this-page"[^>]*>On this page</);
  assert.match(html, /href="#system-overview"/);
  assert.match(html, /href="#routes"/);
  assert.match(html, /href="#deployment-notes"/);
  assert.match(html, /src="(?:\/[^\/"]+)?\/diagrams\/proxmox-hermes-architecture\.html\?embed=1"/);
  assert.match(html, /href="https:\/\/github\.com\/pleavitt7\/pauls-docs\/edit\/master\/src\/content\/docs\/diagrams\/proxmox-hermes\.mdx"/);
  assert.doesNotMatch(html, /src\/content\/docs\/src\/content\/docs/);
});

test('the embedded diagram follows the Starlight light and dark theme', async () => {
  const page = await readBuiltPage('diagrams/proxmox-hermes/index.html');
  const diagram = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  assert.match(page, /data-diagram-frame/);
  assert.match(page, /MutationObserver/);
  assert.match(page, /diagram-theme/);
  assert.match(diagram, /\[data-theme="dark"\]/);
  assert.match(diagram, /diagram-theme/);
});

test('the embedded diagram inherits the Starlight font families', async () => {
  const page = await readBuiltPage('diagrams/proxmox-hermes/index.html');
  const diagram = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  assert.match(page, /--sl-font/);
  assert.match(page, /fonts: readTokens/);
  assert.match(diagram, /dataset\.theme = event\.data\.theme/);
  assert.match(diagram, /--sans: var\(--sl-font,/);
  assert.match(diagram, /--mono: var\(--sl-font-mono,/);
  assert.doesNotMatch(diagram, /InterVariable/);
  assert.doesNotMatch(diagram, /font-family: Georgia/);
  assert.doesNotMatch(diagram, /font-family: var\(--serif\)/);
});

test('the diagram rounds service boxes and has no decorative edge rails', async () => {
  const diagram = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  assert.doesNotMatch(diagram, /node-stripe/);
  assert.doesNotMatch(diagram, /width="5" height="\d+"\/>/);

  const nodeRects = diagram.match(/<rect class="node(-primary|-network)?"[^>]*>/g) ?? [];
  assert.equal(nodeRects.length, 5);
  for (const rect of nodeRects) {
    assert.match(rect, /rx="8"/);
  }
});

test('the standalone diagram scales to its container instead of clipping', async () => {
  const diagram = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  assert.doesNotMatch(diagram, /min-width: 1280px/);
  assert.match(diagram, /\.diagram-scroll svg \{[\s\S]*?min-width: 880px;[\s\S]*?height: auto;/);
});

test('the embedded diagram removes nested scrolling on desktop', async () => {
  const html = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  assert.match(html, /\.embedded \.masthead/);
  assert.match(html, /\.embedded \.diagram-scroll/);
  assert.match(html, /searchParams\.has\(['"]embed['"]\)/);
});
