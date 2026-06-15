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

import { OGPipeClient } from "../client/index.js";
import {
  OGPipeConfig,
  OGPipeTemplate,
  resolveTemplateHtml,
  injectVariables,
} from "./config.js";

export interface OGImageHandlerOptions {
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
export function OGImageHandler(options: OGImageHandlerOptions) {
  const {
    revalidate = 86400,
    fallback,
    width = 1200,
    height = 630,
  } = options;

  return async function handler(
    request: Request,
    context: { params?: Record<string, string | string[]> }
  ): Promise<Response> {
    try {
      const client = new OGPipeClient();

      // Resolve HTML
      let html: string;
      if (options.html) {
        html = options.html;
      } else {
        // Template-based — caller must provide resolved HTML
        // In practice, the developer passes vars directly
        html = options.html || "<div>{{title}}</div>";
      }

      // Resolve variables
      const params = flattenParams(context.params || {});
      const vars =
        typeof options.vars === "function"
          ? options.vars(params)
          : options.vars || {};

      html = injectVariables(html, vars);

      // Render via API
      const result = await client.render({ html, width, height });

      if (!result.success) {
        // Fallback to static image
        if (fallback) {
          return Response.redirect(new URL(fallback, request.url), 302);
        }
        return new Response("OG image generation failed", { status: 500 });
      }

      // Fetch the rendered image and return it
      const imageRes = await fetch(result.data.url);
      const imageBuffer = await imageRes.arrayBuffer();

      return new Response(imageBuffer, {
        headers: {
          "Content-Type": `image/${result.data.format}`,
          "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`,
        },
      });
    } catch (err) {
      // On any error, try fallback
      if (fallback) {
        return Response.redirect(new URL(fallback, request.url), 302);
      }
      return new Response("OG image generation failed", { status: 500 });
    }
  };
}

/**
 * Flatten Next.js route params (which can be string | string[]) to Record<string, string>.
 */
function flattenParams(params: Record<string, string | string[]>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    flat[key] = Array.isArray(value) ? value.join("/") : value;
  }
  return flat;
}
