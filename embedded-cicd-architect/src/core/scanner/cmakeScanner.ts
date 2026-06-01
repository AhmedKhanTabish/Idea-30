/**
 * =============================================================================
 * CMAKE SCANNER — Detects and parses CMake-based embedded projects
 * =============================================================================
 *
 * DETECTION: Looks for `CMakeLists.txt` in the project root.
 *
 * PARSING:
 * CMake files are complex and can't be fully parsed without running CMake itself.
 * Instead, we use regex-based heuristics to detect:
 * - Target MCU from toolchain file references (arm-none-eabi, xtensa, etc.)
 * - Project name from project() command
 * - Linked libraries from target_link_libraries()
 * - ESP-IDF markers (idf_component_register, $ENV{IDF_PATH})
 *
 * PRIORITY (50):
 * Lower than PlatformIO (100) because a PlatformIO project might also
 * contain a CMakeLists.txt that PlatformIO generated internally.
 * Lower than ESP-IDF (75) because ESP-IDF projects always use CMake
 * but should be detected by the more specific ESP-IDF scanner first.
 */

import * as fs from 'fs';
import * as path from 'path';
import { IProjectScanner, ProjectProfile, createEmptyProfile } from './types';

export class CMakeScanner implements IProjectScanner {
  readonly name = 'CMake Scanner';
  readonly priority = 50;

  async canScan(folderPath: string): Promise<boolean> {
    const cmakePath = path.join(folderPath, 'CMakeLists.txt');
    try {
      await fs.promises.access(cmakePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async scan(folderPath: string): Promise<ProjectProfile> {
    const profile = createEmptyProfile();
    profile.projectType = 'cmake';
    profile.buildSystem = 'cmake';

    const cmakePath = path.join(folderPath, 'CMakeLists.txt');
    const cmakeContent = await fs.promises.readFile(cmakePath, 'utf-8');

    // -----------------------------------------------------------------------
    // Detect project name: project(MyFirmware ...)
    // -----------------------------------------------------------------------
    const projectMatch = cmakeContent.match(/project\s*\(\s*(\w+)/i);
    if (projectMatch) {
      profile.extraConfig.projectName = projectMatch[1];
    }

    // -----------------------------------------------------------------------
    // Detect platform from toolchain references
    // -----------------------------------------------------------------------
    // Look for toolchain file or compiler references
    profile.platform = this.detectPlatform(cmakeContent);
    profile.framework = this.detectFramework(cmakeContent, folderPath);

    // -----------------------------------------------------------------------
    // Detect board (harder for CMake — often in toolchain file)
    // -----------------------------------------------------------------------
    // Look for common CMake variables that indicate the board
    const boardMatch = cmakeContent.match(/set\s*\(\s*BOARD\s+"?(\w+)"?\s*\)/i);
    if (boardMatch) {
      profile.board = boardMatch[1];
    }

    // -----------------------------------------------------------------------
    // Detect linked libraries: target_link_libraries(target lib1 lib2 ...)
    // -----------------------------------------------------------------------
    const libMatches = cmakeContent.matchAll(
      /target_link_libraries\s*\(\s*\w+\s+([\w\s:]+)\)/gi
    );
    for (const match of libMatches) {
      const libs = match[1].split(/\s+/).filter(l => l && l !== 'PUBLIC' && l !== 'PRIVATE' && l !== 'INTERFACE');
      profile.libraries.push(...libs);
    }

    // -----------------------------------------------------------------------
    // Detect test framework
    // -----------------------------------------------------------------------
    if (cmakeContent.includes('unity') || cmakeContent.includes('Unity')) {
      profile.testFramework = 'unity';
    } else if (cmakeContent.includes('gtest') || cmakeContent.includes('GTest')) {
      profile.testFramework = 'googletest';
    } else if (cmakeContent.includes('Catch2') || cmakeContent.includes('catch2')) {
      profile.testFramework = 'catch2';
    }

    // -----------------------------------------------------------------------
    // Scan source files
    // -----------------------------------------------------------------------
    profile.sourceFiles = await this.findSourceFiles(folderPath);
    profile.environments = ['default'];

    // Store raw CMakeLists.txt for AI reference
    profile.extraConfig.rawConfig = cmakeContent;

    // Check for toolchain file
    const toolchainMatch = cmakeContent.match(/CMAKE_TOOLCHAIN_FILE\s+["']?([^"'\s)]+)/i);
    if (toolchainMatch) {
      profile.extraConfig.toolchainFile = toolchainMatch[1];
      try {
        const toolchainPath = path.resolve(folderPath, toolchainMatch[1]);
        const toolchainContent = await fs.promises.readFile(toolchainPath, 'utf-8');
        profile.extraConfig.toolchainContent = toolchainContent;
      } catch {
        // Toolchain file not found — that's okay
      }
    }

    return profile;
  }

  /**
   * Detect the target platform from CMake content.
   *
   * HEURISTIC APPROACH:
   * We look for compiler/toolchain references that reveal the target MCU:
   * - arm-none-eabi → STM32 / generic ARM Cortex-M
   * - xtensa-esp32 → ESP32
   * - avr-gcc → AVR (Arduino Uno, Mega, etc.)
   */
  private detectPlatform(cmakeContent: string): string {
    const content = cmakeContent.toLowerCase();

    if (content.includes('arm-none-eabi') || content.includes('stm32')) {
      return 'ststm32';
    }
    if (content.includes('xtensa') || content.includes('esp32') || content.includes('esp-idf')) {
      return 'espressif32';
    }
    if (content.includes('avr-gcc') || content.includes('avr')) {
      return 'atmelavr';
    }
    if (content.includes('riscv') || content.includes('risc-v')) {
      return 'riscv';
    }

    return 'unknown';
  }

  /**
   * Detect the framework from CMake content and project structure.
   */
  private detectFramework(cmakeContent: string, folderPath: string): string {
    const content = cmakeContent.toLowerCase();

    if (content.includes('idf_component_register') || content.includes('idf_path')) {
      return 'espidf';
    }
    if (content.includes('stm32cube') || content.includes('hal_driver')) {
      return 'stm32cube';
    }
    if (content.includes('zephyr') || content.includes('find_package(zephyr')) {
      return 'zephyr';
    }

    // Check for HAL includes in source files
    try {
      const files = fs.readdirSync(path.join(folderPath, 'src'));
      if (files.some(f => f.includes('stm32'))) {
        return 'stm32cube';
      }
    } catch {
      // No src directory
    }

    return 'cmake-native';
  }

  /**
   * Find source files in common CMake project directories.
   */
  private async findSourceFiles(folderPath: string): Promise<string[]> {
    const sourceFiles: string[] = [];
    const dirsToSearch = ['src', 'source', 'app', 'core', '.'];
    const sourceExtensions = new Set(['.c', '.cpp', '.h', '.hpp', '.S', '.s']);

    for (const dir of dirsToSearch) {
      const dirPath = path.join(folderPath, dir);
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
            sourceFiles.push(path.join(dir, entry.name));
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return sourceFiles;
  }
}
