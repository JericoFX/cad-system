import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(process.cwd(), 'source');
const registryPath = path.join(sourceRoot, 'components/modals/modalRegistry.tsx');

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      out.push(fullPath);
    }
  }
  return out;
}

function collectMatches(text, regex) {
  const out = new Set();
  let match = regex.exec(text);
  while (match) {
    out.add(match[1]);
    match = regex.exec(text);
  }
  return out;
}

if (!fs.existsSync(registryPath)) {
  console.error(`[modal-check] Missing registry file: ${registryPath}`);
  process.exit(1);
}

const files = listFiles(sourceRoot);
const openedModals = new Set();
const declaredModalTargets = new Set();

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const localOpenCalls = collectMatches(content, /setActiveModal\('([A-Z_]+)'/g);
  for (const value of localOpenCalls) {
    openedModals.add(value);
  }

  const localDeclaredTargets = collectMatches(content, /modal:\s*'([A-Z_]+)'/g);
  for (const value of localDeclaredTargets) {
    declaredModalTargets.add(value);
  }
}

const registryContent = fs.readFileSync(registryPath, 'utf8');
const registryModals = collectMatches(registryContent, /^\s{2}([A-Z_]+):\s*\{/gm);

const knownModalUsage = new Set([...openedModals, ...declaredModalTargets]);

const openedNotRegistered = [...knownModalUsage].filter((item) => !registryModals.has(item)).sort();
const registeredNotOpened = [...registryModals].filter((item) => !knownModalUsage.has(item)).sort();

if (openedNotRegistered.length > 0) {
  console.error('[modal-check] Found opened modals missing in registry:');
  for (const id of openedNotRegistered) {
    console.error(`  - ${id}`);
  }
  process.exit(1);
}

if (registeredNotOpened.length > 0) {
  console.warn('[modal-check] Registry modals without direct setActiveModal usage (review):');
  for (const id of registeredNotOpened) {
    console.warn(`  - ${id}`);
  }
}

console.log('[modal-check] OK: opened modals are registered');
