/**
 * =============================================================================
 * EXTENSION ENTRY POINT — Where VS Code starts loading your extension
 * =============================================================================
 *
 * VS Code extensions have two lifecycle functions:
 *
 * 1. activate() — Called ONCE when the extension is first needed
 *    (triggered by the activation events in package.json)
 *    This is where you register commands, event listeners, etc.
 *
 * 2. deactivate() — Called when the extension is unloaded
 *    (usually when VS Code is closing)
 *    Use this for cleanup (closing connections, saving state, etc.)
 *
 * KEY CONCEPT: Disposables
 * Every command/listener you register returns a "disposable" — an object
 * with a dispose() method. Push these into context.subscriptions so VS Code
 * automatically cleans them up when the extension deactivates.
 */

import * as vscode from 'vscode';
import { initializeDefaultScanners } from './core';
import { generatePipelineCommand } from './commands/generatePipeline';

/**
 * Called when the extension is activated.
 *
 * ACTIVATION TRIGGER:
 * This runs when the user invokes the "embeddedCicd.generatePipeline" command
 * (either from the context menu or the command palette).
 * See package.json → activationEvents.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('[Embedded CI/CD Architect] Extension is activating...');

  // -------------------------------------------------------------------------
  // Step 1: Initialize the scanner registry with all built-in scanners
  // -------------------------------------------------------------------------
  initializeDefaultScanners();
  console.log('[Embedded CI/CD Architect] Scanners registered');

  // -------------------------------------------------------------------------
  // Step 2: Register the "Generate CI/CD Pipeline" command
  // -------------------------------------------------------------------------
  const generateCommand = vscode.commands.registerCommand(
    'embeddedCicd.generatePipeline',
    generatePipelineCommand
  );

  // Push the disposable so VS Code cleans it up on deactivation
  context.subscriptions.push(generateCommand);

  console.log('[Embedded CI/CD Architect] ✅ Extension activated successfully');
}

/**
 * Called when the extension is deactivated.
 * Currently no cleanup needed, but this is where you'd close
 * database connections, save state, etc.
 */
export function deactivate(): void {
  console.log('[Embedded CI/CD Architect] Extension deactivated');
}
