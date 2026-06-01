# Contributing Guide

Want to add support for a new project type or CI platform? This guide walks you through it.

---

## Adding a New Project Scanner

**Example: Adding a Zephyr RTOS scanner**

### Step 1: Create the scanner file

Create `src/core/scanner/zephyrScanner.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { IProjectScanner, ProjectProfile, createEmptyProfile } from './types';

export class ZephyrScanner implements IProjectScanner {
  readonly name = 'Zephyr Scanner';
  readonly priority = 60; // Between ESP-IDF (75) and CMake (50)

  async canScan(folderPath: string): Promise<boolean> {
    // Zephyr projects have a prj.conf file
    try {
      await fs.promises.access(path.join(folderPath, 'prj.conf'));
      return true;
    } catch {
      return false;
    }
  }

  async scan(folderPath: string): Promise<ProjectProfile> {
    const profile = createEmptyProfile();
    profile.projectType = 'zephyr';
    profile.buildSystem = 'west';
    profile.framework = 'zephyr';
    // ... parse prj.conf and CMakeLists.txt for board info
    return profile;
  }
}
```

### Step 2: Register it

In `src/core/index.ts`, add one line to `initializeDefaultScanners()`:

```typescript
import { ZephyrScanner } from './scanner/zephyrScanner';

export function initializeDefaultScanners(): void {
  // ... existing scanners ...
  defaultScannerRegistry.register(new ZephyrScanner()); // Priority 60
}
```

### Step 3: Add the type

In `src/core/scanner/types.ts`, add `'zephyr'` to the `ProjectType` union (already reserved).

### Step 4: Add templates

Create `templates/github/zephyr.yml` and `templates/gitlab/zephyr.yml`.

Update the `TEMPLATE_MAP` in `src/core/ai/templateFallback.ts`.

That's it! The rest of the system (generators, AI, UI) automatically picks up the new scanner.

---

## Adding a New CI Provider

**Example: Adding Bitbucket Pipelines**

### Step 1: Create the generator

Create `src/core/generator/bitbucketGen.ts` implementing `ICiGenerator`.

### Step 2: Register in factory

In `generatorFactory.ts`, add a case:

```typescript
case 'bitbucket':
  return new BitbucketPipelinesGenerator(llmConfig, templatesDir);
```

### Step 3: Update the type

Add `'bitbucket'` to `CiProvider` in `src/core/generator/types.ts`.

### Step 4: Add UI option

Add a new QuickPick item in `src/ui/quickPick.ts`.

---

## Code Style

- Use TypeScript strict mode
- Document all public interfaces with JSDoc
- Include inline comments explaining **why**, not just what
- Follow the existing patterns (Strategy, Factory, etc.)

## Testing

Run tests with:
```bash
npm test
```

When adding a scanner, create a test folder in `src/test/fixtures/` with sample project files, then write tests that verify your scanner produces the correct `ProjectProfile`.
