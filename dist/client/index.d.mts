/**
 * @ogpipe/next/client — Framework-agnostic API client for OGPipe
 *
 * This is the thin HTTP client that communicates with the OGPipe rendering API.
 * Can be used standalone (Python, Go, curl equivalent) or via the Next.js integration.
 */
interface OGPipeClientOptions {
    /** API key (og_live_xxx). Defaults to OGPIPE_API_KEY env var. */
    apiKey?: string;
    /** API base URL. Defaults to https://api.ogpipe.dev */
    baseUrl?: string;
    /** Request timeout in ms. Defaults to 30000. */
    timeout?: number;
}
interface RenderRequest {
    /** HTML content to render */
    html: string;
    /** Image width (default: 1200) */
    width?: number;
    /** Image height (default: 630) */
    height?: number;
    /** Output format (default: png) */
    format?: "png" | "jpeg" | "webp";
}
interface RenderResponse {
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
interface RenderResult {
    success: true;
    data: RenderResponse;
}
interface RenderError {
    success: false;
    error: string;
    statusCode: number;
}
type RenderOutcome = RenderResult | RenderError;
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
declare class OGPipeClient {
    private apiKey;
    private baseUrl;
    private timeout;
    constructor(options?: OGPipeClientOptions);
    /**
     * Render HTML to an image. Returns the CDN URL.
     */
    render(request: RenderRequest): Promise<RenderOutcome>;
    /**
     * Render HTML and return the raw image buffer (for writing to disk).
     */
    renderToBuffer(request: RenderRequest): Promise<Buffer | null>;
}

export { OGPipeClient, type OGPipeClientOptions, type RenderError, type RenderOutcome, type RenderRequest, type RenderResponse, type RenderResult };
