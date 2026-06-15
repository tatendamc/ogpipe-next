/**
 * @ogpipe/next/client — Framework-agnostic API client for OGPipe
 *
 * This is the thin HTTP client that communicates with the OGPipe rendering API.
 * Can be used standalone (Python, Go, curl equivalent) or via the Next.js integration.
 */

export interface OGPipeClientOptions {
  /** API key (og_live_xxx). Defaults to OGPIPE_API_KEY env var. */
  apiKey?: string;
  /** API base URL. Defaults to https://api.ogpipe.dev */
  baseUrl?: string;
  /** Request timeout in ms. Defaults to 30000. */
  timeout?: number;
}

export interface RenderRequest {
  /** HTML content to render */
  html: string;
  /** Image width (default: 1200) */
  width?: number;
  /** Image height (default: 630) */
  height?: number;
  /** Output format (default: png) */
  format?: "png" | "jpeg" | "webp";
}

export interface RenderResponse {
  /** CDN URL of the rendered image */
  url: string;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Output format */
  format: string;
  /** Whether served from cache */
  cached: boolean;
}

export interface RenderResult {
  success: true;
  data: RenderResponse;
}

export interface RenderError {
  success: false;
  error: string;
  statusCode: number;
}

export type RenderOutcome = RenderResult | RenderError;

/**
 * OGPipe API client.
 *
 * Usage:
 * ```ts
 * import { OGPipeClient } from '@ogpipe/next/client'
 *
 * const client = new OGPipeClient({ apiKey: 'og_live_xxx' })
 * const result = await client.render({ html: '<div>Hello</div>' })
 * ```
 */
export class OGPipeClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(options: OGPipeClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.OGPIPE_API_KEY || "";
    this.baseUrl = options.baseUrl || process.env.OGPIPE_BASE_URL || "https://api.ogpipe.dev";
    this.timeout = options.timeout || 30_000;

    if (!this.apiKey) {
      throw new Error(
        "[OGPipe] Missing API key. Set OGPIPE_API_KEY environment variable or pass apiKey option."
      );
    }
  }

  /**
   * Render HTML to an image. Returns the CDN URL.
   */
  async render(request: RenderRequest): Promise<RenderOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: request.html,
          width: request.width || 1200,
          height: request.height || 630,
          format: request.format || "png",
        }),
        signal: controller.signal,
      });

      const body = await res.json() as { error?: string };

      if (!res.ok) {
        return {
          success: false,
          error: body.error || `HTTP ${res.status}`,
          statusCode: res.status,
        };
      }

      return {
        success: true,
        data: body as RenderResponse,
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: "Request timed out", statusCode: 408 };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        statusCode: 500,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Render HTML and return the raw image buffer (for writing to disk).
   */
  async renderToBuffer(request: RenderRequest): Promise<Buffer | null> {
    const result = await this.render(request);
    if (!result.success) return null;

    // Fetch the image from CDN URL
    const res = await fetch(result.data.url);
    if (!res.ok) return null;

    return Buffer.from(await res.arrayBuffer());
  }
}
