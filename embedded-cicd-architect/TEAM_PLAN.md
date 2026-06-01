# 🚀 3-Developer Simultaneous Execution Plan

This guide outlines exactly how you and your two friends will build the **Embedded CI/CD Pipeline Architect** simultaneously. It is divided into 4 clear phases with explicit file-level responsibilities, function signatures, input/output contracts, and testing steps for each developer.

---

## 📅 Roadmap Overview

```mermaid
gantt
    title Embedded CI/CD Architect Dev Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Contracts
    Define Shared Interfaces       :active, p1, 2026-06-01, 1d
    section Phase 2: Core Dev
    Dev 1: Scanners & Parsers       :crit, p2_d1, after p1, 3d
    Dev 2: Static Templates & Fallbacks :crit, p2_d2, after p1, 3d
    Dev 3: VS Code Host & Menus     :crit, p2_d3, after p1, 3d
    section Phase 3: Integration
    Dev 3: Wire LangChain & Prompts :p3_d3, after p2_d3, 2d
    Dev 2: Connect Generators       :p3_d2, after p2_d2, 2d
    Dev 1: Refine & Parse Headers   :p3_d1, after p2_d1, 2d
    section Phase 4: Testing & Polish
    End-to-End Verification         :active, p4, after p3_d3, 1d
```

---

## 🔑 The Single Source of Truth: The Data Contract
Before starting, all three developers must agree on the `ProjectProfile` object inside [src/core/scanner/types.ts](file:///e:/Rosenheim/Studies/Programming/Ideas/Idea%2030/embedded-cicd-architect/src/core/scanner/types.ts). This is the bridge between Developer 1 (Scanner), Developer 2 (Generator), and Developer 3 (AI/UI).

```typescript
export interface ProjectProfile {
  projectType: 'platformio' | 'cmake' | 'arduino' | 'esp-idf' | 'unknown';
  platform: string;           // e.g. 'espressif32', 'ststm32'
  board: string;              // e.g. 'esp32dev', 'nucleo_f446ze'
  framework: string;          // e.g. 'arduino', 'espidf', 'stm32cube'
  environments: string[];     // e.g. ['esp32_dev', 'esp32_prod']
  libraries: string[];        // e.g. ['Adafruit SSD1306', 'SPI']
  testFramework: string;      // e.g. 'unity', 'googletest', 'none'
  buildSystem: string;        // e.g. 'pio', 'cmake', 'idf.py'
  sourceFiles: string[];      // e.g. ['src/main.cpp', 'include/config.h']
  extraConfig: Record<string, unknown>; // Extensible metadata bucket
}
```

---

## 🧑‍💻 Developer 1: The Scanner Architect (Detection Layer)

### Phase 1: Shared Interfaces Setup (Day 1)
*   **Goal**: Define standard structures so your teammates can write mock data immediately.
*   **Tasks**:
    1.  Create `src/core/scanner/types.ts`.
    2.  Define `IProjectScanner` and `ProjectProfile` interfaces.
    3.  Create a blank stub function `createEmptyProfile()`.

### Phase 2: Dynamic Scanner Infrastructure & Platforms (Days 2-4)
*   **Goal**: Create a pluggable architecture and start writing platform scanners.
*   **Tasks**:
    1.  **Scanner Registry (`scannerRegistry.ts`)**:
        *   Implement `ScannerRegistry` class with a `register(scanner: IProjectScanner)` method.
        *   Keep scanners sorted in a list descending by `priority` (PlatformIO: 100, ESP-IDF: 75, CMake: 50, Arduino: 25).
        *   Implement `scanProject(folderPath: string)`: cycle through scanners, return the first scanner whose `canScan()` returns `true`.
    2.  **PlatformIO Scanner (`platformioScanner.ts`)**:
        *   `canScan`: Check if `platformio.ini` exists.
        *   `scan`: Parse the INI format (using the `ini` npm package). Extract environment blocks `[env:*]`, platform properties, libraries (`lib_deps`), and custom configurations.
    3.  **CMake Scanner (`cmakeScanner.ts`)**:
        *   `canScan`: Check if `CMakeLists.txt` exists.
        *   `scan`: Read raw text. Use regular expressions to extract `project()`, compiler tags (`arm-none-eabi`), and library dependencies (`target_link_libraries`).

### Phase 3: Hardware Signature Parsing (Days 5-6)
*   **Goal**: Build scanners for loose/unstructured projects.
*   **Tasks**:
    1.  **ESP-IDF Scanner (`espIdfScanner.ts`)**:
        *   Check for `sdkconfig` or `sdkconfig.defaults`.
        *   Extract `CONFIG_IDF_TARGET` (defines the chip type, e.g. `esp32s3` or `esp32c3`).
    2.  **Arduino Scanner (`arduinoScanner.ts`)**:
        *   Check for `.ino` files in the directory root.
        *   Create a keyword dictionary for `#include` analysis (e.g. if including `<ESP8266WiFi.h>`, assign platform as `espressif8266`).
        *   Search for `.vscode/arduino.json` configurations to grab the exact board target FQBN identifier if the user has configured the VS Code Arduino extension.

### Phase 4: Unit Testing & Polish (Day 7)
*   **Goal**: Guarantee scanners are bulletproof.
*   **Tasks**:
    1.  Write a unit test file `src/test/suite/scanner.test.ts`.
    2.  Mock sample directory files (mock `platformio.ini` text strings) and call scanners against them to confirm they output correct `ProjectProfile` shapes.

---

## 🧑‍💻 Developer 2: The Workflow Designer (CI/CD & Templates)

### Phase 1: CI/CD Target Definitions (Day 1)
*   **Goal**: Create output blueprints and interfaces.
*   **Tasks**:
    1.  Create `src/core/generator/types.ts`.
    2.  Define `GenerationResult` (holds generated YAML string, target write-path, and engine type) and `ICiGenerator` interface.

### Phase 2: Static YAML Blueprints (Days 2-4)
*   **Goal**: Curate best-practice pipelines for GitHub Actions and GitLab CI.
*   **Tasks**:
    1.  Write the base templates inside `templates/github/` and `templates/gitlab/`:
        *   `platformio.yml` (Includes multi-environment cache layers, automated testing matrices, and binary size checkers).
        *   `cmake-stm32.yml` (Installs GCC ARM compiler on the runner, configures build toolchains, compiles, and captures size metrics).
        *   `cmake-esp-idf.yml` (Spins up Espressif's official Docker container, configures build environments, compiles, and extracts binary logs).

### Phase 3: Engine Substitutions & Factory (Days 5-6)
*   **Goal**: Program the variable injector to parse static templates offline.
*   **Tasks**:
    1.  **Template Fallback Engine (`templateFallback.ts`)**:
        *   Write a class implementing `IPipelineGenerator`.
        *   Use simple double-bracket replacements (`{{board}}`, `{{framework}}`).
        *   Add loop syntax like `{{#each environments}}` block parser to duplicate lines for matrix-less platforms like GitLab CI.
    2.  **Factory Registry (`generatorFactory.ts`)**:
        *   Create a factory function `createGenerator(provider: 'github' | 'gitlab')` which instantiates and returns correct generator classes.

### Phase 4: Pipeline Linting & Compilation Checks (Day 7)
*   **Goal**: Validate the generated YAML builds.
*   **Tasks**:
    1.  Write tests verifying that when a mock `ProjectProfile` is sent to your generator, it successfully maps variables, inserts default fallbacks, and outputs structurally valid YAML.

---

## 🧑‍💻 Developer 3: The Integration & AI Engineer (VS Code UI & LLM)

### Phase 1: Workspace Scaffolding (Day 1)
*   **Goal**: Configure project dependencies, bundling configurations, and workspace settings.
*   **Tasks**:
    1.  Set up `package.json`, configuring menus (`explorer/context` on folders), commands, and user configurations (API keys, models).
    2.  Create `esbuild.js` compiler configurations. Set up a plugin hook to copy static templates from `src/` into the `dist/` production bundle directory on every build.

### Phase 2: VS Code Menu Systems & Flows (Days 2-4)
*   **Goal**: Build the user-facing command-line menus and loaders.
*   **Tasks**:
    1.  **Interactive QuickPicks (`src/ui/quickPick.ts`)**:
        *   Write menus for CI platform choice (GitHub/GitLab).
        *   Write confirmations for files that already exist (preventing accidental overwrites).
    2.  **Command Orchestrator (`src/commands/generatePipeline.ts`)**:
        *   Get the folder URI context from VS Code explorer when right-clicked.
        *   Spin up VS Code native `window.withProgress` loaders.
        *   Import `defaultScannerRegistry` and feed the folder path to it, getting `ProjectProfile` back.
        *   Call generators, write output YAML files to disk, and open them in the active editor.

### Phase 3: LangChain & AI Framework (Days 5-6)
*   **Goal**: Connect LLM provider endpoints and design prompts.
*   **Tasks**:
    1.  **Prompt Engineering (`src/core/ai/prompts.ts`)**:
        *   Design systemic instruction guides mapping rules for CI generation.
        *   Form user prompt templates injecting the `ProjectProfile` JSON details.
    2.  **AI Orchestrator (`src/core/ai/aiOrchestrator.ts`)**:
        *   Configure LangChain wrappers `ChatOpenAI` and `ChatOllama` (local inference support).
        *   Call models asynchronously, clean markdown code blocks (e.g. ` ```yaml `) out of response content, and route errors to use Developer 2's templates instead.

### Phase 4: Extension Launch & Dev Tests (Day 7)
*   **Goal**: End-to-end integration debugger.
*   **Tasks**:
    1.  Add launch tasks inside `.vscode/launch.json` and `tasks.json`.
    2.  Launch host (`F5`), test right-clicking PlatformIO folders, evaluate generation latency, and format documentation in the codebase.

---

## 🏁 Phase 4 Dev Check: Inter-Developer Collaboration Matrix

```
┌────────────────────────────────────────────────────────┐
│                        DAY 1                           │
│  Dev 1, Dev 2, and Dev 3 sit down and freeze           │
│  the ProjectProfile structure inside core/scanner/types│
└──────────────────────────┬─────────────────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      ▼                    ▼                    ▼
┌───────────┐        ┌───────────┐        ┌───────────┐
│   DEV 1   │        │   DEV 2   │        │   DEV 3   │
│ Scanners  │        │ Templates │        │ UI / AI   │
└─────┬─────┘        └─────┬─────┘        └─────┬─────┘
      │                    │                    │
      └────────────────────┼────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│                        DAY 5                           │
│  Integration: Dev 3 hooks Dev 1's Scanner output into  │
│  Dev 2's Generator engine using the F5 launch suite    │
└────────────────────────────────────────────────────────┘
```
