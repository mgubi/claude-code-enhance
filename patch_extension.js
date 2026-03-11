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

// Backup original extension.js (only on first run — never overwrite an existing backup)
const backupJs = extensionJs + '.orig';
if (!fs.existsSync(backupJs)) {
  fs.copyFileSync(extensionJs, backupJs);
  console.log('[Patch] Backup saved to extension.js.orig');
} else {
  console.log('[Patch] Backup already exists, skipping');
}

// Copy enhance.js — only if content changed (triggers reload when a newer version is shipped)
const targetEnhance = path.join(extDir, 'webview', 'enhance.js');
let modified = false;
const newEnhance = fs.readFileSync(enhanceJs);
const oldEnhance = fs.existsSync(targetEnhance) ? fs.readFileSync(targetEnhance) : null;
if (!oldEnhance || !oldEnhance.equals(newEnhance)) {
  fs.copyFileSync(enhanceJs, targetEnhance);
  modified = true;
  console.log('[Patch] Copied enhance.js (updated)');
} else {
  console.log('[Patch] enhance.js: up to date');
}

// Read extension.js
let content = fs.readFileSync(extensionJs, 'utf8');

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
  const before2 = content;
  content = content.replace(
    /script-src 'nonce-\$\{(\w)\}'/g,
    "script-src 'nonce-${$1}' https://cdnjs.cloudflare.com"
  );
  if (content !== before2) {
    modified = true;
    console.log('[Patch] Updated script-src CSP');
  } else {
    console.log('[Patch] script-src: pattern not found, skipping');
  }
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
// Detect the vscode module variable name dynamically (it changes between extension versions)
const vscodeVarMatch = content.match(/localResourceRoots:\[(\w+)\.Uri\.joinPath\(this\.extensionUri/);
const vscodeVar = vscodeVarMatch ? vscodeVarMatch[1] : null;
if (!vscodeVar) {
  console.error('[Patch] Could not detect vscode variable name — skipping enhance.js injection');
} else {
  console.log('[Patch] Detected vscode variable:', vscodeVar);
  // Detect the webview object variable dynamically (used to call asWebviewUri)
  const webviewVarMatch = content.match(/(\w+)\.asWebviewUri\(/);
  const webviewVar = webviewVarMatch ? webviewVarMatch[1] : null;
  if (!webviewVar) {
    console.error('[Patch] Could not detect webview variable name — skipping enhance.js injection');
  } else {
  console.log('[Patch] Detected webview variable:', webviewVar);
  // Build the correct inject snippet
  const scriptMatch = content.match(/nonce="\$\{(\w+)\}" src="\$\{(\w+)\}" type="module"><\/script>/);
  if (!scriptMatch) {
    console.error('[Patch] Could not find script tag pattern — skipping enhance.js injection');
  } else {
  const [full, nonceVar, srcVar] = scriptMatch;
    const injectSnippet = `<script nonce="\${${nonceVar}}" src="\${${webviewVar}.asWebviewUri(${vscodeVar}.Uri.joinPath(this.extensionUri,"webview","enhance.js"))}"></script>`;
    const correctFull = `nonce="\${${nonceVar}}" src="\${${srcVar}}" type="module"></script>${injectSnippet}`;

    if (!content.includes('enhance.js')) {
      // Fresh injection
      content = content.replace(full, correctFull);
      modified = true;
      console.log('[Patch] Injected enhance.js');
    } else if (!content.includes(`${vscodeVar}.Uri.joinPath(this.extensionUri,"webview","enhance.js")`)) {
      // Already injected but with a stale variable name — replace it
      content = content.replace(/\w+\.Uri\.joinPath\(this\.extensionUri,"webview","enhance\.js"\)/, `${vscodeVar}.Uri.joinPath(this.extensionUri,"webview","enhance.js")`);
      modified = true;
      console.log('[Patch] Updated enhance.js injection (stale vscode variable replaced with', vscodeVar + ')');
    } else {
      console.log('[Patch] enhance.js: already injected with correct variable');
    }
  } // end if scriptMatch
  } // end if webviewVar
} // end if vscodeVar

// Patch 5: fix diff view filling the whole window - open in the side panel
const before5 = content;
content = content.replace(
  /let v=\{preview:!1\}/g,
  'let v={preview:!1,viewColumn:tr.ViewColumn.Beside}'
);
content = content.replace(
  /let N=\{preview:!1,preserveFocus:!0\}/g,
  'let N={preview:!1,preserveFocus:!0,viewColumn:Gt.ViewColumn.Beside}'
);
if (content !== before5) {
  modified = true;
  console.log('[Patch] Updated diff view options');
} else {
  console.log('[Patch] diff view options: already patched or not found');
}

// Write back to file
if (modified) {
  fs.writeFileSync(extensionJs, content, 'utf8');
  console.log('[Patch] Done! Please reload VSCode window.');
} else {
  console.log('[Patch] No changes made.');
}
