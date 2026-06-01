/**
 * =============================================================================
 * TEMPLATE FALLBACK — Deterministic YAML generation without any LLM
 * =============================================================================
 *
 * WHY THIS EXISTS:
 * 1. Not everyone has (or wants to pay for) an LLM API key
 * 2. Templates are 100% deterministic — same input always gives same output
 * 3. Acts as a safety net: if the LLM fails, we fall back here
 * 4. The generated YAML is still production-quality (handcrafted templates)
 *
 * HOW IT WORKS:
 * 1. Select the right template based on projectType + ciProvider
 * 2. Replace {{placeholders}} with actual values from the ProjectProfile
 * 3. Return the filled-in YAML
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  IPipelineGenerator,
  PipelineGenerationRequest,
  PipelineGenerationResponse,
} from './types';

// ---------------------------------------------------------------------------
// Template file paths — maps (projectType, ciProvider) → template file
// ---------------------------------------------------------------------------
const TEMPLATE_MAP: Record<string, Record<string, string>> = {
  github: {
    platformio: 'github/platformio.yml',
    cmake: 'github/cmake-stm32.yml',
    'esp-idf': 'github/cmake-esp-idf.yml',
    arduino: 'github/platformio.yml', // Arduino uses PIO template with adjustments
  },
  gitlab: {
    platformio: 'gitlab/platformio.yml',
    cmake: 'gitlab/cmake-stm32.yml',
    'esp-idf': 'gitlab/cmake-esp-idf.yml',
    arduino: 'gitlab/platformio.yml',
  },
};

export class TemplateFallbackGenerator implements IPipelineGenerator {
  readonly name = 'Template Fallback Generator';
  private templatesDir: string;

  /**
   * @param templatesDir - Absolute path to the templates/ directory.
   *   At runtime, this is resolved relative to the extension's install location.
   */
  constructor(templatesDir?: string) {
    // Default: templates/ directory alongside the bundled extension.js in dist/
    this.templatesDir = templatesDir || path.join(__dirname, 'templates');
  }

  async generatePipeline(
    request: PipelineGenerationRequest
  ): Promise<PipelineGenerationResponse> {
    const { profile, ciProvider } = request;

    // Step 1: Select the right template
    const templatePath = this.resolveTemplatePath(profile.projectType, ciProvider);

    let yaml: string;

    if (templatePath) {
      // Step 2: Read and fill the template
      try {
        const raw = await fs.promises.readFile(templatePath, 'utf-8');
        yaml = this.fillTemplate(raw, profile);
      } catch (err) {
        // Template file not found — generate a minimal fallback
        console.warn(`[TemplateFallback] Template not found: ${templatePath}`, err);
        yaml = this.generateMinimalPipeline(profile, ciProvider);
      }
    } else {
      // No template mapped for this project type
      yaml = this.generateMinimalPipeline(profile, ciProvider);
    }

    return {
      yaml,
      usedAi: false,
      reasoning: `Generated using the ${profile.projectType} template for ${ciProvider}. No AI was used — this is a deterministic output based on your project structure.`,
    };
  }

  /**
   * Resolve the absolute path to the correct template file.
   */
  private resolveTemplatePath(
    projectType: string,
    ciProvider: string
  ): string | null {
    const providerTemplates = TEMPLATE_MAP[ciProvider];
    if (!providerTemplates) return null;

    const templateFile = providerTemplates[projectType];
    if (!templateFile) return null;

    return path.join(this.templatesDir, templateFile);
  }

  /**
   * Replace {{placeholders}} in the template with actual values.
   *
   * Supported placeholders:
   * - {{environments}} → comma-separated list of env names
   * - {{board}} → board identifier
   * - {{platform}} → platform identifier
   * - {{framework}} → framework name
   * - {{toolchainFile}} → path to CMake toolchain file
   * - {{#each environments}}...{{this}}...{{/each}} → loop expansion
   */
  private fillTemplate(template: string, profile: import('../scanner/types').ProjectProfile): string {
    let result = template;

    // Simple replacements
    const envList = profile.environments.length > 0
      ? profile.environments.join(', ')
      : 'default';

    result = result.replace(/\{\{environments\}\}/g, envList);
    result = result.replace(/\{\{board\}\}/g, profile.board || 'esp32');
    result = result.replace(/\{\{platform\}\}/g, profile.platform || 'unknown');
    result = result.replace(/\{\{framework\}\}/g, profile.framework || 'arduino');
    result = result.replace(
      /\{\{toolchainFile\}\}/g,
      (profile.extraConfig.toolchainFile as string) || 'cmake/toolchain.cmake'
    );

    // Handle {{#each environments}} ... {{this}} ... {{/each}} blocks
    const eachRegex = /\{\{#each environments\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, (_match, blockTemplate) => {
      const envs = profile.environments.length > 0 ? profile.environments : ['default'];
      return envs
        .map((env: string) => (blockTemplate as string).replace(/\{\{this\}\}/g, env))
        .join('\n');
    });

    return result;
  }

  /**
   * Generate a minimal, generic pipeline when no specific template exists.
   * This ensures we ALWAYS produce something usable.
   */
  private generateMinimalPipeline(
    profile: import('../scanner/types').ProjectProfile,
    ciProvider: string
  ): string {
    if (ciProvider === 'github') {
      return `# Generated by Embedded CI/CD Pipeline Architect
# Project type: ${profile.projectType} | Board: ${profile.board || 'unknown'}
name: Embedded CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build project
        run: |
          echo "TODO: Add build commands for your ${profile.projectType} project"
          echo "Board: ${profile.board || 'unknown'}"
          echo "Platform: ${profile.platform || 'unknown'}"
`;
    } else {
      return `# Generated by Embedded CI/CD Pipeline Architect
# Project type: ${profile.projectType} | Board: ${profile.board || 'unknown'}
stages:
  - build

build:
  stage: build
  image: ubuntu:latest
  script:
    - echo "TODO: Add build commands for your ${profile.projectType} project"
`;
    }
  }
}
