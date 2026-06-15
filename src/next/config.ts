/**
 * OGPipe configuration schema.
 *
 * Developers define this in ogpipe.config.ts at their project root.
 * The CLI reads this to know which templates to use for which routes.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";

// ─────────────────────────────────────────────
// Config Types
// ─────────────────────────────────────────────

export interface OGPipeTemplate {
  /** Inline HTML string with {{variable}} placeholders */
  html?: string;
  /** Path to an HTML template file (relative to config file) */
  file?: string;
  /** Image width (default: 1200) */
  width?: number;
  /** Image height (default: 630) */
  height?: number;
  /** Output format (default: png) */
  format?: "png" | "jpeg" | "webp";
}

export interface RouteConfig {
  /** Template ID to use for this route */
  template: string;
  /** Function to extract variables from page metadata */
  vars?: (metadata: RouteMetadata) => Record<string, string>;
}

export interface RouteMetadata {
  /** Page title from metadata export */
  title?: string;
  /** Page description from metadata export */
  description?: string;
  /** Route path (e.g., /blog/my-post) */
  path: string;
  /** Route params (e.g., { slug: 'my-post' }) */
  params?: Record<string, string>;
  /** Any additional metadata from the page */
  [key: string]: unknown;
}

export interface OnDemandConfig {
  /** Cache duration in seconds (default: 86400 = 24h) */
  revalidate?: number;
  /** Fallback image path if API is unavailable */
  fallback?: string;
}

export interface OGPipeConfig {
  /** API key. Defaults to OGPIPE_API_KEY env var. */
  apiKey?: string;
  /** API base URL. Defaults to https://api.ogpipe.dev */
  baseUrl?: string;
  /** Named templates */
  templates: Record<string, OGPipeTemplate>;
  /** Route-to-template mapping. Supports glob patterns. */
  routes: Record<string, RouteConfig>;
  /** On-demand rendering config (for dynamic routes) */
  onDemand?: OnDemandConfig;
  /** Output directory for generated images (default: public/og) */
  outDir?: string;
}

// ─────────────────────────────────────────────
// Config Helper
// ─────────────────────────────────────────────

/**
 * Helper to define a type-safe OGPipe config.
 *
 * Usage in ogpipe.config.ts:
 * ```ts
 * import { defineConfig } from '@ogpipe/next'
 *
 * export default defineConfig({
 *   templates: { ... },
 *   routes: { ... },
 * })
 * ```
 */
export function defineConfig(config: OGPipeConfig): OGPipeConfig {
  return config;
}

// ─────────────────────────────────────────────
// Template Resolution
// ─────────────────────────────────────────────

/**
 * Resolve a template to its final HTML string.
 * If the template uses a `file` path, reads the file from disk.
 */
export function resolveTemplateHtml(
  template: OGPipeTemplate,
  configDir: string
): string {
  if (template.html) {
    return template.html;
  }

  if (template.file) {
    const filePath = resolve(configDir, template.file);
    try {
      return readFileSync(filePath, "utf-8");
    } catch (err) {
      throw new Error(`[OGPipe] Template file not found: ${filePath}`);
    }
  }

  throw new Error("[OGPipe] Template must have either 'html' or 'file' property.");
}

/**
 * Inject variables into an HTML template string.
 * Replaces {{variable}} placeholders with values.
 */
export function injectVariables(
  html: string,
  variables: Record<string, string>
): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return variables[key] ?? "";
  });
}

/**
 * Match a route path against a glob pattern.
 * Supports:
 *   /blog/[slug]  → matches /blog/anything
 *   /blog/*       → matches /blog/anything
 *   *             → matches everything (default fallback)
 */
export function matchRoute(
  path: string,
  pattern: string
): boolean {
  if (pattern === "*") return true;

  // Convert Next.js dynamic route pattern to regex
  const regexStr = pattern
    .replace(/\[\.\.\.[\w]+\]/g, ".*")     // [...slug] → .*
    .replace(/\[[\w]+\]/g, "[^/]+")        // [slug] → [^/]+
    .replace(/\*/g, "[^/]+");              // * → [^/]+

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}

/**
 * Find the best matching route config for a given path.
 * More specific patterns take priority over wildcards.
 */
export function findRouteConfig(
  path: string,
  routes: Record<string, RouteConfig>
): RouteConfig | null {
  // Sort routes by specificity (longer patterns first, * last)
  const sortedPatterns = Object.keys(routes).sort((a, b) => {
    if (a === "*") return 1;
    if (b === "*") return -1;
    return b.length - a.length;
  });

  for (const pattern of sortedPatterns) {
    if (matchRoute(path, pattern)) {
      return routes[pattern];
    }
  }

  return null;
}
