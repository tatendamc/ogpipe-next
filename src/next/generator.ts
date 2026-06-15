/**
 * OG Image Generator — called by the CLI after `next build`.
 *
 * Reads prerender-manifest.json to discover all static routes,
 * matches them against the user's ogpipe.config.ts,
 * renders OG images via the OGPipe API,
 * and writes them to public/og/.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { OGPipeClient } from "../client/index.js";
import {
  OGPipeConfig,
  resolveTemplateHtml,
  injectVariables,
  findRouteConfig,
  RouteMetadata,
} from "./config.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PrerenderManifest {
  version: number;
  routes: Record<string, { initialRevalidateSeconds: number | false }>;
  dynamicRoutes: Record<string, { routeRegex: string; fallback: string | false }>;
}

interface GenerateResult {
  route: string;
  outputPath: string;
  imageUrl: string;
  durationMs: number;
}

interface GenerateReport {
  success: GenerateResult[];
  failed: { route: string; error: string }[];
  totalDurationMs: number;
}

// ─────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────

export async function generateOGImages(options: {
  projectDir: string;
  config: OGPipeConfig;
  configDir: string;
  concurrency?: number;
}): Promise<GenerateReport> {
  const { projectDir, config, configDir, concurrency = 5 } = options;
  const startTime = Date.now();

  // 1. Read prerender manifest
  const manifestPath = join(projectDir, ".next", "prerender-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `[OGPipe] Cannot find .next/prerender-manifest.json. Run 'next build' first.`
    );
  }

  const manifest: PrerenderManifest = JSON.parse(
    readFileSync(manifestPath, "utf-8")
  );

  // 2. Collect all static routes
  const routes = Object.keys(manifest.routes).filter(
    (route) => route !== "/_not-found" && !route.startsWith("/_")
  );

  if (routes.length === 0) {
    return { success: [], failed: [], totalDurationMs: 0 };
  }

  // 3. Ensure output directory exists
  const outDir = resolve(projectDir, config.outDir || "public/og");
  mkdirSync(outDir, { recursive: true });

  // 4. Initialize API client
  const client = new OGPipeClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });

  // 5. Generate images with concurrency control
  const results: GenerateResult[] = [];
  const failures: { route: string; error: string }[] = [];

  // Process in batches
  for (let i = 0; i < routes.length; i += concurrency) {
    const batch = routes.slice(i, i + concurrency);
    const batchPromises = batch.map((route) =>
      generateSingleImage({ route, config, configDir, client, outDir })
    );

    const batchResults = await Promise.allSettled(batchPromises);

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const route = batch[j];

      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      } else if (result.status === "rejected") {
        failures.push({ route, error: result.reason?.message || "Unknown error" });
      } else if (result.status === "fulfilled" && result.value === null) {
        // No matching route config — skip silently
      }
    }
  }

  // 6. Write og-manifest.json
  const ogManifest = Object.fromEntries(
    results.map((r) => [r.route, { path: r.outputPath, url: r.imageUrl }])
  );
  writeFileSync(
    join(outDir, "og-manifest.json"),
    JSON.stringify(ogManifest, null, 2)
  );

  return {
    success: results,
    failed: failures,
    totalDurationMs: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────
// Single Image Generation
// ─────────────────────────────────────────────

async function generateSingleImage(options: {
  route: string;
  config: OGPipeConfig;
  configDir: string;
  client: OGPipeClient;
  outDir: string;
}): Promise<GenerateResult | null> {
  const { route, config, configDir, client, outDir } = options;
  const startTime = Date.now();

  // Find matching route config
  const routeConfig = findRouteConfig(route, config.routes);
  if (!routeConfig) return null;

  // Get template
  const template = config.templates[routeConfig.template];
  if (!template) {
    throw new Error(`[OGPipe] Template '${routeConfig.template}' not found for route ${route}`);
  }

  // Resolve HTML
  let html = resolveTemplateHtml(template, configDir);

  // Extract metadata and inject variables
  const metadata: RouteMetadata = {
    path: route,
    title: extractTitleFromRoute(route),
    description: "",
    params: extractParamsFromRoute(route),
  };

  const vars = routeConfig.vars
    ? routeConfig.vars(metadata)
    : { title: metadata.title || "", description: metadata.description || "" };

  html = injectVariables(html, vars);

  // Render via API
  const result = await client.render({
    html,
    width: template.width || 1200,
    height: template.height || 630,
    format: template.format || "png",
  });

  if (!result.success) {
    throw new Error(`API error for ${route}: ${result.error}`);
  }

  // Download and save locally
  const filename = routeToFilename(route, template.format || "png");
  const outputPath = join(outDir, filename);

  const imageBuffer = await client.renderToBuffer({
    html,
    width: template.width || 1200,
    height: template.height || 630,
    format: template.format || "png",
  });

  if (imageBuffer) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, imageBuffer);
  }

  return {
    route,
    outputPath: `/og/${filename}`,
    imageUrl: result.data.url,
    durationMs: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Convert a route path to a safe filename.
 * /blog/my-post → blog/my-post.png
 * / → index.png
 */
function routeToFilename(route: string, format: string): string {
  if (route === "/") return `index.${format}`;
  // Remove leading slash, replace remaining slashes with directory separator
  const clean = route.replace(/^\//, "");
  return `${clean}.${format}`;
}

/**
 * Extract a human-readable title from a route path.
 * /blog/my-awesome-post → My Awesome Post
 */
function extractTitleFromRoute(route: string): string {
  const segments = route.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "Home";
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract dynamic params from a route path.
 * /blog/my-post → { slug: 'my-post' } (heuristic)
 */
function extractParamsFromRoute(route: string): Record<string, string> {
  const segments = route.split("/").filter(Boolean);
  if (segments.length >= 2) {
    return { slug: segments[segments.length - 1] };
  }
  return {};
}
