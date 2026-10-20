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

// --- Plate geometry helpers -------------------------------------------------
// The plates are hand-authored SVG, so these read the drawing the way a reader
// does: which box a connector actually leaves from, and which box it lands on.
// A claim like "the bridge reaches Hindsight itself" is only tested if moving
// the connector to another box would fail.

const numberAttr = (text, name) => {
  const match = text.match(new RegExp(`${name}="(-?[\\d.]+)"`));
  return match ? Number(match[1]) : null;
};

/** Name -> box, pairing each node rect with the node-name text drawn inside it. */
function nodeBoxes(svg) {
  const rects = [...svg.matchAll(/<rect class="(node[^"]*)"([^>]*)\/>/g)].map((match) => ({
    x: numberAttr(match[2], 'x'),
    y: numberAttr(match[2], 'y'),
    w: numberAttr(match[2], 'width'),
    h: numberAttr(match[2], 'height'),
  }));
  const names = [...svg.matchAll(/<text class="node-name[^"]*"([^>]*)>([^<]+)<\/text>/g)].map((match) => ({
    x: numberAttr(match[1], 'x'),
    y: numberAttr(match[1], 'y'),
    text: match[2].trim(),
  }));
  const boxes = new Map();
  for (const name of names) {
    const box = rects.find(
      (rect) => name.x >= rect.x && name.x <= rect.x + rect.w && name.y >= rect.y && name.y <= rect.y + rect.h,
    );
    if (box) boxes.set(name.text, box);
  }
  return boxes;
}

/** Walk M/H/V/Q/L so a connector's endpoints are read, not inferred from the string. */
function connectorEndpoints(d) {
  const tokens = d.match(/[MHVQL]|-?[\d.]+/g) ?? [];
  let index = 0;
  let command = null;
  let x = 0;
  let y = 0;
  let start = null;
  while (index < tokens.length) {
    if (/^[MHVQL]$/.test(tokens[index])) {
      command = tokens[index];
      index += 1;
      continue;
    }
    if (command === 'M') {
      x = Number(tokens[index]);
      y = Number(tokens[index + 1]);
      index += 2;
      if (!start) start = { x, y };
      command = 'L';
    } else if (command === 'L') {
      x = Number(tokens[index]);
      y = Number(tokens[index + 1]);
      index += 2;
    } else if (command === 'H') {
      x = Number(tokens[index]);
      index += 1;
    } else if (command === 'V') {
      y = Number(tokens[index]);
      index += 1;
    } else if (command === 'Q') {
      x = Number(tokens[index + 2]);
      y = Number(tokens[index + 3]);
      index += 4;
    } else {
      break;
    }
  }
  return { start, end: { x, y } };
}

function plateConnectors(svg) {
  return [...svg.matchAll(/<path class="(connector[^"]*)" d="([^"]+)"/g)].map((match) => ({
    className: match[1],
    d: match[2],
    ...connectorEndpoints(match[2]),
  }));
}

/** On the box's own boundary, allowing 1px of authoring slack. */
function onBoxEdge(point, box) {
  if (!point || !box) return false;
  const insideX = point.x >= box.x - 1 && point.x <= box.x + box.w + 1;
  const insideY = point.y >= box.y - 1 && point.y <= box.y + box.h + 1;
  const onSide =
    Math.abs(point.x - box.x) <= 1 ||
    Math.abs(point.x - (box.x + box.w)) <= 1 ||
    Math.abs(point.y - box.y) <= 1 ||
    Math.abs(point.y - (box.y + box.h)) <= 1;
  return insideX && insideY && onSide;
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
  assert.equal(nodeRects.length, 8);
  for (const rect of nodeRects) {
    assert.match(rect, /rx="8"/);
  }
});

test('the architecture separates ingress services from the Hermes agent runtime', async () => {
  const diagram = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  assert.match(diagram, />Hermes Agent Runtime</);
  assert.match(diagram, />model loop · tools · skills · memory</);
  assert.match(diagram, />Hermes Agent Gateway</);
  assert.match(diagram, />Wendell Phone Bridge</);
  assert.match(diagram, />RUNTIME</);
  assert.match(diagram, /<dt>Hermes gateway<\/dt><dd>WhatsApp · routing · sessions<\/dd>/);
  assert.match(diagram, />Home Assistant API call</);
  assert.match(diagram, />local and service connections</);
});

test('the architecture shows the local Hindsight service and PostgreSQL store', async () => {
  const diagram = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  assert.match(diagram, />Hindsight Memory</);
  assert.match(diagram, />local API\/MCP · port 8888</);
  assert.match(diagram, />PostgreSQL</);
  assert.match(diagram, />local database · port 5432</);
  assert.match(diagram, />MEMORY API</);
});

test('the architecture shows the bridge keeping its own caller-scoped memory path', async () => {
  const diagram = await readBuiltPage('diagrams/proxmox-hermes-architecture.html');

  // The caller-memory connector must leave the Wendell Phone Bridge box and land
  // on Hindsight. Re-pointing it at the Agent Runtime would fail this, which is
  // the whole claim: the bridge does not borrow the runtime's memory.
  const boxes = nodeBoxes(diagram);
  const bridge = boxes.get('Wendell Phone Bridge');
  const hindsight = boxes.get('Hindsight Memory');
  assert.ok(bridge, 'the plate must draw a Wendell Phone Bridge box');
  assert.ok(hindsight, 'the plate must draw a Hindsight Memory box');

  const fromBridge = plateConnectors(diagram).filter(
    (connector) => onBoxEdge(connector.start, bridge) && onBoxEdge(connector.end, hindsight),
  );
  assert.equal(fromBridge.length, 1, 'exactly one connector must run from the bridge to Hindsight');

  // The runtime keeps its own, separate connector to the same service.
  const runtime = boxes.get('Hermes Agent Runtime');
  const fromRuntime = plateConnectors(diagram).filter(
    (connector) => onBoxEdge(connector.start, runtime) && onBoxEdge(connector.end, hindsight),
  );
  assert.equal(fromRuntime.length, 1, 'the runtime keeps its own separate memory connector');
  assert.notEqual(fromBridge[0].d, fromRuntime[0].d);

  assert.match(diagram, />CALLER MEMORY</);
  assert.match(diagram, /caller-scoped banks · consent before save/);
  assert.match(diagram, />hermes \+ caller</);
  assert.match(diagram, />Hindsight · caller banks · PostgreSQL</);
  assert.match(diagram, />Wendell Phone Bridge<\/strong><span>→<\/span><strong>Hindsight Memory<\/strong>/);
  assert.match(diagram, /runtime and caller memory handoff/);
});

test('the data-flow plate leaves the bridge for a scoped Hindsight bank, not the profile', async () => {
  const diagram = await readBuiltPage('diagrams/wendell-data-flow.html');

  const boxes = nodeBoxes(diagram);
  const bridge = boxes.get('Wendell Phone Bridge');
  const memory = boxes.get('Hindsight Caller Memory');
  const profile = boxes.get('Hermes · wendell profile');
  assert.ok(bridge && memory && profile, 'the plate must draw the bridge, the memory node and the profile');

  const fromBridge = plateConnectors(diagram).filter(
    (connector) => onBoxEdge(connector.start, bridge) && onBoxEdge(connector.end, memory),
  );
  assert.equal(fromBridge.length, 1, 'exactly one connector must run from the bridge to caller memory');

  const fromProfile = plateConnectors(diagram).filter(
    (connector) => onBoxEdge(connector.start, profile) && onBoxEdge(connector.end, memory),
  );
  assert.equal(fromProfile.length, 0, 'caller memory must not hang off the memory-disabled profile');

  assert.match(diagram, />Hindsight Caller Memory</);
  assert.match(diagram, />one bank per trusted From · consent gate</);
  assert.match(diagram, />CALLER MEMORY</);
  assert.match(diagram, />local service call</);
  assert.match(diagram, /API toolsets disabled · memory off/);
});

test('the call sequence loads the caller bank once the caller is identified', async () => {
  const diagram = await readBuiltPage('diagrams/wendell-call-sequence.html');

  assert.match(diagram, />ALLOWLIST ✓</);
  assert.match(diagram, />BANK</);
  assert.match(diagram, /loads that caller's own memory bank/);
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
