import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dist = new URL('../dist/', import.meta.url);

async function readBuiltPage(path) {
  return readFile(new URL(path, dist), 'utf8');
}

test('the home page catalogue is generated from diagram content', async () => {
  const html = await readBuiltPage('index.html');

  assert.match(html, /NUC automation and agent architecture/);
  assert.match(html, /class="catalogue-list"/);
  assert.match(html, /href="(?:\/[^\/"]+)?\/diagrams\/proxmox-hermes\/"/);
  assert.match(html, /Proxmox/);
  assert.match(html, /Home Assistant/);
  assert.match(html, /Hermes/);
});

test('a diagram detail page includes its embedded diagram and heading TOC', async () => {
  const html = await readBuiltPage('diagrams/proxmox-hermes/index.html');

  assert.match(html, /aria-label="On this page"/);
  assert.match(html, /class="toc-list"/);
  assert.match(html, /href="#overview"/);
  assert.match(html, /href="#routes"/);
  assert.match(html, /href="#deployment-notes"/);
  assert.match(html, /src="(?:\/[^\/"]+)?\/diagrams\/proxmox-hermes-architecture\.html"/);
});
