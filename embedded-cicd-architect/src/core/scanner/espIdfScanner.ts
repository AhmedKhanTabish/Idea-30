/**
 * =============================================================================
 * ESP-IDF SCANNER — Detects ESP-IDF (Espressif IoT Development Framework) projects
 * =============================================================================
 * 
 * DETECTION: Looks for `sdkconfig` or `sdkconfig.defaults` in the project root.
 * These files are unique to ESP-IDF projects and contain chip configuration.
 *
 * PRIORITY (75): Higher than CMake (50) because ESP-IDF uses CMake internally,
 * but the ESP-IDF scanner provides more specific and useful information.
 */

import * as fs from 'fs';
import * as path from 'path';
import { IProjectScanner, ProjectProfile, createEmptyProfile } from './types';

export class EspIdfScanner implements IProjectScanner {
  readonly name = 'ESP-IDF Scanner';
  readonly priority = 75;

  async canScan(folderPath: string): Promise<boolean> {
    // Check for sdkconfig or sdkconfig.defaults (unique to ESP-IDF)
    const sdkconfigPath = path.join(folderPath, 'sdkconfig');
    const defaultsPath = path.join(folderPath, 'sdkconfig.defaults');
    try {
      await fs.promises.access(sdkconfigPath);
      return true;
    } catch {
      try {
        await fs.promises.access(defaultsPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async scan(folderPath: string): Promise<ProjectProfile> {
    const profile = createEmptyProfile();
    profile.projectType = 'esp-idf';
    profile.buildSystem = 'idf.py';
    profile.framework = 'espidf';
    profile.platform = 'espressif32';
    profile.environments = ['default'];

    // Parse sdkconfig to find the target chip
    const sdkconfigPath = path.join(folderPath, 'sdkconfig');
    const defaultsPath = path.join(folderPath, 'sdkconfig.defaults');

    let sdkContent = '';
    try {
      sdkContent = await fs.promises.readFile(sdkconfigPath, 'utf-8');
    } catch {
      try {
        sdkContent = await fs.promises.readFile(defaultsPath, 'utf-8');
      } catch { /* No config found */ }
    }

    // Extract CONFIG_IDF_TARGET (e.g., "esp32", "esp32s3", "esp32c3")
    const targetMatch = sdkContent.match(/CONFIG_IDF_TARGET="?(\w+)"?/);
    if (targetMatch) {
      profile.board = targetMatch[1]; // e.g., "esp32s3"
    } else {
      profile.board = 'esp32'; // Default
    }

    // Detect IDF version from the build system
    const idfVersionMatch = sdkContent.match(/CONFIG_IDF_TARGET_ARCH_(\w+)=y/);
    profile.extraConfig.idfArch = idfVersionMatch ? idfVersionMatch[1] : 'xtensa';

    // Check for components directory (ESP-IDF project structure)
    const componentsDir = path.join(folderPath, 'components');
    try {
      const components = await fs.promises.readdir(componentsDir);
      profile.libraries = components.filter(c => !c.startsWith('.'));
      profile.extraConfig.hasComponents = true;
    } catch {
      profile.extraConfig.hasComponents = false;
    }

    // Check for main/ directory
    const mainDir = path.join(folderPath, 'main');
    try {
      const mainFiles = await fs.promises.readdir(mainDir);
      profile.sourceFiles = mainFiles
        .filter(f => ['.c', '.cpp', '.h', '.hpp'].includes(path.extname(f)))
        .map(f => `main/${f}`);
    } catch { /* No main/ directory */ }

    // Check for pytest or Unity tests
    const testDir = path.join(folderPath, 'test');
    const pytestPath = path.join(folderPath, 'pytest.ini');
    try {
      await fs.promises.access(pytestPath);
      profile.testFramework = 'pytest';
    } catch {
      try {
        await fs.promises.access(testDir);
        profile.testFramework = 'unity';
      } catch {
        profile.testFramework = 'none';
      }
    }

    return profile;
  }
}
