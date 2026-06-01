/**
 * =============================================================================
 * SCANNER TYPES — The core data contracts for project detection
 * =============================================================================
 *
 * WHY INTERFACES FIRST?
 * We define interfaces before any implementation because:
 * 1. It forces us to think about the "shape" of data before writing logic
 * 2. Every scanner must conform to the same contract (IProjectScanner)
 * 3. The rest of the system (generators, AI) only depends on these types,
 *    never on specific scanner implementations — this is the key to scalability
 *
 * ADDING A NEW PROJECT TYPE:
 * 1. Add the type name to the ProjectType union below
 * 2. Create a new scanner class implementing IProjectScanner
 * 3. Register it in scannerRegistry.ts — done!
 */

// ---------------------------------------------------------------------------
// Project Types — every kind of embedded project we can detect
// ---------------------------------------------------------------------------

/**
 * Union type of all supported project types.
 * When you add a new scanner (e.g., for Zephyr RTOS), add its name here first.
 */
export type ProjectType =
  | 'platformio'
  | 'cmake'
  | 'arduino'
  | 'esp-idf'
  | 'zephyr'    // Reserved for future scanner
  | 'unknown';

// ---------------------------------------------------------------------------
// Project Profile — the output of scanning a project folder
// ---------------------------------------------------------------------------

/**
 * ProjectProfile is the universal "report card" that describes what we found
 * in a project folder. Every scanner produces one of these, and every generator
 * consumes one. This is the contract that decouples scanning from generation.
 *
 * Think of it as: "everything the CI/CD generator needs to know about your project."
 */
export interface ProjectProfile {
  /** What kind of project is this? Determines which templates/strategies to use. */
  projectType: ProjectType;

  /** The chip/platform family, e.g., 'espressif32', 'ststm32', 'atmelavr' */
  platform: string;

  /** Specific board identifier, e.g., 'esp32dev', 'nucleo_f446ze', 'd1_mini' */
  board: string;

  /** Framework used, e.g., 'arduino', 'espidf', 'stm32cube', 'zephyr' */
  framework: string;

  /**
   * Build environments (from platformio.ini [env:*] sections).
   * For non-PlatformIO projects, this will typically be ['default'].
   * Used by the generator to create matrix builds in CI.
   */
  environments: string[];

  /** Detected library dependencies (from lib_deps, CMake find_package, etc.) */
  libraries: string[];

  /** Detected test framework, if any. Determines the test stage in CI. */
  testFramework: 'unity' | 'googletest' | 'catch2' | 'none' | string;

  /** The build tool used, e.g., 'pio', 'cmake', 'make', 'idf.py', 'arduino-cli' */
  buildSystem: string;

  /** List of source files found (.c, .cpp, .ino, .h, .hpp) */
  sourceFiles: string[];

  /**
   * Extensible metadata bag for scanner-specific data.
   * For example, the ESP-IDF scanner might store { idfVersion: '5.3' }.
   * Generators can read this for fine-tuning without changing the interface.
   */
  extraConfig: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Scanner Interface — the contract every scanner must implement
// ---------------------------------------------------------------------------

/**
 * IProjectScanner defines what every scanner must do:
 * 1. Tell us if it CAN scan a folder (canScan) — quick check, e.g., "does platformio.ini exist?"
 * 2. Actually SCAN the folder and produce a ProjectProfile (scan)
 *
 * The scanner registry calls canScan() on each scanner in priority order.
 * The first one that returns true gets to do the full scan.
 */
export interface IProjectScanner {
  /** Human-readable name for logging/debugging, e.g., 'PlatformIO Scanner' */
  readonly name: string;

  /**
   * Priority determines the order in which scanners are tried.
   * Higher number = tried FIRST.
   *
   * Why? Some project types are subsets of others:
   * - An ESP-IDF project might also have a CMakeLists.txt
   * - A PlatformIO project might contain .ino files
   *
   * By giving PlatformIO (priority 100) higher priority than CMake (priority 50),
   * we ensure the more specific scanner wins when both could match.
   */
  readonly priority: number;

  /**
   * Quick check: "Can I handle this folder?"
   * Should be fast — typically just checks for the existence of a key file.
   * Must NOT throw errors — return false if anything goes wrong.
   */
  canScan(folderPath: string): Promise<boolean>;

  /**
   * Full scan: analyze the folder and produce a ProjectProfile.
   * Only called after canScan() returns true.
   * Can be slower — reads and parses config files, scans source directories.
   */
  scan(folderPath: string): Promise<ProjectProfile>;
}

// ---------------------------------------------------------------------------
// Factory helper — creates an empty/default ProjectProfile
// ---------------------------------------------------------------------------

/**
 * Creates a blank ProjectProfile with sensible defaults.
 * Scanners can spread this and override specific fields.
 *
 * Usage:
 *   const profile = { ...createEmptyProfile(), projectType: 'platformio', board: 'esp32dev' };
 */
export function createEmptyProfile(): ProjectProfile {
  return {
    projectType: 'unknown',
    platform: '',
    board: '',
    framework: '',
    environments: [],
    libraries: [],
    testFramework: 'none',
    buildSystem: '',
    sourceFiles: [],
    extraConfig: {},
  };
}
