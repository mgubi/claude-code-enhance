# Claude Code Enhance

UI enhancements for the [Claude Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) VSCode extension:

- **Syntax highlighting** — 180+ languages via Highlight.js
- **LaTeX rendering** — inline `$...$` and display `$$...$$` math via KaTeX
- **Copy button** — hover any AI reply to copy it as Markdown
- **Scroll zoom** — `Ctrl+Wheel` to zoom 50–200%, persisted across sessions
- **Table & list styling** — dark/light theme, hover highlights, proper numbering

## Usage

Two commands are available in the Command Palette (`Ctrl+Shift+P`):

- **Claude Code Enhance: Apply Patch** — inject enhancements into Claude Code
- **Claude Code Enhance: Restore Original** — remove the patch and restore the original

The extension auto-patches on startup (if already patched) and re-patches automatically when Claude Code updates.

## How it works

The extension makes targeted edits to Claude Code's compiled `extension.js`:

| # | What is patched | Why |
|---|-----------------|-----|
| 1 | `style-src` CSP | allows stylesheets from cdnjs.cloudflare.com |
| 2 | `script-src` CSP | allows scripts from cdnjs.cloudflare.com |
| 3 | `font-src` CSP | allows KaTeX fonts from cdnjs + `data:` URIs |
| 4 | HTML template | injects `enhance.js` after the main module script |
| 5 | Diff view options | opens diffs in a side panel (`viewColumn: Beside`) |

`enhance.js` runs inside Claude Code's webview on every page load, using a debounced `MutationObserver` to re-apply highlighting, LaTeX, and copy buttons as Claude streams responses.

## Requirements

- Claude Code extension v2.1.31+
- macOS / Windows / Linux
