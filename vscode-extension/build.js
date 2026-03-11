'use strict';
/**
 * Packages the extension into a .vsix.
 * Stages parent-directory files into dist/, rewrites __dirname-relative paths,
 * runs vsce package, then cleans up dist/.
 *
 * Usage: node build.js  (from vscode-extension/)
 */
const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(__dirname, 'dist');

// 1. Create staging dirs
fs.mkdirSync(path.join(DIST, 'webview'), { recursive: true });

// 2. Copy parent scripts into dist/
for (const [src, dst] of [
  ['patch_extension.js',   'patch_extension.js'],
  ['restore_extension.js', 'restore_extension.js'],
  ['webview/enhance.js',   'webview/enhance.js'],
]) {
  fs.copyFileSync(path.join(ROOT, src), path.join(DIST, dst));
  console.log(`Copied ${src}`);
}

// 3. Copy and rewrite extension.js — fix '../' path references for flat dist layout
let ext = fs.readFileSync(path.join(__dirname, 'extension.js'), 'utf8');
ext = ext.replace(
  "path.join(__dirname, '..', 'patch_extension.js')",
  "path.join(__dirname, 'patch_extension.js')"
);
ext = ext.replace(
  "path.join(__dirname, '..', 'restore_extension.js')",
  "path.join(__dirname, 'restore_extension.js')"
);
fs.writeFileSync(path.join(DIST, 'extension.js'), ext);

// 4. Copy package.json, README, and icon (main stays './extension.js')
fs.copyFileSync(path.join(__dirname, 'package.json'), path.join(DIST, 'package.json'));
fs.copyFileSync(path.join(__dirname, 'README.md'),    path.join(DIST, 'README.md'));
fs.copyFileSync(path.join(__dirname, 'icon.png'),         path.join(DIST, 'icon.png'));
fs.copyFileSync(path.join(__dirname, 'icon-patched.png'), path.join(DIST, 'icon-patched.png'));

// 5. Run vsce package from dist/
const vsce = path.join(__dirname, 'node_modules', '.bin', 'vsce');
execFileSync(vsce, ['package', '--out', __dirname, '--allow-missing-repository'],
  { cwd: DIST, stdio: 'inherit' });

// 6. Clean up staging dir
fs.rmSync(DIST, { recursive: true, force: true });
console.log('Done. .vsix is in', __dirname);
