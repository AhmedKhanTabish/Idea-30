/**
 * =============================================================================
 * SCANNER REGISTRY — Manages all project scanners with priority ordering
 * =============================================================================
 *
 * DESIGN PATTERN: Registry + Chain of Responsibility
 *
 * HOW IT WORKS:
 * 1. On startup, all scanners register themselves with the registry
 * 2. When the user right-clicks a folder, scanProject() is called
 * 3. The registry tries each scanner in priority order (highest first)
 * 4. The first scanner whose canScan() returns true does the full scan
 * 5. If no scanner matches, we return an 'unknown' profile
 *
 * WHY THIS PATTERN?
 * - Adding a new scanner = 1 new file + 1 line in the registration code
 * - Existing scanners never need to change
 * - The priority system handles overlapping detection gracefully
 *   (e.g., PlatformIO projects contain CMakeLists.txt, but PlatformIO scanner
 *    runs first because it has higher priority)
 *
 * SCALABILITY:
 * This is the "Open/Closed Principle" — the registry is OPEN for extension
 * (register new scanners) but CLOSED for modification (never edit this file
 * to add a new project type).
 */

import { IProjectScanner, ProjectProfile, createEmptyProfile } from './types';

export class ScannerRegistry {
  /**
   * Internal list of registered scanners.
   * Kept sorted by priority (descending) so we always try the most
   * specific scanner first.
   */
  private scanners: IProjectScanner[] = [];

  /**
   * Register a new scanner.
   * The registry automatically sorts by priority after each registration.
   *
   * @param scanner - The scanner to register
   *
   * @example
   *   registry.register(new PlatformIOScanner());   // priority 100
   *   registry.register(new CMakeScanner());         // priority 50
   *   // PlatformIO will always be checked before CMake
   */
  register(scanner: IProjectScanner): void {
    this.scanners.push(scanner);
    // Sort descending by priority — highest priority scanners run first
    this.scanners.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Scan a project folder to determine its type and characteristics.
   *
   * Tries each registered scanner in priority order. Returns the first
   * successful scan result, or an 'unknown' profile if no scanner matches.
   *
   * @param folderPath - Absolute path to the project folder
   * @returns A ProjectProfile describing what was detected
   *
   * FLOW:
   *   for each scanner (by priority):
   *     if scanner.canScan(folderPath):
   *       return scanner.scan(folderPath)  ← first match wins
   *   return emptyProfile                  ← no scanner matched
   */
  async scanProject(folderPath: string): Promise<ProjectProfile> {
    for (const scanner of this.scanners) {
      try {
        const canHandle = await scanner.canScan(folderPath);
        if (canHandle) {
          console.log(`[ScannerRegistry] Using scanner: ${scanner.name}`);
          const profile = await scanner.scan(folderPath);
          return profile;
        }
      } catch (error) {
        // If a scanner throws, log it and try the next one.
        // We never let one broken scanner prevent others from working.
        console.warn(
          `[ScannerRegistry] Scanner "${scanner.name}" failed:`,
          error
        );
      }
    }

    // No scanner could handle this folder
    console.log('[ScannerRegistry] No scanner matched — returning unknown profile');
    return createEmptyProfile();
  }

  /**
   * List all registered scanners (useful for debugging/logging).
   * @returns Array of scanner names in priority order
   */
  getRegisteredScanners(): string[] {
    return this.scanners.map(s => `${s.name} (priority: ${s.priority})`);
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — the default registry used by the extension
// ---------------------------------------------------------------------------

/**
 * Default scanner registry. Import this and call register() to add scanners.
 *
 * WHY A SINGLETON?
 * - The extension only needs one registry for its lifetime
 * - All scanners register against the same instance
 * - The command handler imports this same instance to scan projects
 */
export const defaultScannerRegistry = new ScannerRegistry();
