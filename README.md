# claude-code-enhance

UI enhancements for the Claude Code VSCode extension.

## Requirements

- Claude Code extension v2.1.31+
- macOS / Windows / Linux

## Installation

```bash
node patch_extension.js
```

Then reload VSCode (`Ctrl+Shift+P` → `Developer: Reload Window`).

The script copies `webview/enhance.js` into the extension directory and relaxes the CSP to allow loading from cdnjs.cloudflare.com.

> **Note:** Re-run after every Claude Code extension update, as updates overwrite `extension.js`.

## How it works

The Claude Code extension renders its UI in a VSCode webview — an isolated iframe with a strict [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) that blocks external resources by default.

`patch_extension.js` makes five targeted edits to the extension's compiled `extension.js`:

| # | What is patched | Why |
|---|-----------------|-----|
| 1 | `style-src` CSP | allows loading stylesheets from cdnjs.cloudflare.com |
| 2 | `script-src` CSP | allows loading scripts from cdnjs.cloudflare.com |
| 3 | `font-src` CSP | allows KaTeX fonts from cdnjs + inline `data:` URIs |
| 4 | HTML template | injects a `<script>` tag that loads `enhance.js` after the main module |
| 5 | Diff view options | adds `viewColumn: Beside` so diffs open in a side panel instead of full-window |

Once injected, `enhance.js` runs inside the webview on every page load. It uses a debounced `MutationObserver` (500 ms quiet period) to watch for new content and re-applies highlighting, LaTeX rendering, and copy buttons as Claude streams its responses. Libraries (Highlight.js, KaTeX) are loaded lazily from cdnjs on first use.

## Features

| Feature | Description |
|---------|-------------|
| Code highlighting | 180+ languages via Highlight.js (vs2015 theme) |
| LaTeX rendering | Inline `$...$`, display `$$...$$`, `\(...\)`, `\[...\]` via KaTeX |
| Copy button | Hover an AI reply to copy it as Markdown (excludes thinking/tool blocks) |
| Scroll zoom | `Ctrl+Wheel` to zoom 50–200%; persisted across sessions |
| Table styling | Dark theme with gradient header and hover highlight |
| Code wrapping | Long lines wrap inside code blocks |
| List fix | Numbered lists render without truncation |
| DOM inspector | `Ctrl+Shift+D` copies the page DOM structure to the clipboard |

## Troubleshooting

- **Features not showing** — reload the VSCode window.
- **Script errors** — verify the CSP was patched correctly in `extension.js`.
