/**
 * =============================================================================
 * AI TYPES — Contracts for the AI/LLM layer
 * =============================================================================
 *
 * DESIGN RATIONALE:
 * The AI layer is abstracted behind interfaces so that:
 * 1. You can swap LLM providers (OpenAI, Ollama, Anthropic) without changing
 *    any other code
 * 2. The template fallback implements the same interface — from the generator's
 *    perspective, it doesn't know (or care) whether AI or templates produced the YAML
 * 3. Testing is easy: just mock this interface
 */

import { ProjectProfile } from '../scanner/types';
import { CiProvider } from '../generator/types';

// ---------------------------------------------------------------------------
// AI Generation Request & Response
// ---------------------------------------------------------------------------

/**
 * What we send to the AI (or template engine) to generate a pipeline.
 */
export interface PipelineGenerationRequest {
  /** The detected project profile */
  profile: ProjectProfile;

  /** Which CI platform to generate for */
  ciProvider: CiProvider;

  /**
   * Optional user instructions to customize the pipeline.
   * Future feature: let users type "also add OTA deployment step" etc.
   */
  customInstructions?: string;
}

/**
 * What the AI (or template engine) returns.
 */
export interface PipelineGenerationResponse {
  /** The generated YAML string */
  yaml: string;

  /** Whether AI was used (vs template fallback) */
  usedAi: boolean;

  /** Optional explanation of choices made (for user education) */
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Pipeline Generator Interface (AI or Template)
// ---------------------------------------------------------------------------

/**
 * IPipelineGenerator is implemented by both the AI orchestrator AND
 * the template fallback. The consumer doesn't need to know which is being used.
 *
 * This is the Liskov Substitution Principle (LSP) in action:
 * any IPipelineGenerator can be used wherever any other is expected.
 */
export interface IPipelineGenerator {
  /** Human-readable name for logging */
  readonly name: string;

  /**
   * Generate pipeline YAML from a project profile.
   * @returns The YAML string and metadata about the generation
   */
  generatePipeline(request: PipelineGenerationRequest): Promise<PipelineGenerationResponse>;
}

// ---------------------------------------------------------------------------
// LLM Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for connecting to an LLM provider.
 * Read from VS Code settings at runtime.
 */
export interface LlmConfig {
  provider: 'openai' | 'ollama';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
}
