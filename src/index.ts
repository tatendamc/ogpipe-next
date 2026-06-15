/**
 * @ogpipe/next — Pixel-perfect OG images for Next.js
 *
 * Full CSS support. Any font. Any hosting platform.
 * Framework-agnostic alternative to @vercel/og.
 *
 * @example
 * ```ts
 * // ogpipe.config.ts
 * import { defineConfig } from '@ogpipe/next'
 *
 * export default defineConfig({
 *   templates: {
 *     blog: { file: './og-templates/blog.html' },
 *   },
 *   routes: {
 *     '/blog/[slug]': { template: 'blog', vars: (meta) => ({ title: meta.title }) },
 *     '*': { template: 'default' },
 *   },
 * })
 * ```
 *
 * @example
 * ```ts
 * // app/blog/[slug]/opengraph-image.ts
 * import { OGImageHandler } from '@ogpipe/next'
 *
 * export default OGImageHandler({
 *   html: '<div class="...">{{title}}</div>',
 *   vars: (params) => ({ title: params.slug.replace(/-/g, ' ') }),
 *   revalidate: 86400,
 * })
 * ```
 */

// Config
export { defineConfig } from "./next/config.js";
export type {
  OGPipeConfig,
  OGPipeTemplate,
  RouteConfig,
  RouteMetadata,
  OnDemandConfig,
} from "./next/config.js";

// On-demand handler
export { OGImageHandler } from "./next/handler.js";
export type { OGImageHandlerOptions } from "./next/handler.js";

// Client (also available via @ogpipe/next/client)
export { OGPipeClient } from "./client/index.js";
export type {
  OGPipeClientOptions,
  RenderRequest,
  RenderResponse,
  RenderResult,
  RenderError,
  RenderOutcome,
} from "./client/index.js";
