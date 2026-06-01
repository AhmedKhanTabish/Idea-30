/**
 * =============================================================================
 * AI ORCHESTRATOR — LangChain-powered pipeline generation
 * =============================================================================
 *
 * HOW THE AI PIPELINE WORKS:
 * 1. Receive a ProjectProfile (from the scanner)
 * 2. Build a prompt with the project details + CI/CD best practices
 * 3. Send to the configured LLM (OpenAI or Ollama)
 * 4. Validate the response is parseable YAML
 * 5. If AI fails, fall back to TemplateFallbackGenerator
 *
 * LANGCHAIN OVERVIEW (for learning):
 * LangChain is a framework for building LLM-powered applications.
 * Key concepts used here:
 * - ChatOpenAI: Wrapper around OpenAI's chat API
 * - ChatOllama: Wrapper for local Ollama models
 * - SystemMessage + HumanMessage: The conversation sent to the LLM
 */

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
  IPipelineGenerator,
  PipelineGenerationRequest,
  PipelineGenerationResponse,
  LlmConfig,
} from './types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { TemplateFallbackGenerator } from './templateFallback';

export class AiOrchestrator implements IPipelineGenerator {
  readonly name = 'AI Orchestrator';
  private llmConfig: LlmConfig;
  private fallback: TemplateFallbackGenerator;

  constructor(llmConfig: LlmConfig, templatesDir?: string) {
    this.llmConfig = llmConfig;
    this.fallback = new TemplateFallbackGenerator(templatesDir);
  }

  async generatePipeline(
    request: PipelineGenerationRequest
  ): Promise<PipelineGenerationResponse> {
    try {
      // Step 1: Create the LLM client based on provider config
      const llm = this.createLlm();

      // Step 2: Build the prompt
      const profileJson = JSON.stringify(
        {
          projectType: request.profile.projectType,
          platform: request.profile.platform,
          board: request.profile.board,
          framework: request.profile.framework,
          environments: request.profile.environments,
          libraries: request.profile.libraries,
          testFramework: request.profile.testFramework,
          buildSystem: request.profile.buildSystem,
          sourceFileCount: request.profile.sourceFiles.length,
        },
        null,
        2
      );

      const userPrompt = buildUserPrompt(profileJson, request.ciProvider);

      // Step 3: Call the LLM
      console.log('[AiOrchestrator] Sending request to LLM...');
      const response = await llm.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      // Step 4: Extract and clean the YAML from the response
      let yaml = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Remove markdown code fences if the LLM added them
      yaml = yaml.replace(/^```ya?ml\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      yaml = yaml.trim();

      // Step 5: Validate it's not empty
      if (!yaml || yaml.length < 20) {
        throw new Error('LLM returned empty or too-short YAML');
      }

      return {
        yaml,
        usedAi: true,
        reasoning: 'Generated using AI analysis of your project structure.',
      };
    } catch (error) {
      // Step 6: Fall back to template generation on any AI failure
      console.warn('[AiOrchestrator] AI generation failed, using template fallback:', error);
      const fallbackResult = await this.fallback.generatePipeline(request);
      fallbackResult.reasoning =
        `AI generation failed (${error instanceof Error ? error.message : 'unknown error'}). ` +
        `Fell back to template-based generation.`;
      return fallbackResult;
    }
  }

  /**
   * Create the appropriate LangChain LLM client.
   *
   * LANGCHAIN PROVIDER PATTERN:
   * - ChatOpenAI works for both OpenAI and Ollama (Ollama exposes an
   *   OpenAI-compatible API). We just change the baseURL.
   * - This means adding new providers is straightforward.
   */
  private createLlm(): ChatOpenAI {
    if (this.llmConfig.provider === 'ollama') {
      // Ollama exposes an OpenAI-compatible API at /v1
      return new ChatOpenAI({
        model: this.llmConfig.model,
        temperature: this.llmConfig.temperature ?? 0.2,
        configuration: {
          baseURL: `${this.llmConfig.baseUrl || 'http://localhost:11434'}/v1`,
        },
        apiKey: 'ollama', // Ollama doesn't need a real key
      });
    }

    // Default: OpenAI
    return new ChatOpenAI({
      model: this.llmConfig.model,
      temperature: this.llmConfig.temperature ?? 0.2,
      apiKey: this.llmConfig.apiKey,
    });
  }
}
