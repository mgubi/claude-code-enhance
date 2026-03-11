'use strict';
const vscode = require('vscode');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PATCH_SCRIPT   = path.join(__dirname, '..', 'patch_extension.js');
const RESTORE_SCRIPT = path.join(__dirname, '..', 'restore_extension.js');

let outputChannel;

function runScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  const stdout = (result.stdout || '') + (result.stderr || '');
  if (result.status !== 0 || result.error) {
    return { stdout, error: result.error || new Error(`exited with code ${result.status}`) };
  }
  return { stdout, error: null };
}

function setPatched(value) {
  vscode.commands.executeCommand('setContext', 'claudeCodeEnhance.isPatched', value);
}

function checkIsPatched() {
  try {
    const home = process.env.HOME || process.env.USERPROFILE;
    const extBase = path.join(home, '.vscode', 'extensions');
    const dirs = fs.readdirSync(extBase).filter(d => d.startsWith('anthropic.claude-code-'));
    if (!dirs.length) return false;
    const latest = dirs.sort().pop();
    const extJs = path.join(extBase, latest, 'extension.js');
    return fs.readFileSync(extJs, 'utf8').includes('enhance.js');
  } catch {
    return false;
  }
}

function runPatch(trigger) {
  const { stdout, error } = runScript(PATCH_SCRIPT);
  outputChannel.appendLine(`--- patch (${trigger}) ---\n${stdout}`);
  if (error) {
    vscode.window.showErrorMessage('Claude Code Enhance: patch failed.', 'Show Output')
      .then(c => c && outputChannel.show());
    return;
  }
  setPatched(true);
  if (stdout.includes('[Patch] Done! Please reload VSCode window.')) {
    vscode.window.showInformationMessage(
      'Claude Code Enhance: patch applied.', 'Reload Window'
    ).then(c => c && vscode.commands.executeCommand('workbench.action.reloadWindow'));
  }
}

function runRestore() {
  const { stdout, error } = runScript(RESTORE_SCRIPT);
  outputChannel.appendLine(`--- restore ---\n${stdout}`);
  if (error) {
    vscode.window.showErrorMessage('Claude Code Enhance: restore failed.', 'Show Output')
      .then(c => c && outputChannel.show());
    return;
  }
  setPatched(false);
  vscode.window.showInformationMessage(
    'Claude Code Enhance: original restored.', 'Reload Window'
  ).then(c => c && vscode.commands.executeCommand('workbench.action.reloadWindow'));
}

function getClaudeVersion() {
  const ext = vscode.extensions.getExtension('anthropic.claude-code');
  return ext ? ext.packageJSON.version : undefined;
}

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Claude Code Enhance');
  context.subscriptions.push(outputChannel);

  // Set initial command visibility before running anything
  setPatched(checkIsPatched());

  runPatch('startup');

  let lastClaudeVersion = getClaudeVersion();
  context.subscriptions.push(
    vscode.extensions.onDidChange(() => {
      const current = getClaudeVersion();
      if (current !== undefined && current !== lastClaudeVersion) {
        outputChannel.appendLine(`Claude Code updated: ${lastClaudeVersion} → ${current}`);
        lastClaudeVersion = current;
        runPatch('onDidChange');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeEnhance.patch',   () => runPatch('command')),
    vscode.commands.registerCommand('claudeCodeEnhance.restore', () => runRestore())
  );
}

function deactivate() {}
module.exports = { activate, deactivate };
