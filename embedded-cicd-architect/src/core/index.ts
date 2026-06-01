/**
 * =============================================================================
 * CORE PUBLIC API — Barrel export for the standalone engine
 * =============================================================================
 *
 * This file re-exports everything from the core engine so consumers
 * (VS Code extension, future CLI tool, etc.) can import from one place:
 *
 *   import { ScannerRegistry, createGenerator, ProjectProfile } from './core';
 *
 * WHY A BARREL FILE?
 * - Cleaner imports (one path instead of many)
 * - Controls what's public vs internal
 * - Makes the core engine feel like a proper library/SDK
 */

// Scanner types and registry
export { ProjectProfile, ProjectType, IProjectScanner, createEmptyProfile } from './scanner/types';
export { ScannerRegistry, defaultScannerRegistry } from './scanner/scannerRegistry';

// Individual scanners (for direct registration)
export { PlatformIOScanner } from './scanner/platformioScanner';
export { CMakeScanner } from './scanner/cmakeScanner';
export { ArduinoScanner } from './scanner/arduinoScanner';
export { EspIdfScanner } from './scanner/espIdfScanner';

// Generator types and factory
export { CiProvider, GenerationResult, ICiGenerator, GenerationOptions } from './generator/types';
export { createGenerator } from './generator/generatorFactory';

// AI types
export { LlmConfig, IPipelineGenerator } from './ai/types';
export { AiOrchestrator } from './ai/aiOrchestrator';
export { TemplateFallbackGenerator } from './ai/templateFallback';

// ---------------------------------------------------------------------------
// Convenience: register all built-in scanners on the default registry
// ---------------------------------------------------------------------------
import { defaultScannerRegistry } from './scanner/scannerRegistry';
import { PlatformIOScanner } from './scanner/platformioScanner';
import { CMakeScanner } from './scanner/cmakeScanner';
import { ArduinoScanner } from './scanner/arduinoScanner';
import { EspIdfScanner } from './scanner/espIdfScanner';

/**
 * Initialize the default scanner registry with all built-in scanners.
 * Call this once during extension activation.
 *
 * WHY NOT AUTO-REGISTER?
 * We could register in each scanner's module, but explicit registration
 * gives us control over the order and makes it clear what's happening.
 * It also makes testing easier (you can create a fresh registry without
 * all scanners).
 */
export function initializeDefaultScanners(): void {
  defaultScannerRegistry.register(new PlatformIOScanner());   // Priority 100
  defaultScannerRegistry.register(new EspIdfScanner());       // Priority 75
  defaultScannerRegistry.register(new CMakeScanner());        // Priority 50
  defaultScannerRegistry.register(new ArduinoScanner());      // Priority 25
  // Future: defaultScannerRegistry.register(new ZephyrScanner()); // Priority 60
}
