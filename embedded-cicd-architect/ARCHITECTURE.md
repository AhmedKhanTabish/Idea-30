# Architecture Deep Dive

This document explains **how** and **why** the extension is built the way it is. Read this to understand the codebase before making changes.

---

## High-Level Data Flow

```
User Right-Clicks Folder
        │
        ▼
┌─────────────────────┐
│  extension.ts       │  ← VS Code entry point, registers commands
│  (activate/deactivate) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  generatePipeline.ts│  ← Command handler: orchestrates the whole flow
│  (commands/)        │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌───────────┐
│QuickPick│ │  Scanner   │  ← Detects project type
│  UI     │ │  Registry  │
└─────────┘ └─────┬─────┘
                  │
          ┌───────┼───────┐───────┐
          ▼       ▼       ▼       ▼
      PlatformIO CMake  ESP-IDF Arduino
      Scanner   Scanner Scanner Scanner
                  │
                  ▼
           ProjectProfile  ← Universal data contract
                  │
                  ▼
         ┌────────────────┐
         │  Generator     │  ← Creates YAML from profile
         │  Factory       │
         └───────┬────────┘
                 │
          ┌──────┴──────┐
          ▼             ▼
    GitHub Actions  GitLab CI
    Generator       Generator
          │             │
          └──────┬──────┘
                 │
          ┌──────┴──────┐
          ▼             ▼
    AI Orchestrator  Template
    (LangChain)      Fallback
          │             │
          └──────┬──────┘
                 │
                 ▼
           YAML Content  → Written to disk → Opened in editor
```

---

## Design Patterns Used

### 1. Strategy Pattern (Scanners)

**Problem:** We need to detect multiple project types, and new ones may be added later.

**Solution:** Each scanner implements the `IProjectScanner` interface:
```typescript
interface IProjectScanner {
  readonly name: string;
  readonly priority: number;
  canScan(folderPath: string): Promise<boolean>;
  scan(folderPath: string): Promise<ProjectProfile>;
}
```

**Why it matters:** Adding a new project type (e.g., Zephyr RTOS) requires:
1. Create `zephyrScanner.ts` implementing `IProjectScanner`
2. Register it in `core/index.ts`
3. Done — zero changes to existing code

### 2. Provider Pattern (Generators)

**Problem:** We need to support multiple CI platforms.

**Solution:** Each CI platform implements `ICiGenerator`:
```typescript
interface ICiGenerator {
  readonly provider: CiProvider;
  readonly displayName: string;
  generate(profile: ProjectProfile, useAi: boolean): Promise<GenerationResult>;
}
```

**Adding Bitbucket Pipelines:** Create `bitbucketGen.ts`, add to `generatorFactory.ts`.

### 3. Chain of Responsibility (Scanner Registry)

**Problem:** Multiple scanners might match the same folder (e.g., PlatformIO generates CMakeLists.txt).

**Solution:** Scanners have priorities. The registry tries them in order (highest first). First match wins.

```
PlatformIO (100) → ESP-IDF (75) → CMake (50) → Arduino (25)
```

### 4. Factory Method (Generator Factory)

**Problem:** The command handler shouldn't know about concrete generator classes.

**Solution:** `createGenerator('github')` returns the right instance. The caller only knows about the `ICiGenerator` interface.

### 5. Liskov Substitution (AI/Template)

**Problem:** AI generation might fail or be unavailable.

**Solution:** Both `AiOrchestrator` and `TemplateFallbackGenerator` implement `IPipelineGenerator`. The generator can use either one interchangeably.

---

## Key Files Explained

### `src/core/scanner/types.ts`
The **foundation** of the entire system. Defines `ProjectProfile` — the universal data contract that decouples scanning from generation. Every scanner produces one, every generator consumes one.

### `src/core/scanner/scannerRegistry.ts`
The **brain** of project detection. Manages scanners, tries them in priority order, handles errors gracefully.

### `src/core/ai/templateFallback.ts`
The **safety net**. Reads YAML templates from the `templates/` directory, replaces `{{placeholders}}` with values from the ProjectProfile. Always works, no external dependencies.

### `src/core/ai/aiOrchestrator.ts`
The **smart layer**. Uses LangChain to send the ProjectProfile to an LLM for intelligent YAML generation. Falls back to templates on failure.

### `src/commands/generatePipeline.ts`
The **orchestrator**. Wires together scanning → generation → file writing → editor display. This is where you'd add new steps to the pipeline.

---

## How Templates Work

Templates live in `templates/{github,gitlab}/` and use simple placeholder syntax:

```yaml
# Simple value replacement
environment: [{{environments}}]
idf.py set-target {{board}}

# Loop expansion (for GitLab CI)
{{#each environments}}
build:{{this}}:
  script: pio run -e {{this}}
{{/each}}
```

The `TemplateFallbackGenerator.fillTemplate()` method handles the replacement.

---

## How AI Generation Works

1. **Prompt Construction** (`prompts.ts`): A system prompt establishes the LLM's role + constraints. The user prompt includes the serialized ProjectProfile.

2. **LLM Call** (`aiOrchestrator.ts`): LangChain sends the messages to OpenAI or Ollama.

3. **Response Cleaning**: Strip markdown code fences the LLM might add.

4. **Validation**: Ensure the response isn't empty/too short.

5. **Fallback**: On any error → use template generation instead.

---

## Scalability Roadmap

| Feature | Difficulty | What to modify |
|---------|-----------|----------------|
| Add Zephyr scanner | Easy | New file + 1 line registration |
| Add Bitbucket Pipelines | Easy | New generator + factory case |
| Add CircleCI | Easy | New generator + factory case |
| CLI tool (no VS Code) | Medium | Import `core/` into new CLI entry point |
| Web API | Medium | Import `core/` into Express/Fastify server |
| Custom user templates | Medium | Add template directory config + file watcher |
| Multi-step AI agent | Hard | Extend AiOrchestrator with LangChain agents |
