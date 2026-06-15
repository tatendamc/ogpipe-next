#!/usr/bin/env node

/**
 * OGPipe CLI — generates OG images after `next build`.
 *
 * Usage:
 *   npx ogpipe generate          # Generate OG images for all static routes
 *   npx ogpipe generate --dry    # Show what would be generated without calling API
 *   npx ogpipe dev               # Start local preview server (hot-reload)
 */

import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { generateOGImages } from "../next/generator.js";
import type { OGPipeConfig } from "../next/config.js";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "generate":
      await runGenerate();
      break;
    case "dev":
      await runDev();
      break;
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function runGenerate() {
  const isDry = args.includes("--dry");
  const projectDir = process.cwd();

  console.log("\n⚡ OGPipe — Generating OG images...\n");

  // Load config
  const config = await loadConfig(projectDir);
  if (!config) {
    console.error("❌ No ogpipe.config.ts found in project root.");
    console.error("   Create one with: import { defineConfig } from '@ogpipe/next'");
    process.exit(1);
  }

  if (isDry) {
    console.log("🔍 Dry run — showing what would be generated:\n");
    // TODO: implement dry-run (list routes + templates without API calls)
    console.log("   (dry run not yet implemented — run without --dry to generate)");
    return;
  }

  // Check .next directory exists
  if (!existsSync(resolve(projectDir, ".next"))) {
    console.error("❌ No .next directory found. Run 'next build' first.");
    process.exit(1);
  }

  try {
    const configDir = projectDir; // config is at project root
    const report = await generateOGImages({
      projectDir,
      config,
      configDir,
    });

    // Print results
    console.log(`✅ Generated ${report.success.length} OG images in ${report.totalDurationMs}ms\n`);

    for (const result of report.success) {
      console.log(`   ${result.route} → ${result.outputPath} (${result.durationMs}ms)`);
    }

    if (report.failed.length > 0) {
      console.log(`\n⚠️  ${report.failed.length} failed:\n`);
      for (const failure of report.failed) {
        console.log(`   ${failure.route}: ${failure.error}`);
      }
    }

    console.log(`\n📁 Output: ${config.outDir || "public/og/"}`);
    console.log(`📋 Manifest: ${config.outDir || "public/og"}/og-manifest.json\n`);
  } catch (err) {
    console.error(`\n❌ Generation failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

async function runDev() {
  const projectDir = process.cwd();

  console.log("\n⚡ OGPipe Dev Preview — starting...\n");

  // Load config
  const config = await loadConfig(projectDir);
  if (!config) {
    console.error("❌ No ogpipe.config.ts found in project root.");
    console.error("   Create one with: import { defineConfig } from '@ogpipe/next'");
    process.exit(1);
  }

  const { startPreviewServer } = await import("../preview/server.js");
  await startPreviewServer({
    config,
    configDir: projectDir,
    port: parseInt(process.env.OGPIPE_PORT || "3010"),
  });
}

async function loadConfig(projectDir: string): Promise<OGPipeConfig | null> {
  // Try loading ogpipe.config.ts / ogpipe.config.js / ogpipe.config.mjs
  const configPaths = [
    resolve(projectDir, "ogpipe.config.ts"),
    resolve(projectDir, "ogpipe.config.js"),
    resolve(projectDir, "ogpipe.config.mjs"),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        // Dynamic import handles both TS and JS
        const module = await import(configPath);
        return module.default || module;
      } catch (err) {
        // If TS import fails, try with tsx/ts-node loader
        try {
          // Fallback: try requiring with ts-node
          const module = await import(`file://${configPath}`);
          return module.default || module;
        } catch {
          console.error(`❌ Failed to load config: ${configPath}`);
          console.error(`   ${err instanceof Error ? err.message : err}`);
          return null;
        }
      }
    }
  }

  return null;
}

function printHelp() {
  console.log(`
⚡ OGPipe CLI — Pixel-perfect OG images for Next.js

COMMANDS:
  generate          Generate OG images for all static routes (run after next build)
  generate --dry    Show what would be generated without calling the API
  dev               Start local preview server with hot-reload

SETUP:
  1. Create ogpipe.config.ts in your project root
  2. Add to package.json scripts: "build": "next build && ogpipe generate"
  3. Set OGPIPE_API_KEY environment variable

DOCS:
  https://ogpipe.dev/docs.html

EXAMPLE CONFIG:
  import { defineConfig } from '@ogpipe/next'

  export default defineConfig({
    templates: {
      blog: { file: './og-templates/blog.html' },
      default: { html: '<div style="...">{{title}}</div>' },
    },
    routes: {
      '/blog/[slug]': { template: 'blog', vars: (meta) => ({ title: meta.title }) },
      '*': { template: 'default' },
    },
  })
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
