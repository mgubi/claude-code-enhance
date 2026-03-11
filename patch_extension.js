#!/usr/bin/env node
/**
 * Claude Code extension patch script v7
 * Compatible with version 2.1.31
 */

const fs = require('fs');
const path = require('path');

// Auto-detect the extension directory
function findExtensionDir() {
  const home = process.env.USERPROFILE || process.env.HOME;
  const extBase = path.join(home, '.vscode/extensions');

  if (!fs.existsSync(extBase)) {
    console.error('[Patch] VSCode extensions directory not found');
    process.exit(1);
  }

  const dirs = fs.readdirSync(extBase).filter(d => d.startsWith('anthropic.claude-code-'));
  if (dirs.length === 0) {
    console.error('[Patch] Claude Code extension not found');
    process.exit(1);
  }

  const latest = dirs.sort().pop();
  return path.join(extBase, latest);
}

const extDir = findExtensionDir();
const extensionJs = path.join(extDir, 'extension.js');
const enhanceJs = path.join(__dirname, 'webview', 'enhance.js');

console.log('[Patch] Extension dir:', extDir);
console.log('[Patch] Applying patch v7...');

// Copy enhance.js
const targetEnhance = path.join(extDir, 'webview', 'enhance.js');
fs.copyFileSync(enhanceJs, targetEnhance);
console.log('[Patch] Copied enhance.js');

// Read extension.js
let content = fs.readFileSync(extensionJs, 'utf8');
let modified = false;

// ========== Patch 1: add CDN to style-src ==========
if (!content.includes("style-src") || content.includes("style-src") && !content.match(/style-src[^`]*cdnjs/)) {
  const stylePattern = /(\w)=`style-src \$\{(\w)\.cspSource\} 'unsafe-inline'`/;
  const styleMatch = content.match(stylePattern);
  if (styleMatch) {
    const [full, varName, objName] = styleMatch;
    const replacement = `${varName}=\`style-src \${${objName}.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com\``;
    content = content.replace(full, replacement);
    modified = true;
    console.log('[Patch] Updated style-src CSP');
  }
} else {
  console.log('[Patch] style-src: already patched');
}

// ========== Patch 2: add CDN to script-src ==========
if (!content.match(/script-src 'nonce-\$\{[^}]+\}' https:\/\/cdnjs/)) {
  content = content.replace(
    /script-src 'nonce-\$\{(\w)\}'/g,
    "script-src 'nonce-${$1}' https://cdnjs.cloudflare.com"
  );
  modified = true;
  console.log('[Patch] Updated script-src CSP');
} else {
  console.log('[Patch] script-src: already patched');
}

// ========== Patch 3: add CDN + data: to font-src ==========
const fontPattern = /(\w)=`font-src \$\{(\w)\.cspSource\}`/;
const fontMatch = content.match(fontPattern);
if (fontMatch) {
  const [full, varName, objName] = fontMatch;
  const replacement = `${varName}=\`font-src \${${objName}.cspSource} https://cdnjs.cloudflare.com data:\``;
  content = content.replace(full, replacement);
  modified = true;
  console.log('[Patch] Updated font-src CSP');
} else {
  console.log('[Patch] font-src: already patched or not found');
}

// ========== Patch 4: inject enhance.js ==========
if (!content.includes('enhance.js')) {
  // Find the script tag pattern
  const scriptMatch = content.match(/nonce="\$\{(\w)\}" src="\$\{(\w)\}" type="module"><\/script>/);
  if (scriptMatch) {
    const [full, nonceVar, srcVar] = scriptMatch;
    const replacement = `nonce="\${${nonceVar}}" src="\${${srcVar}}" type="module"></script><script nonce="\${${nonceVar}}" src="\${z.asWebviewUri(F0.Uri.joinPath(this.extensionUri,"webview","enhance.js"))}"></script>`;
    content = content.replace(full, replacement);
    modified = true;
    console.log('[Patch] Injected enhance.js');
  }
} else {
  console.log('[Patch] enhance.js: already injected');
}

// Patch 5: fix diff view filling the whole window - open in the side panel
// Find the let v={preview:!1} pattern and add viewColumn:Beside
content = content.replace(
  /let v=\{preview:!1\}/g,
  'let v={preview:!1,viewColumn:tr.ViewColumn.Beside}'
);

// Also patch the alternative variable name N
content = content.replace(
  /let N=\{preview:!1,preserveFocus:!0\}/g,
  'let N={preview:!1,preserveFocus:!0,viewColumn:Gt.ViewColumn.Beside}'
);

// Write back to file
if (modified) {
  fs.writeFileSync(extensionJs, content, 'utf8');
  console.log('[Patch] Done! Please reload VSCode window.');
} else {
  console.log('[Patch] No changes made.');
}
