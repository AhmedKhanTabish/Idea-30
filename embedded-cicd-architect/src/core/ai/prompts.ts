/**
 * =============================================================================
 * PROMPTS — System prompts and templates for the LLM
 * =============================================================================
 *
 * WHY SEPARATE PROMPTS?
 * Prompt engineering is iterative — you'll tweak these constantly.
 * Having them in a dedicated file makes that easy without touching logic code.
 */

/**
 * System prompt that establishes the LLM's role and constraints.
 * This is sent as the "system" message in every LLM call.
 */
export const SYSTEM_PROMPT = `You are an expert embedded systems CI/CD engineer. Your task is to generate production-ready CI/CD pipeline YAML files for embedded firmware projects.

RULES:
1. Output ONLY valid YAML — no markdown, no explanations, no code fences.
2. Include helpful inline comments (using #) explaining each step.
3. Always include these stages: lint, build, test (even if test is a placeholder).
4. Use caching aggressively to speed up builds.
5. Use matrix builds when multiple environments/boards are detected.
6. Upload compiled firmware as artifacts with 30-day retention.
7. Use the latest stable versions of actions/tools.

BEST PRACTICES:
- For PlatformIO: use \`pio run -e <env>\` and \`pio test\`
- For CMake + STM32: install gcc-arm-none-eabi, use cmake -B build + cmake --build
- For ESP-IDF: use the official espressif/idf Docker image
- Always show binary size after build (helps catch bloat)
- Always lint before building (fail fast)`;

/**
 * Generates the user prompt with project profile details.
 * The LLM sees the project profile and generates appropriate YAML.
 */
export function buildUserPrompt(
  profileJson: string,
  ciProvider: 'github' | 'gitlab'
): string {
  const providerName = ciProvider === 'github' ? 'GitHub Actions' : 'GitLab CI';

  return `Generate a complete ${providerName} CI/CD pipeline YAML for the following embedded project:

PROJECT PROFILE:
${profileJson}

Requirements:
- Target CI platform: ${providerName}
- Include lint, build, and test stages
- Use caching for build tools and dependencies
- Upload compiled firmware as artifacts
- Add comments explaining each step for developers learning CI/CD

Output ONLY the YAML content. No explanations, no markdown fences.`;
}
