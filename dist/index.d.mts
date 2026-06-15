export { OGPipeClient, OGPipeClientOptions, RenderError, RenderOutcome, RenderRequest, RenderResponse, RenderResult } from './client/index.mjs';

/**
 * OGPipe configuration schema.
 *
 * Developers define this in ogpipe.config.ts at their project root.
 * The CLI reads this to know which templates to use for which routes.
 */
interface OGPipeTemplate {
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
interface RouteConfig {
    /** Template ID to use for this route */
    template: string;
    /** Function to extract variables from page metadata */
    vars?: (metadata: RouteMetadata) => Record<string, string>;
}
interface RouteMetadata {
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
interface OnDemandConfig {
    /** Cache duration in seconds (default: 86400 = 24h) */
    revalidate?: number;
    /** Fallback image path if API is unavailable */
    fallback?: string;
}
interface OGPipeConfig {
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
declare function defineConfig(config: OGPipeConfig): OGPipeConfig;

/**
 * On-demand OG Image handler for Next.js App Router.
 *
 * Use this for dynamic routes where build-time generation isn't possible.
 * The handler calls the OGPipe API on first request, then CDN-caches the result.
 *
 * Usage in app/blog/[slug]/opengraph-image.ts:
 * ```ts
 * import { OGImageHandler } from '@ogpipe/next'
 *
 * export default OGImageHandler({
 *   template: 'blog',
 *   revalidate: 86400,
 *   fallback: '/og-fallback.png',
 * })
 * ```
 */
interface OGImageHandlerOptions {
    /** Template ID (must exist in ogpipe.config.ts templates) */
    template?: string;
    /** Inline HTML (alternative to template) */
    html?: string;
    /** Variables to inject into the template */
    vars?: Record<string, string> | ((params: Record<string, string>) => Record<string, string>);
    /** Cache duration in seconds (default: 86400 = 24h) */
    revalidate?: number;
    /** Fallback image path if API is unavailable */
    fallback?: string;
    /** Image width (default: 1200) */
    width?: number;
    /** Image height (default: 630) */
    height?: number;
}
/**
 * Create an on-demand OG image route handler.
 *
 * Returns a Next.js-compatible route handler that:
 * 1. Resolves the template HTML with variables
 * 2. Calls OGPipe API to render
 * 3. Returns the image with cache headers
 * 4. Falls back to a static image if API is down
 */
declare function OGImageHandler(options: OGImageHandlerOptions): (request: Request, context: {
    params?: Record<string, string | string[]>;
}) => Promise<Response>;

export { OGImageHandler, type OGImageHandlerOptions, type OGPipeConfig, type OGPipeTemplate, type OnDemandConfig, type RouteConfig, type RouteMetadata, defineConfig };
