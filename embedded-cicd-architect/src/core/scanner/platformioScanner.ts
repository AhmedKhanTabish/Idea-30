/**
 * =============================================================================
 * PLATFORMIO SCANNER — Detects and parses PlatformIO projects
 * =============================================================================
 *
 * DETECTION: Looks for `platformio.ini` in the project root.
 *
 * PARSING:
 * PlatformIO uses INI-style config files. Each [env:NAME] section defines
 * a build target. We parse these sections to extract:
 * - platform (espressif32, ststm32, atmelavr, etc.)
 * - board (esp32dev, nucleo_f446ze, d1_mini, etc.)
 * - framework (arduino, espidf, stm32cube, etc.)
 * - lib_deps (libraries the project depends on)
 * - test_framework (unity, googletest, etc.)
 *
 * WHY HIGHEST PRIORITY (100)?
 * PlatformIO projects are the most structured and give us the richest data.
 * A PlatformIO project might also contain CMakeLists.txt (PlatformIO generates
 * them internally), so we want to detect PlatformIO BEFORE CMake.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';
import { IProjectScanner, ProjectProfile, createEmptyProfile } from './types';

export class PlatformIOScanner implements IProjectScanner {
  readonly name = 'PlatformIO Scanner';
  readonly priority = 100; // Highest priority — most specific detection

  /**
   * Quick check: does platformio.ini exist in this folder?
   */
  async canScan(folderPath: string): Promise<boolean> {
    const iniPath = path.join(folderPath, 'platformio.ini');
    try {
      await fs.promises.access(iniPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Full scan: parse platformio.ini and extract all build information.
   *
   * STRATEGY:
   * 1. Read and parse the INI file
   * 2. Find all [env:*] sections (these are build environments)
   * 3. Extract platform, board, framework from each environment
   * 4. Parse lib_deps to find library dependencies
   * 5. Scan the src/ directory for source files
   */
  async scan(folderPath: string): Promise<ProjectProfile> {
    const profile = createEmptyProfile();
    profile.projectType = 'platformio';
    profile.buildSystem = 'pio';

    // -----------------------------------------------------------------------
    // Step 1: Read and parse platformio.ini
    // -----------------------------------------------------------------------
    const iniPath = path.join(folderPath, 'platformio.ini');
    const iniContent = await fs.promises.readFile(iniPath, 'utf-8');
    const parsed = ini.parse(iniContent);

    // -----------------------------------------------------------------------
    // Step 2: Extract environments (sections named [env:something])
    // -----------------------------------------------------------------------
    // In the parsed INI, sections become nested objects.
    // [env:esp32dev] becomes parsed['env:esp32dev']
    const envKeys = Object.keys(parsed).filter(key => key.startsWith('env:'));
    profile.environments = envKeys.map(key => key.replace('env:', ''));

    // Also check the base [env] section (shared config)
    const baseEnv = parsed['env'] || {};

    // -----------------------------------------------------------------------
    // Step 3: Extract platform, board, framework from first env
    // (if multiple envs exist, we use the first one as the "primary")
    // -----------------------------------------------------------------------
    if (envKeys.length > 0) {
      const primaryEnv = parsed[envKeys[0]] || {};
      profile.platform = primaryEnv.platform || baseEnv.platform || '';
      profile.board = primaryEnv.board || baseEnv.board || '';
      profile.framework = primaryEnv.framework || baseEnv.framework || '';

      // Store all environment details in extraConfig for the generator
      profile.extraConfig.environments = envKeys.map(key => ({
        name: key.replace('env:', ''),
        ...parsed[key],
      }));
    } else {
      // Fallback to base [env] section
      profile.platform = baseEnv.platform || '';
      profile.board = baseEnv.board || '';
      profile.framework = baseEnv.framework || '';
    }

    // -----------------------------------------------------------------------
    // Step 4: Parse library dependencies (lib_deps)
    // lib_deps can be a multiline string in INI:
    //   lib_deps =
    //     Wire
    //     SPI
    //     adafruit/Adafruit SSD1306
    // -----------------------------------------------------------------------
    const primaryEnvObj = envKeys.length > 0 ? parsed[envKeys[0]] : baseEnv;
    const libDepsRaw = primaryEnvObj?.lib_deps || baseEnv?.lib_deps || '';

    if (typeof libDepsRaw === 'string' && libDepsRaw.trim()) {
      profile.libraries = libDepsRaw
        .split('\n')
        .map((lib: string) => lib.trim())
        .filter((lib: string) => lib.length > 0 && !lib.startsWith('#'));
    }

    // -----------------------------------------------------------------------
    // Step 5: Detect test framework
    // -----------------------------------------------------------------------
    const testFramework = primaryEnvObj?.test_framework || baseEnv?.test_framework;
    if (testFramework) {
      profile.testFramework = testFramework;
    }

    // Check if test/ directory exists (PlatformIO convention)
    const testDir = path.join(folderPath, 'test');
    try {
      const testStat = await fs.promises.stat(testDir);
      if (testStat.isDirectory()) {
        profile.extraConfig.hasTestDir = true;
        if (profile.testFramework === 'none') {
          profile.testFramework = 'unity'; // PlatformIO default test framework
        }
      }
    } catch {
      profile.extraConfig.hasTestDir = false;
    }

    // -----------------------------------------------------------------------
    // Step 6: Scan for source files
    // -----------------------------------------------------------------------
    profile.sourceFiles = await this.findSourceFiles(folderPath);

    // Store the raw platformio.ini content for the AI to reference
    profile.extraConfig.rawConfig = iniContent;

    return profile;
  }

  /**
   * Recursively find all source files in src/ and lib/ directories.
   * Returns paths relative to the project root.
   */
  private async findSourceFiles(folderPath: string): Promise<string[]> {
    const sourceFiles: string[] = [];
    const dirsToSearch = ['src', 'lib', 'include'];

    for (const dir of dirsToSearch) {
      const dirPath = path.join(folderPath, dir);
      try {
        const files = await this.walkDir(dirPath);
        sourceFiles.push(...files.map(f => path.relative(folderPath, f)));
      } catch {
        // Directory doesn't exist — that's fine
      }
    }

    return sourceFiles;
  }

  /**
   * Recursively walk a directory and return all matching source files.
   */
  private async walkDir(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    const sourceExtensions = new Set(['.c', '.cpp', '.h', '.hpp', '.ino', '.S', '.s']);

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.walkDir(fullPath);
          results.push(...subFiles);
        } else if (sourceExtensions.has(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    } catch {
      // Can't read directory — skip
    }

    return results;
  }
}
