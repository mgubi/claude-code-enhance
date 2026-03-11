# CLAUDE.md

## Project overview

This repo patches the Claude Code VSCode extension to inject UI enhancements into its webview.

**Files:**
- `patch_extension.js` — Node.js script that applies all patches to the installed extension
- `webview/enhance.js` — the enhancement script injected into the extension's webview

## What the patch does

`patch_extension.js` modifies `~/.vscode/extensions/anthropic.claude-code-*/extension.js`:

1. Adds `https://cdnjs.cloudflare.com` to `style-src` CSP
2. Adds `https://cdnjs.cloudflare.com` to `script-src` CSP
3. Adds `https://cdnjs.cloudflare.com data:` to `font-src` CSP
4. Injects a `<script>` tag loading `enhance.js` after the main module script
5. Sets `viewColumn: Beside` on diff view opens so diffs open in a side panel

## enhance.js structure

All logic is wrapped in an IIFE. Initialisation order:

```
init()
  injectStyles()       — CSS for fonts, tables, lists, copy button, code wrapping
  injectHighlightJS()  — loads hljs from cdnjs, then calls highlightAllCode()
  injectKaTeX()        — loads KaTeX from cdnjs
  setupZoom()          — Ctrl+Wheel zoom, persisted in localStorage
  setupObserver()      — MutationObserver (debounced 500 ms) re-runs highlight/LaTeX/copy
  setupDOMInspector()  — Ctrl+Shift+D exports DOM structure to clipboard
  highlightAllCode()   — applies hljs to all pre>code blocks
  renderLaTeX()        — tree-walks text nodes, replaces LaTeX delimiters with KaTeX HTML
  scanAndAddCopyButtons() — adds a Copy button to the last message in each turn
```

## Running the patch

```bash
node patch_extension.js
```

Reload VSCode after running. Re-run after every Claude Code extension update.

## Language / style conventions

- Vanilla ES5-compatible JavaScript (no build step, runs directly in a webview)
- Comments in English
- No external dependencies beyond what is loaded at runtime from cdnjs
