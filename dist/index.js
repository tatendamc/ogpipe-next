"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  OGImageHandler: () => OGImageHandler,
  OGPipeClient: () => OGPipeClient,
  defineConfig: () => defineConfig
});
module.exports = __toCommonJS(src_exports);

// src/next/config.ts
function defineConfig(config) {
  return config;
}
function injectVariables(html, variables) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] ?? "";
  });
}

// src/client/index.ts
var OGPipeClient = class {
  apiKey;
  baseUrl;
  timeout;
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OGPIPE_API_KEY || "";
    this.baseUrl = options.baseUrl || process.env.OGPIPE_BASE_URL || "https://api.ogpipe.dev";
    this.timeout = options.timeout || 3e4;
    if (!this.apiKey) {
      throw new Error(
        "[OGPipe] Missing API key. Set OGPIPE_API_KEY environment variable or pass apiKey option."
      );
    }
  }
  /**
   * Render HTML to an image. Returns the CDN URL.
   */
  async render(request) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          html: request.html,
          width: request.width || 1200,
          height: request.height || 630,
          format: request.format || "png"
        }),
        signal: controller.signal
      });
      const body = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: body.error || `HTTP ${res.status}`,
          statusCode: res.status
        };
      }
      return {
        success: true,
        data: body
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: "Request timed out", statusCode: 408 };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        statusCode: 500
      };
    } finally {
      clearTimeout(timer);
    }
  }
  /**
   * Render HTML and return the raw image buffer (for writing to disk).
   */
  async renderToBuffer(request) {
    const result = await this.render(request);
    if (!result.success) return null;
    const res = await fetch(result.data.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
};

// src/next/handler.ts
function OGImageHandler(options) {
  const {
    revalidate = 86400,
    fallback,
    width = 1200,
    height = 630
  } = options;
  return async function handler(request, context) {
    try {
      const client = new OGPipeClient();
      let html;
      if (options.html) {
        html = options.html;
      } else {
        html = options.html || "<div>{{title}}</div>";
      }
      const params = flattenParams(context.params || {});
      const vars = typeof options.vars === "function" ? options.vars(params) : options.vars || {};
      html = injectVariables(html, vars);
      const result = await client.render({ html, width, height });
      if (!result.success) {
        if (fallback) {
          return Response.redirect(new URL(fallback, request.url), 302);
        }
        return new Response("OG image generation failed", { status: 500 });
      }
      const imageRes = await fetch(result.data.url);
      const imageBuffer = await imageRes.arrayBuffer();
      return new Response(imageBuffer, {
        headers: {
          "Content-Type": `image/${result.data.format}`,
          "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`
        }
      });
    } catch (err) {
      if (fallback) {
        return Response.redirect(new URL(fallback, request.url), 302);
      }
      return new Response("OG image generation failed", { status: 500 });
    }
  };
}
function flattenParams(params) {
  const flat = {};
  for (const [key, value] of Object.entries(params)) {
    flat[key] = Array.isArray(value) ? value.join("/") : value;
  }
  return flat;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OGImageHandler,
  OGPipeClient,
  defineConfig
});
//# sourceMappingURL=index.js.map