/**
 * =============================================================================
 * GENERATE PIPELINE COMMAND — The main command handler
 * =============================================================================
 *
 * This is where EVERYTHING comes together:
 * 1. User right-clicks a folder → VS Code calls this handler with the folder URI
 * 2. We show QuickPick UIs for user choices
 * 3. We scan the project folder (Scanner Registry)
 * 4. We generate the pipeline YAML (Generator Factory)
 * 5. We write the file and open it in the editor
 *
 * DATA FLOW:
 *   Folder URI → Scanner → ProjectProfile → Generator → YAML → File
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  defaultScannerRegistry,
  createGenerator,
  LlmConfig,
} from '../core';
import { pickCiProvider, pickGenerationMode, confirmOverwrite } from '../ui/quickPick';

/**
 * Main command handler for "Generate CI/CD Pipeline".
 *
 * @param uri - The folder URI from the right-click context menu.
 *              VS Code passes this automatically when the command is
 *              triggered from the File Explorer context menu.
 */
export async function generatePipelineCommand(uri?: vscode.Uri): Promise<void> {
  // -------------------------------------------------------------------------
  // Step 1: Determine the target folder
  // -------------------------------------------------------------------------
  let folderPath: string;

  if (uri) {
    // Called from context menu — uri is the right-clicked folder
    folderPath = uri.fsPath;
  } else if (vscode.workspace.workspaceFolders?.length) {
    // Called from command palette — use the first workspace folder
    folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  } else {
    vscode.window.showErrorMessage('No folder selected. Right-click a project folder in the Explorer.');
    return;
  }

  // -------------------------------------------------------------------------
  // Step 2: Read user settings
  // -------------------------------------------------------------------------
  const config = vscode.workspace.getConfiguration('embeddedCicd');
  const defaultProvider = config.get<string>('defaultCiProvider', 'ask');
  const llmProvider = config.get<string>('llmProvider', 'none');

  // -------------------------------------------------------------------------
  // Step 3: Ask user which CI provider to use
  // -------------------------------------------------------------------------
  let ciProvider: 'github' | 'gitlab';

  if (defaultProvider === 'ask') {
    const picked = await pickCiProvider();
    if (!picked) return; // User cancelled
    ciProvider = picked;
  } else {
    ciProvider = defaultProvider as 'github' | 'gitlab';
  }

  // -------------------------------------------------------------------------
  // Step 4: Ask user about generation mode (AI vs template)
  // -------------------------------------------------------------------------
  const aiAvailable = llmProvider !== 'none';
  const useAi = await pickGenerationMode(aiAvailable);
  if (useAi === null) return; // User cancelled

  // -------------------------------------------------------------------------
  // Step 5: Run scanning + generation with progress indicator
  // -------------------------------------------------------------------------
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Embedded CI/CD Pipeline Architect',
      cancellable: false,
    },
    async (progress) => {
      // --- Scan the project ---
      progress.report({ message: 'Scanning project structure...' });

      const profile = await defaultScannerRegistry.scanProject(folderPath);

      if (profile.projectType === 'unknown') {
        vscode.window.showWarningMessage(
          'Could not detect the project type. Looked for: platformio.ini, CMakeLists.txt, .ino files, sdkconfig.\n\n' +
          'A minimal pipeline will be generated.'
        );
      } else {
        // Show what we found
        vscode.window.showInformationMessage(
          `Detected: ${profile.projectType} project | Board: ${profile.board || 'unknown'} | Platform: ${profile.platform || 'unknown'}`
        );
      }

      // --- Build LLM config if AI mode ---
      let llmConfig: LlmConfig | undefined;
      if (useAi && aiAvailable) {
        llmConfig = buildLlmConfig(config);
      }

      // --- Generate the pipeline ---
      progress.report({ message: `Generating ${ciProvider === 'github' ? 'GitHub Actions' : 'GitLab CI'} pipeline...` });

      // Resolve templates directory — templates are copied to dist/templates/ during build
      const templatesDir = path.join(__dirname, 'templates');

      const generator = createGenerator(ciProvider, llmConfig, templatesDir);
      const result = await generator.generate(profile, useAi);

      // --- Write the file ---
      progress.report({ message: 'Writing pipeline file...' });

      const outputPath = path.join(folderPath, result.relativeFilePath);

      // Check if file already exists
      try {
        await fs.promises.access(outputPath);
        // File exists — ask for confirmation
        const overwrite = await confirmOverwrite(result.relativeFilePath);
        if (!overwrite) return;
      } catch {
        // File doesn't exist — good, create the directory structure
      }

      // Create directories if needed
      const outputDir = path.dirname(outputPath);
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Write the YAML file
      await fs.promises.writeFile(outputPath, result.yamlContent, 'utf-8');

      // --- Open the generated file in the editor ---
      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc, { preview: false });

      // --- Show success message ---
      vscode.window.showInformationMessage(
        `✅ Pipeline generated!\n${result.summary}`,
        'Open File'
      );
    }
  );
}

/**
 * Build LLM configuration from VS Code settings.
 */
function buildLlmConfig(
  config: vscode.WorkspaceConfiguration
): LlmConfig {
  const provider = config.get<'openai' | 'ollama'>('llmProvider', 'openai');

  if (provider === 'ollama') {
    return {
      provider: 'ollama',
      model: config.get<string>('ollamaModel', 'llama3'),
      baseUrl: config.get<string>('ollamaBaseUrl', 'http://localhost:11434'),
      temperature: 0.2,
    };
  }

  return {
    provider: 'openai',
    apiKey: config.get<string>('openaiApiKey', ''),
    model: config.get<string>('openaiModel', 'gpt-4o-mini'),
    temperature: 0.2,
  };
}
