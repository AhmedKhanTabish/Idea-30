// @ts-check
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/**
 * Recursively copy a directory.
 * Used to copy templates/ to dist/templates/ so they're available at runtime.
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * esbuild plugin to copy templates directory to dist/.
 * @type {import('esbuild').Plugin}
 */
const copyTemplatesPlugin = {
  name: 'copy-templates',
  setup(build) {
    build.onEnd(() => {
      const src = path.join(__dirname, 'templates');
      const dest = path.join(__dirname, 'dist', 'templates');
      copyDirSync(src, dest);
      console.log('📋 Templates copied to dist/templates/');
    });
  },
};

/**
 * esbuild plugin to mark VS Code API as external.
 * This prevents bundling the 'vscode' module, which is
 * provided by the VS Code runtime at execution time.
 * 
 * @type {import('esbuild').Plugin}
 */
const vscodeExternalPlugin = {
  name: 'vscode-external',
  setup(build) {
    // Mark 'vscode' as external — it's injected by the VS Code host process
    build.onResolve({ filter: /^vscode$/ }, () => {
      return { path: 'vscode', external: true };
    });
  },
};

/**
 * Main build configuration.
 * 
 * KEY CONCEPTS:
 * - `entryPoints`: The file where VS Code starts loading your extension
 * - `bundle: true`: Combines all your source files + dependencies into ONE file
 *   This dramatically improves extension startup time because VS Code only
 *   loads one file instead of hundreds of individual modules
 * - `external: ['vscode']`: The 'vscode' module is special — VS Code provides
 *   it at runtime, so we must NOT bundle it
 * - `platform: 'node'`: Extensions run in Node.js (not the browser)
 * - `format: 'cjs'`: CommonJS format — required by VS Code's module loader
 */
async function main() {
  /** @type {import('esbuild').BuildOptions} */
  const buildOptions = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !isProduction,
    minify: isProduction,
    // Copy template files to dist — they're loaded at runtime
    loader: {
      '.yml': 'text',
    },
    plugins: [vscodeExternalPlugin, copyTemplatesPlugin],
    // Log build info
    logLevel: 'info',
  };

  if (isWatch) {
    // Watch mode: rebuild automatically when files change
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('👀 Watching for changes...');
  } else {
    // Single build
    await esbuild.build(buildOptions);
    console.log('✅ Build complete');
  }
}

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
