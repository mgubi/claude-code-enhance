#!/usr/bin/env node
/**
 * Restores the original Claude Code extension.js from the backup
 * created by patch_extension.js.
 */

const fs = require('fs');
const path = require('path');

function findExtensionDir() {
  const home = process.env.USERPROFILE || process.env.HOME;
  const extBase = path.join(home, '.vscode/extensions');

  if (!fs.existsSync(extBase)) {
    console.error('[Restore] VSCode extensions directory not found');
    process.exit(1);
  }

  const dirs = fs.readdirSync(extBase).filter(d => d.startsWith('anthropic.claude-code-'));
  if (dirs.length === 0) {
    console.error('[Restore] Claude Code extension not found');
    process.exit(1);
  }

  const latest = dirs.sort().pop();
  return path.join(extBase, latest);
}

const extDir = findExtensionDir();
const extensionJs = path.join(extDir, 'extension.js');
const backupJs = extensionJs + '.orig';

if (!fs.existsSync(backupJs)) {
  console.error('[Restore] No backup found at', backupJs);
  console.error('[Restore] Run patch_extension.js first to create a backup.');
  process.exit(1);
}

fs.copyFileSync(backupJs, extensionJs);
console.log('[Restore] extension.js restored from backup.');

const enhanceTarget = path.join(extDir, 'webview', 'enhance.js');
if (fs.existsSync(enhanceTarget)) {
  fs.unlinkSync(enhanceTarget);
  console.log('[Restore] Removed enhance.js from webview directory.');
}

console.log('[Restore] Please reload the VSCode window.');
