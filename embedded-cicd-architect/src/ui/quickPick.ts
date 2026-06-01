/**
 * =============================================================================
 * QUICKPICK UI — VS Code QuickPick helpers for user interaction
 * =============================================================================
 *
 * VS Code QuickPick is a dropdown menu that lets users select from options.
 * We use it to ask:
 * 1. Which CI provider? (GitHub Actions / GitLab CI)
 * 2. Use AI or template mode?
 * 3. Confirm overwrite if file already exists
 */

import * as vscode from 'vscode';
import { CiProvider } from '../core/generator/types';

/**
 * Show a QuickPick for selecting the CI provider.
 * Returns null if the user cancels (presses Escape).
 */
export async function pickCiProvider(): Promise<CiProvider | null> {
  const items: vscode.QuickPickItem[] = [
    {
      label: '$(github) GitHub Actions',
      description: 'Generate .github/workflows/embedded-ci.yml',
      detail: 'Best for projects hosted on GitHub',
    },
    {
      label: '$(git-merge) GitLab CI',
      description: 'Generate .gitlab-ci.yml',
      detail: 'Best for projects hosted on GitLab',
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select your CI/CD platform',
    title: 'Embedded CI/CD Pipeline Architect',
  });

  if (!selected) return null;

  // Map the label back to the provider type
  if (selected.label.includes('GitHub')) return 'github';
  if (selected.label.includes('GitLab')) return 'gitlab';
  return null;
}

/**
 * Show a QuickPick for choosing between AI and template mode.
 * Returns true for AI mode, false for template mode, null if cancelled.
 */
export async function pickGenerationMode(
  aiAvailable: boolean
): Promise<boolean | null> {
  const items: vscode.QuickPickItem[] = [];

  if (aiAvailable) {
    items.push({
      label: '$(sparkle) AI-Enhanced Generation',
      description: 'Uses LLM for smart, project-specific pipelines',
      detail: 'Analyzes your project and generates optimized CI/CD YAML',
    });
  }

  items.push({
    label: '$(file-code) Template-Based Generation',
    description: 'Uses handcrafted templates (no API key needed)',
    detail: 'Fast, deterministic, always works offline',
  });

  if (items.length === 1) {
    // Only template mode available — no need to ask
    return false;
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'How should the pipeline be generated?',
    title: 'Generation Mode',
  });

  if (!selected) return null;
  return selected.label.includes('AI');
}

/**
 * Ask the user to confirm overwriting an existing file.
 */
export async function confirmOverwrite(filePath: string): Promise<boolean> {
  const result = await vscode.window.showWarningMessage(
    `CI/CD pipeline file already exists:\n${filePath}\n\nOverwrite?`,
    { modal: true },
    'Overwrite',
    'Cancel'
  );

  return result === 'Overwrite';
}
