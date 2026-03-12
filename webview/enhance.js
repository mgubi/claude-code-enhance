/**
 * Claude Code UI Enhancement Script v11
 * Features: scroll zoom, fonts, tables, LaTeX, line wrap, code highlighting, AI dialogue copy
 */

(function() {
  'use strict';

  console.log('[Claude Enhance] Loading...');

  // Turn-tracking state — maintained incrementally by the MutationObserver
  var turnsContainer = null;   // cached [class*="messagesContainer_"] element
  var turnsInitialized = false;
  var completedTurns = [];     // array of frozen turn arrays (each a completed AI turn)
  var activeTurn = [];         // growing array of timelineMessage elements in the current turn
  var activeTurnLastEl = null; // last element in activeTurn

  // Inject styles
  function injectStyles() {
    const styleId = 'claude-enhance-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Code block font */
      pre code, .hljs {
        font-family: 'JetBrains Mono NL', 'LXGW WenKai GB Screen R', 'Consolas', 'Monaco', 'Ubuntu Mono', 'Source Code Pro', 'Fira Code', 'DejaVu Sans Mono', 'Courier New', monospace !important;
      }

      /* KaTeX styles */
      .katex {
        font-size: 1.1em;
      }
      .katex-display {
        margin: 1em 0;
        overflow-x: auto;
      }

      /* List styles - fix truncated numbers */
      ol, ul {
        padding-left: 2em !important;
        list-style-position: outside !important;
      }
      ol {
        list-style-type: decimal !important;
      }

      /* Table styles — shared structure */
      table {
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
        margin: 1em 0;
        font-size: 0.95em;
        border-radius: 4px;
        overflow: hidden;
      }
      table th {
        padding: 10px 14px;
        text-align: left;
        font-weight: 600;
      }
      table th:first-child { border-top-left-radius: 4px; }
      table th:last-child  { border-top-right-radius: 4px; }
      table td {
        padding: 10px 14px;
        border-top: none;
        border-left: none;
      }
      table td:last-child { border-right: none; }
      table tbody tr:last-child td:first-child { border-bottom-left-radius: 4px; }
      table tbody tr:last-child td:last-child  { border-bottom-right-radius: 4px; }

      /* Dark theme */
      body.vscode-dark table {
        color: #e0e0e0;
        border: 3px solid #707070;
      }
      body.vscode-dark table thead {
        background: linear-gradient(to bottom, #2d2d2d, #252525);
      }
      body.vscode-dark table th {
        border: 3px solid #707070;
        color: #ffffff;
      }
      body.vscode-dark table td {
        border: 3px solid #707070;
      }
      body.vscode-dark table tbody tr:nth-child(even) {
        background-color: rgba(255, 255, 255, 0.03);
      }
      body.vscode-dark table tbody tr:hover {
        background-color: rgba(255, 255, 255, 0.08);
      }

      /* Light theme */
      body.vscode-light table {
        color: #1a1a1a;
        border: 2px solid #c8c8c8;
      }
      body.vscode-light table thead {
        background: linear-gradient(to bottom, #f0f0f0, #e8e8e8);
      }
      body.vscode-light table th {
        border: 2px solid #c8c8c8;
        color: #111111;
      }
      body.vscode-light table td {
        border: 2px solid #c8c8c8;
      }
      body.vscode-light table tbody tr:nth-child(even) {
        background-color: rgba(0, 0, 0, 0.03);
      }
      body.vscode-light table tbody tr:hover {
        background-color: rgba(0, 0, 0, 0.06);
      }

      /* Code block line wrapping */
      pre {
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        max-width: 100% !important;
      }
      pre code {
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }
      /* Rounded border on highlighted code blocks */
      pre code.hljs {
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 12px;
        display: block;
      }
      body.vscode-light pre code.hljs {
        border-color: rgba(0, 0, 0, 0.15);
      }

      /* AI message copy button styles */
      .claude-copy-btn {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(60, 60, 60, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: #e0e0e0;
        padding: 3px 5px;
        font-size: 11px;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s, background 0.2s;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .claude-copy-btn svg {
        display: block;
      }
      .claude-copy-btn:hover {
        background: rgba(80, 80, 80, 0.95);
        color: #fff;
      }
      .claude-copy-btn.copied {
        background: rgba(74, 222, 128, 0.9);
        color: #000;
      }
      [class*="timelineMessage"]:hover .claude-copy-btn {
        opacity: 1;
      }
      [class*="timelineMessage"] {
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }

  // Inject Highlight.js
  function injectHighlightJS() {
    if (window.hljsLoaded) return;

    const isDark = document.body.classList.contains('vscode-dark');
    console.log('[Claude Enhance] body classes:', document.body.className, '→ isDark:', isDark);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.id = 'hljs-theme';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/' +
      (isDark ? 'vs2015.min.css' : 'vs.min.css');
    console.log('[Claude Enhance] hljs theme:', css.href);
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    script.onload = () => {
      console.log('[Claude Enhance] Highlight.js loaded');
      window.hljsLoaded = true;
      highlightAllCode();
    };
    document.head.appendChild(script);
  }

  // Inject KaTeX
  function injectKaTeX() {
    if (window.katexLoaded) return;

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
    script.onload = () => {
      // Wait for katex to be mounted on window
      const checkKatex = () => {
        if (typeof katex !== 'undefined') {
          window.katexLoaded = true;
          console.log('[Claude Enhance] KaTeX ready');
        } else {
          setTimeout(checkKatex, 100);
        }
      };
      checkKatex();
    };
    script.onerror = (e) => {
      console.error('[Claude Enhance] KaTeX load error:', e);
    };
    document.head.appendChild(script);
  }

  // Highlight code blocks
  function highlightAllCode() {
    if (typeof hljs === 'undefined') return;

    document.querySelectorAll('pre code').forEach((block) => {
      if (block.classList.contains('language-latex')) return;
      if (!block.classList.contains('hljs')) {
        hljs.highlightElement(block);
      }
    });
  }

  // Render LaTeX
  function renderLaTeX() {
    if (typeof katex === 'undefined') return;
    if (window._claudeRenderingLaTeX) return;
    window._claudeRenderingLaTeX = true;

    try {
      const walker = document.createTreeWalker(
        document.getElementById('root') || document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentNode;
            if (!parent || parent.nodeType !== 1) return NodeFilter.FILTER_REJECT;
            // Skip already-rendered KaTeX, special tags, and session lists
            if (parent.classList?.contains('katex') ||
                parent.closest('.katex') ||
                parent.closest('[class*="sessionsList"]') ||
                parent.closest('[class*="sessionItem"]') ||
                parent.closest('[class*="sessionName"]') ||
                ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            const text = node.textContent;
            if (text && (text.includes('$$') || text.includes('$') || text.includes('\\(') || text.includes('\\['))) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );

      const nodesToRender = [];
      let node;
      while (node = walker.nextNode()) {
        nodesToRender.push(node);
      }

      nodesToRender.forEach((textNode) => {
        const text = textNode.textContent;
        if (!text || !text.trim()) return;

        try {
          let resultHTML = text;
          let hasFormula = false;

          // $$...$$ block-level formula (preserve newlines, required for matrices)
          resultHTML = resultHTML.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
            hasFormula = true;
            try {
              let fixed = formula;

              // Fix matrix line breaks: single backslash + space/newline → double backslash
              fixed = fixed.replace(/\\\s*\n/g, '\\\\\n');
              fixed = fixed.replace(/\\ (?=[a-zA-Z0-9_{}])/g, '\\\\ ');

              // Fix spacing commands \[x] → \\[x]
              fixed = fixed.replace(/\\\[(\d+(?:\.\d+)?[a-z]*)\]/gi, '\\\\[$1]');

              // Fix spacing in cases environment
              fixed = fixed.replace(/&\s*\\\[6pt\]/g, '& \\\\');

              // Fix common syntax errors: \sum{...} → \sum_{...}
              fixed = fixed.replace(/\\(sum|prod|int|lim|inf|sup|max|min)\{([^}]+)\}/g, '\\$1_{$2}');

              // Fix \operatorname followed immediately by content
              fixed = fixed.replace(/\\operatorname\{(\w+)\}(\()/g, '\\operatorname{$1}$2');

              return katex.renderToString(fixed, { displayMode: true, throwOnError: false, strict: 'ignore', macros: {
                "\\begin{cases}": "\\begin{cases}",
                "\\end{cases}": "\\end{cases}",
                "\\text": "\\text"
              }});
            } catch { return match; }
          });

          // \(...\) inline formula
          resultHTML = resultHTML.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
            hasFormula = true;
            try {
              return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
            } catch { return match; }
          });

          // \[...\] block-level formula (preserve newlines)
          resultHTML = resultHTML.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
            hasFormula = true;
            try {
              return katex.renderToString(formula, { displayMode: true, throwOnError: false });
            } catch { return match; }
          });

          // $...$ inline formula (supports multi-line, auto-cleans newlines)
          resultHTML = resultHTML.replace(/\$([\s\S]+?)\$/g, (match, formula) => {
            const content = formula.trim();
            // Clean up newlines and extra spaces, keep on one line
            const cleaned = content.replace(/\s+/g, ' ').trim();
            const looksLikeLatex = cleaned.length <= 2 || cleaned.includes('\\') ||
              cleaned.includes('_') || cleaned.includes('^') || cleaned.includes('{') ||
              /\b(alpha|beta|gamma|delta|theta|lambda|mu|sigma|pi|omega|sum|int|frac|sqrt)\b/i.test(cleaned);
            if (!looksLikeLatex) return match;
            hasFormula = true;
            try {
              let fixed = cleaned.replace(/\\ (?=[a-zA-Z0-9_{}])/g, '\\\\ ');
              return katex.renderToString(fixed, { displayMode: false, throwOnError: false });
            } catch { return match; }
          });

          if (hasFormula && resultHTML !== text && resultHTML.includes('katex')) {
            const span = document.createElement('span');
            span.innerHTML = resultHTML;
            textNode.parentNode.replaceChild(span, textNode);
          }
        } catch (e) {}
      });
    } finally {
      window._claudeRenderingLaTeX = false;
    }
  }

  // ========== AI dialogue copy feature ==========

  // Class name prefixes to exclude (thinking chain and tool calls)
  const EXCLUDE_PREFIXES = [
    'thinking_',
    'thinkingContent_',
    'thinkingSummary_',
    'toolUse_',
    'toolResult_',
    'toolBody_',
    'toolBodyGrid_',
    'toolBodyRow_',
    'toolSummary_',
    'root_ZUQaOA',
    'userMessage_',
    'userMessageContainer_'
  ];

  // Check whether an element should be excluded
  function shouldExclude(element) {
    if (!element || !element.className) return false;
    const className = typeof element.className === 'string' ? element.className : '';
    return EXCLUDE_PREFIXES.some(prefix => className.includes(prefix));
  }

  // Extract Markdown-formatted content from an HTML element (compact version)
  function htmlToMarkdown(element) {
    if (!element) return '';

    const IGNORE_TAGS = new Set(['BUTTON', 'STYLE', 'SCRIPT', 'SVG', 'MAT-ICON']);

    function traverse(node, context = {}) {
      // Text node
      if (node.nodeType === 3) {
        const text = node.textContent;
        if (context.inPre) return text;
        return text.replace(/\s+/g, ' ');
      }

      // Skip non-element nodes
      if (node.nodeType !== 1) return '';
      if (IGNORE_TAGS.has(node.tagName)) return '';
      if (shouldExclude(node)) return '';

      const tag = node.tagName;
      const children = Array.from(node.childNodes);
      const newContext = {
        ...context,
        inPre: context.inPre || tag === 'PRE',
        inList: context.inList || tag === 'LI',
      };

      // Recursively process child nodes first
      const childrenContent = children
        .map(c => traverse(c, newContext))
        .join('');

      // KaTeX 公式处理
      if (tag === 'SPAN' && node.classList?.contains('katex')) {
        const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation) {
          const tex = annotation.textContent;
          // Clean up newlines and extra spaces, keep on one line (Obsidian compatible)
          const cleaned = tex.replace(/\s+/g, ' ').trim();
          const isDisplay = node.classList.contains('katex-display');
          return isDisplay ? `$$${cleaned}$$` : `$${cleaned}$`;
        }
      }

      // Return formatted content based on tag type
      switch (tag) {
        case 'H1': return '\n# ' + childrenContent + '\n';
        case 'H2': return '\n## ' + childrenContent + '\n';
        case 'H3': return '\n### ' + childrenContent + '\n';
        case 'H4': return '\n#### ' + childrenContent + '\n';
        case 'H5': return '\n##### ' + childrenContent + '\n';
        case 'H6': return '\n###### ' + childrenContent + '\n';

        case 'P':
          return context.inList ? childrenContent : '\n' + childrenContent.trim() + '\n';

        case 'BR':
          return '\n';

        case 'STRONG':
        case 'B':
          return `**${childrenContent}**`;

        case 'EM':
        case 'I':
          return `*${childrenContent}*`;

        case 'CODE':
          if (context.inPre) return childrenContent;
          return `\`${childrenContent}\``;

        case 'PRE': {
          const codeEl = node.querySelector('code');
          const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
          const content = codeEl ? codeEl.textContent : node.textContent;
          return `\`\`\`${lang}\n${content}\n\`\`\``;
        }

        case 'A': {
          const href = node.getAttribute('href') || '';
          const text = node.textContent;
          return `[${text}](${href})`;
        }

        case 'UL': {
          const items = children
            .filter(c => c.tagName === 'LI')
            .map(li => {
              const text = li.textContent.trim();
              const nested = li.querySelector('ul, ol');
              if (nested) {
                const nestedMd = traverse(nested, {});
                return `- ${text.replace(nested.textContent.trim(), '').trim()}\n  ${nestedMd}`;
              }
              return `- ${text}`;
            })
            .join('\n');
          return '\n' + items + '\n';
        }

        case 'OL': {
          let idx = 1;
          const items = children
            .filter(c => c.tagName === 'LI')
            .map(li => {
              const text = li.textContent.trim();
              return `${idx++}. ${text}`;
            })
            .join('\n');
          return '\n' + items + '\n';
        }

        case 'LI':
          return childrenContent.trim();

        case 'TABLE': {
          const rows = node.querySelectorAll('tr');
          if (rows.length === 0) return '';
          let result = '';
          rows.forEach((row, rowIdx) => {
            const cells = row.querySelectorAll('th, td');
            const cellTexts = Array.from(cells).map(c =>
              c.textContent.trim().replace(/\|/g, '\\|')
            );
            result += `| ${cellTexts.join(' | ')} |\n`;
            if (rowIdx === 0) {
              result += `| ${cellTexts.map(() => '---').join(' | ')} |\n`;
            }
          });
          return '\n' + result.trim() + '\n';
        }

        case 'BLOCKQUOTE': {
          const quoteLines = node.textContent.trim().split('\n');
          return '\n' + quoteLines.map(l => `> ${l}`).join('\n') + '\n';
        }

        case 'HR':
          return '\n\n---\n\n';

        case 'DIV':
        case 'SECTION':
        case 'ARTICLE':
        case 'SPAN':
        default:
          return childrenContent;
      }
    }

    // Run the conversion and compact newlines
    return traverse(element)
      .replace(/\n{3,}/g, '\n\n')      // 3+ newlines → at most one blank line
      .replace(/^\n+/, '')             // Remove leading newlines
      .replace(/\n+$/, '')             // Remove trailing newlines
      .replace(/[ \t]+$/gm, '')        // Remove trailing spaces on each line
      .trim();
  }

  // Group messages by turn
  function groupMessagesByTurn() {
    const container = document.querySelector('[class*="messagesContainer_"]');
    if (!container) return [];

    const turns = [];
    let currentTurn = [];

    for (const child of container.children) {
      const className = child.className || '';

      if (className.includes('userMessage')) {
        if (currentTurn.length > 0) {
          turns.push([...currentTurn]);
          currentTurn = [];
        }
      } else if (className.includes('timelineMessage')) {
        currentTurn.push(child);
      }
    }

    if (currentTurn.length > 0) {
      turns.push(currentTurn);
    }

    return turns;
  }

  // Add a copy button to a message
  function addCopyButton(messageEl) {
    if (messageEl.querySelector('.claude-copy-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'claude-copy-btn enhance-done';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    btn.title = 'Copy full Markdown content (excluding thinking chain and tool calls)';

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();

      // Get the full turn's messages
      const turnMessages = messageEl._turnMessages || [messageEl];

      // Merge Markdown content from all messages in the turn
      const contents = turnMessages.map(msg => htmlToMarkdown(msg)).filter(c => c.trim());
      const finalContent = contents.join('\n\n');

      try {
        var copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        var checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        await navigator.clipboard.writeText(finalContent);
        btn.innerHTML = checkIcon;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = copyIcon;
          btn.classList.remove('copied');
        }, 1500);
      } catch (err) {
        console.error('[Claude Enhance] Copy failed:', err);
        btn.innerHTML = '✕';
        setTimeout(() => { btn.innerHTML = copyIcon; }, 1500);
      }
    });

    messageEl.appendChild(btn);
  }

  // Seed turn-tracking state from current DOM — called once at startup
  function initTurnState() {
    turnsContainer = document.querySelector('[class*="messagesContainer_"]');
    if (!turnsContainer) return;
    const turns = groupMessagesByTurn(); // only call ever
    completedTurns = turns.slice(0, -1);
    activeTurn = turns.length > 0 ? turns[turns.length - 1] : [];
    activeTurnLastEl = activeTurn.length > 0 ? activeTurn[activeTurn.length - 1] : null;
    // Place buttons on all completed turns
    for (let t = 0; t < completedTurns.length; t++) {
      const last = completedTurns[t][completedTurns[t].length - 1];
      if (last && !last.dataset.copyBtnDone) {
        last._turnMessages = completedTurns[t];
        addCopyButton(last);
        last.dataset.copyBtnDone = '1';
      }
    }
    // Place button on active turn's last message
    if (activeTurnLastEl) {
      activeTurnLastEl._turnMessages = activeTurn;
      addCopyButton(activeTurnLastEl);
    }
    turnsInitialized = true;
  }

  // Add copy button to the current active turn's last message — O(1)
  function scanAndAddCopyButtons() {
    if (!turnsInitialized) return; // initTurnState() handles initial placement
    if (!activeTurnLastEl) return;
    activeTurnLastEl._turnMessages = activeTurn; // keep reference fresh as turn grows
    addCopyButton(activeTurnLastEl);             // no-op if button already present
  }

  // ========== Scroll wheel zoom ==========

  function setupZoom() {
    let zoom = parseFloat(localStorage.getItem('claude-zoom') || '1.0');
    document.body.style.zoom = zoom;

    document.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoom = Math.max(0.5, Math.min(2.0, zoom + delta));
        document.body.style.zoom = zoom;
        localStorage.setItem('claude-zoom', zoom.toString());
        showZoomIndicator(zoom);
      }
    }, { passive: false });
  }

  function showZoomIndicator(zoom) {
    let indicator = document.getElementById('zoom-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'zoom-indicator';
      indicator.classList.add('enhance-done');
      indicator.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: rgba(40, 40, 40, 0.95); color: #fff;
        padding: 8px 16px; border-radius: 6px; font-size: 14px;
        z-index: 10000; transition: opacity 0.3s;
      `;
      document.body.appendChild(indicator);
    }
    indicator.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
    indicator.style.opacity = '1';
    setTimeout(() => { indicator.style.opacity = '0'; }, 1000);
  }

  // DOM observer - two-phase: immediate copy button placement, then heavy ops after settle
  function setupObserver() {
    const SETTLE_DELAY = 150;
    let streaming = false;
    let settleTimer = null;
    let idleHandle = null;

    function runHeavyOps() {
      settleTimer = null;
      idleHandle = null;
      streaming = false;
      highlightAllCode();
      renderLaTeX();
      scanAndAddCopyButtons();
    }

    function scheduleSettle() {
      if (settleTimer) clearTimeout(settleTimer);
      if (idleHandle && window.cancelIdleCallback) cancelIdleCallback(idleHandle);
      if (window.requestIdleCallback) {
        idleHandle = requestIdleCallback(runHeavyOps, { timeout: SETTLE_DELAY });
      } else {
        settleTimer = setTimeout(runHeavyOps, SETTLE_DELAY);
      }
    }

    const observer = new MutationObserver((mutations) => {
      // Update incremental turn state and detect real (non-enhance) changes
      let hasRealChange = false;
      if (!turnsInitialized) {
        initTurnState();
        hasRealChange = turnsInitialized; // only true if container was found and init succeeded
      } else {
        if (!turnsContainer) turnsContainer = document.querySelector('[class*="messagesContainer_"]');
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            // Update turn tracking for direct children of the messages container
            if (turnsContainer && node.parentElement === turnsContainer) {
              const cls = node.className || '';
              if (cls.includes('userMessage')) {
                // Turn boundary: freeze active turn
                if (activeTurn.length > 0) {
                  completedTurns.push(activeTurn);
                  if (activeTurnLastEl) activeTurnLastEl.dataset.copyBtnDone = '1';
                }
                activeTurn = [];
                activeTurnLastEl = null;
              } else if (cls.includes('timelineMessage')) {
                // New AI message — move button to this new last element
                if (activeTurnLastEl) {
                  const oldBtn = activeTurnLastEl.querySelector('.claude-copy-btn');
                  if (oldBtn) oldBtn.remove();
                }
                activeTurn.push(node);
                activeTurnLastEl = node;
              }
            }
            // Classify as a real change if not injected by enhance.js or a library
            const cls = node.className?.toString() || '';
            if (!cls.includes('enhance-done') && !node.closest('pre, .katex')) {
              hasRealChange = true;
            }
          }
        }
      }

      if (!hasRealChange) return;

      // Phase 1: immediately place copy button on active turn's last message
      if (!streaming) {
        streaming = true;
        scanAndAddCopyButtons();
      }

      // Phase 2: schedule highlight + LaTeX after stream settles
      scheduleSettle();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // DOM inspection tool - press Ctrl+Shift+D to export DOM structure
  function setupDOMInspector() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D triggers DOM export
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        exportDOMStructure();
      }
    });
  }

  function exportDOMStructure() {
    console.log('[Claude Enhance] Exporting DOM structure...');

    const result = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      rootClasses: [],
      messageContainers: [],
      allClassNames: new Set(),
      potentialMessageSelectors: []
    };

    // Collect all class names
    document.querySelectorAll('*').forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(/\s+/).forEach(cls => {
          if (cls) result.allClassNames.add(cls);
        });
      }
    });

    // Find potential message containers (based on common patterns)
    const messagePatterns = [
      '[class*="message"]', '[class*="Message"]',
      '[class*="chat"]', '[class*="Chat"]',
      '[class*="response"]', '[class*="Response"]',
      '[class*="assistant"]', '[class*="Assistant"]',
      '[class*="human"]', '[class*="Human"]',
      '[class*="user"]', '[class*="User"]',
      '[class*="turn"]', '[class*="Turn"]',
      '[class*="content"]', '[class*="Content"]',
      '[role="article"]', '[role="listitem"]',
      '[data-message]', '[data-turn]'
    ];

    messagePatterns.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          result.potentialMessageSelectors.push({
            selector,
            count: elements.length,
            sampleClasses: Array.from(elements).slice(0, 3).map(el => el.className)
          });
        }
      } catch (e) {}
    });

    // Analyse the structure under #root
    const root = document.getElementById('root');
    if (root) {
      result.rootStructure = analyzeElement(root, 0, 4);
    }

    // Find containers with a large amount of text
    const textContainers = [];
    document.querySelectorAll('div, section, article').forEach(el => {
      const text = el.innerText || '';
      if (text.length > 200 && text.length < 50000) {
        const children = el.children.length;
        if (children < 50) {
          textContainers.push({
            tag: el.tagName,
            className: el.className,
            textLength: text.length,
            childCount: children,
            preview: text.substring(0, 100) + '...'
          });
        }
      }
    });
    result.textContainers = textContainers.slice(0, 20);

    // Convert Set to array
    result.allClassNames = Array.from(result.allClassNames).sort();

    // Copy to clipboard
    const output = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(output).then(() => {
      showNotification('DOM structure copied to clipboard! Paste it to Claude for analysis.');
      console.log('[Claude Enhance] DOM structure copied to clipboard');
    }).catch(err => {
      console.error('[Claude Enhance] Failed to copy:', err);
      // Fallback: print to console
      console.log('[Claude Enhance] DOM Structure:\n', output);
      showNotification('Copy failed. Please check the console (F12).');
    });
  }

  function analyzeElement(el, depth, maxDepth) {
    if (depth > maxDepth) return { truncated: true };

    const info = {
      tag: el.tagName,
      className: el.className || null,
      id: el.id || null,
      childCount: el.children.length
    };

    // Check special attributes
    const attrs = ['role', 'data-message', 'data-turn', 'data-type', 'data-testid'];
    attrs.forEach(attr => {
      if (el.hasAttribute(attr)) {
        info[attr] = el.getAttribute(attr);
      }
    });

    // Recursively analyse child elements (first few only)
    if (el.children.length > 0 && depth < maxDepth) {
      info.children = Array.from(el.children)
        .slice(0, 5)
        .map(child => analyzeElement(child, depth + 1, maxDepth));
      if (el.children.length > 5) {
        info.moreChildren = el.children.length - 5;
      }
    }

    return info;
  }

  function showNotification(message) {
    let notification = document.getElementById('claude-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'claude-notification';
      notification.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(30, 30, 30, 0.95); color: #4ade80;
        padding: 16px 24px; border-radius: 8px; font-size: 14px;
        z-index: 10001; border: 1px solid #4ade80;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;
      document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.display = 'block';
    notification.style.opacity = '1';
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => { notification.style.display = 'none'; }, 300);
    }, 2000);
  }

  // Initialise
  function init() {
    console.log('[Claude Enhance] Initializing...');
    injectStyles();
    injectHighlightJS();
    injectKaTeX();
    setupZoom();
    setupObserver();
    setupDOMInspector();
    highlightAllCode();
    renderLaTeX();
    initTurnState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
