/**
 * =============================================================================
 * GENERATOR FACTORY — Creates the right CI generator based on user selection
 * =============================================================================
 *
 * DESIGN PATTERN: Factory Method
 * Instead of the caller knowing about GitHubActionsGenerator and GitLabCiGenerator,
 * it just calls createGenerator('github') and gets the right one.
 *
 * ADDING A NEW CI PROVIDER:
 * 1. Create a new generator class implementing ICiGenerator
 * 2. Add a case to the switch statement below
 * 3. Add the provider to the CiProvider type in types.ts
 */

import { CiProvider, ICiGenerator } from './types';
import { GitHubActionsGenerator } from './githubActionsGen';
import { GitLabCiGenerator } from './gitlabCiGen';
import { LlmConfig } from '../ai/types';

/**
 * Create a CI generator for the specified provider.
 *
 * @param provider - Which CI platform to generate for
 * @param llmConfig - LLM configuration (if AI mode is enabled)
 * @param templatesDir - Path to the templates directory
 * @returns The appropriate generator instance
 */
export function createGenerator(
  provider: CiProvider,
  llmConfig?: LlmConfig,
  templatesDir?: string
): ICiGenerator {
  switch (provider) {
    case 'github':
      return new GitHubActionsGenerator(llmConfig, templatesDir);
    case 'gitlab':
      return new GitLabCiGenerator(llmConfig, templatesDir);
    default:
      throw new Error(`Unknown CI provider: ${provider}. Supported: github, gitlab`);
  }
}
