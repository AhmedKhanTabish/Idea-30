# Embedded CI/CD Pipeline Architect

> **Right-click any embedded project folder → Generate a production-ready CI/CD pipeline in seconds.**

A VS Code extension that analyzes your embedded firmware project (PlatformIO, CMake, Arduino, ESP-IDF) and generates a complete GitHub Actions or GitLab CI pipeline for linting, cross-compilation, and testing.

---

## ✨ Features

- 🔍 **Smart Project Detection** — Automatically identifies PlatformIO, CMake, Arduino, and ESP-IDF projects
- 🤖 **AI-Enhanced Generation** — Uses LLM (OpenAI or local Ollama) for intelligent, project-specific pipelines
- 📋 **Template Fallback** — Works completely offline without any API key
- 🏗️ **GitHub Actions & GitLab CI** — Generates for either platform
- ⚡ **Matrix Builds** — Automatically creates parallel builds for multi-environment PlatformIO projects
- 📦 **Firmware Artifacts** — Uploads compiled binaries as downloadable artifacts
- 🧪 **Test Integration** — Detects and configures test stages (Unity, GoogleTest, PlatformIO Test)

---

## 🚀 Quick Start

### 1. Install the Extension
Press `F5` in the extension development workspace to launch a test instance of VS Code.

### 2. Open an Embedded Project
Open any folder containing a PlatformIO, CMake, Arduino, or ESP-IDF project.

### 3. Generate Your Pipeline
Right-click the project folder in the Explorer sidebar → **"Generate CI/CD Pipeline"**

### 4. Choose Your Options
- Select **GitHub Actions** or **GitLab CI**
- Choose **AI-Enhanced** (requires API key) or **Template-Based** (works offline)

### 5. Done!
The extension writes the pipeline file and opens it in the editor. Commit and push!

---

## ⚙️ Configuration

Open VS Code Settings (`Ctrl+,`) and search for "Embedded CI/CD":

| Setting | Default | Description |
|---------|---------|-------------|
| `embeddedCicd.llmProvider` | `none` | LLM provider: `openai`, `ollama`, or `none` (template only) |
| `embeddedCicd.openaiApiKey` | `""` | Your OpenAI API key |
| `embeddedCicd.openaiModel` | `gpt-4o-mini` | OpenAI model to use |
| `embeddedCicd.ollamaBaseUrl` | `http://localhost:11434` | Ollama server URL |
| `embeddedCicd.ollamaModel` | `llama3` | Ollama model to use |
| `embeddedCicd.defaultCiProvider` | `ask` | Default CI platform (`ask`, `github`, `gitlab`) |

---

## 🔧 Supported Project Types

| Project Type | Detection File | Build Command | Priority |
|-------------|---------------|---------------|----------|
| PlatformIO | `platformio.ini` | `pio run` | 100 (highest) |
| ESP-IDF | `sdkconfig` | `idf.py build` | 75 |
| CMake | `CMakeLists.txt` | `cmake --build` | 50 |
| Arduino | `.ino` files | `arduino-cli` | 25 (lowest) |

---

## 📂 Project Structure

```
src/
├── extension.ts              # VS Code entry point
├── commands/
│   └── generatePipeline.ts   # Main command handler
├── ui/
│   └── quickPick.ts          # User interaction helpers
└── core/                     # Standalone engine (no VS Code deps)
    ├── scanner/              # Project detection
    ├── generator/            # CI/CD YAML generation
    ├── ai/                   # LLM integration
    └── index.ts              # Public API
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a deep dive into how it all works.

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add new project scanners and CI providers.

---

## 📄 License

MIT
