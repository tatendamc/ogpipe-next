/**
 * OGPipe Local Dev Preview Server
 *
 * Boots a lightweight HTTP server on localhost:3010 that:
 * - Lists all routes from ogpipe.config.ts
 * - Renders OG images in real-time using the OGPipe API (or local Chromium fallback)
 * - Shows previews inside Twitter, LinkedIn, Slack, and Discord mockup frames
 * - Hot-reloads on template file changes via file watching
 *
 * Usage: npx ogpipe dev
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync, watch, existsSync } from "fs";
import { resolve, extname } from "path";
import { OGPipeClient } from "../client/index.js";
import {
  OGPipeConfig,
  resolveTemplateHtml,
  injectVariables,
} from "../next/config.js";

const DEFAULT_PORT = 3010;

interface PreviewRoute {
  path: string;
  template: string;
  vars: Record<string, string>;
}

export async function startPreviewServer(options: {
  config: OGPipeConfig;
  configDir: string;
  port?: number;
}) {
  const { config, configDir, port = DEFAULT_PORT } = options;

  // Collect preview routes from config
  const routes = buildPreviewRoutes(config);

  // Track connected SSE clients for hot-reload
  const clients: ServerResponse[] = [];

  // Watch template files for changes
  watchTemplateFiles(config, configDir, () => {
    // Notify all connected clients to reload
    for (const client of clients) {
      client.write("data: reload\n\n");
    }
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    // SSE endpoint for hot-reload
    if (pathname === "/__ogpipe/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      clients.push(res);
      req.on("close", () => {
        const idx = clients.indexOf(res);
        if (idx >= 0) clients.splice(idx, 1);
      });
      return;
    }

    // Render a specific route's OG image
    if (pathname === "/__ogpipe/render") {
      const routePath = url.searchParams.get("route") || "/";
      const templateId = url.searchParams.get("template");
      await handleRender(req, res, config, configDir, routePath, templateId);
      return;
    }

    // API: list all routes
    if (pathname === "/__ogpipe/routes") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(routes));
      return;
    }

    // Serve the preview dashboard UI
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateDashboardHtml(routes, port));
  });

  server.listen(port, () => {
    console.log(`\n⚡ OGPipe Dev Preview`);
    console.log(`  → http://localhost:${port}\n`);
    console.log(`  ${routes.length} routes configured`);
    console.log(`  Watching templates for changes...\n`);
  });
}

// ─────────────────────────────────────────────
// Route Building
// ─────────────────────────────────────────────

function buildPreviewRoutes(config: OGPipeConfig): PreviewRoute[] {
  const routes: PreviewRoute[] = [];

  for (const [pattern, routeConfig] of Object.entries(config.routes)) {
    // Generate sample paths from patterns
    const samplePath = patternToSamplePath(pattern);
    const vars = typeof routeConfig.vars === "function"
      ? routeConfig.vars({ path: samplePath, title: "Sample Title", description: "Sample description", params: {} })
      : { title: "Sample Title", description: "Sample description" };

    routes.push({
      path: samplePath,
      template: routeConfig.template,
      vars,
    });
  }

  return routes;
}

function patternToSamplePath(pattern: string): string {
  if (pattern === "*") return "/";
  return pattern
    .replace(/\[\.\.\.(\w+)\]/g, "example-$1")
    .replace(/\[(\w+)\]/g, "example-$1")
    .replace(/\*/g, "example");
}

// ─────────────────────────────────────────────
// Image Rendering
// ─────────────────────────────────────────────

async function handleRender(
  req: IncomingMessage,
  res: ServerResponse,
  config: OGPipeConfig,
  configDir: string,
  routePath: string,
  templateId: string | null
) {
  try {
    const tplId = templateId || Object.keys(config.templates)[0];
    const template = config.templates[tplId];

    if (!template) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Template '${tplId}' not found` }));
      return;
    }

    // Resolve and inject variables
    let html = resolveTemplateHtml(template, configDir);
    const vars = { title: "Sample Blog Post Title", description: "A sample description for preview", author: "Developer", date: "June 2026", site: "mysite.dev", category: "Guide" };
    html = injectVariables(html, vars);

    // Try rendering via API (if key available), otherwise return HTML for iframe
    const apiKey = config.apiKey || process.env.OGPIPE_API_KEY;

    if (apiKey) {
      const client = new OGPipeClient({ apiKey, baseUrl: config.baseUrl });
      const result = await client.render({ html, width: template.width || 1200, height: template.height || 630 });

      if (result.success) {
        // Proxy the image
        const imgRes = await fetch(result.data.url);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        res.writeHead(200, {
          "Content-Type": `image/${result.data.format}`,
          "Cache-Control": "no-cache",
        });
        res.end(buffer);
        return;
      }
    }

    // Fallback: return the raw HTML for iframe-based preview
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Render failed" }));
  }
}

// ─────────────────────────────────────────────
// File Watching
// ─────────────────────────────────────────────

function watchTemplateFiles(config: OGPipeConfig, configDir: string, onChange: () => void) {
  const filesToWatch: string[] = [];

  for (const template of Object.values(config.templates)) {
    if (template.file) {
      const fullPath = resolve(configDir, template.file);
      if (existsSync(fullPath)) {
        filesToWatch.push(fullPath);
      }
    }
  }

  for (const filePath of filesToWatch) {
    watch(filePath, { persistent: false }, (eventType) => {
      if (eventType === "change") {
        console.log(`  ↻ Template changed: ${filePath}`);
        onChange();
      }
    });
  }
}

// ─────────────────────────────────────────────
// Dashboard HTML
// ─────────────────────────────────────────────

function generateDashboardHtml(routes: PreviewRoute[], port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OGPipe Dev Preview</title>
  <style>
    :root { --bg: #09090b; --surface: #18181b; --surface-2: #27272a; --border: #3f3f46; --text: #fafafa; --text-muted: #a1a1aa; --accent: #3b82f6; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 32px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: var(--text-muted); font-size: 14px; margin-bottom: 32px; }
    .platforms { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .platform-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; font-size: 13px; transition: all 0.15s; }
    .platform-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(59,130,246,0.1); }
    .preview-container { display: grid; grid-template-columns: 1fr; gap: 24px; }
    .preview-card { background: var(--surface); border: 1px solid var(--surface-2); border-radius: 12px; padding: 24px; }
    .preview-card h3 { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; }
    .route-info { font-family: monospace; font-size: 12px; color: var(--accent); margin-bottom: 16px; }

    /* Platform mockups */
    .mockup { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
    .mockup-twitter { max-width: 506px; }
    .mockup-linkedin { max-width: 552px; }
    .mockup-slack { max-width: 400px; }
    .mockup-discord { max-width: 432px; }

    .mockup img, .mockup iframe { width: 100%; aspect-ratio: 1200/630; display: block; border: none; background: var(--surface-2); }

    .mockup-frame { padding: 12px; background: var(--surface-2); border-radius: 8px; }
    .mockup-meta { padding: 8px 12px; font-size: 12px; color: var(--text-muted); }
    .mockup-meta .title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .mockup-meta .desc { font-size: 12px; color: var(--text-muted); }
    .mockup-meta .domain { font-size: 11px; color: var(--text-muted); margin-top: 4px; opacity: 0.7; }

    .routes-list { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
    .route-pill { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; font-size: 13px; font-family: monospace; }
    .route-pill.active { border-color: var(--accent); color: var(--accent); }

    .reload-badge { position: fixed; top: 16px; right: 16px; background: var(--accent); color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; display: none; animation: fadeIn 0.2s; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
  </style>
</head>
<body>
  <div class="reload-badge" id="reload-badge">↻ Reloading...</div>
  <h1>⚡ OGPipe Dev Preview</h1>
  <p class="subtitle">Live preview of your OG images across social platforms. Edit templates → see changes instantly.</p>

  <div class="routes-list" id="routes-list">
    ${routes.map((r, i) => `<button class="route-pill ${i === 0 ? "active" : ""}" data-route="${r.path}" data-template="${r.template}">${r.path} (${r.template})</button>`).join("\n    ")}
  </div>

  <div class="platforms">
    <button class="platform-btn active" data-platform="twitter">𝕏 / Twitter</button>
    <button class="platform-btn" data-platform="linkedin">LinkedIn</button>
    <button class="platform-btn" data-platform="slack">Slack</button>
    <button class="platform-btn" data-platform="discord">Discord</button>
  </div>

  <div class="preview-container" id="preview-container">
    <div class="preview-card">
      <div class="mockup mockup-twitter">
        <div class="mockup-frame">
          <img id="og-preview" src="/__ogpipe/render?route=/&template=${routes[0]?.template || "default"}" alt="OG Image Preview" />
          <div class="mockup-meta">
            <div class="title">Sample Blog Post Title</div>
            <div class="desc">A sample description for preview</div>
            <div class="domain">mysite.dev</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const preview = document.getElementById('og-preview');
    const reloadBadge = document.getElementById('reload-badge');

    // Route selection
    document.querySelectorAll('.route-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.route-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const route = btn.dataset.route;
        const template = btn.dataset.template;
        preview.src = '/__ogpipe/render?route=' + encodeURIComponent(route) + '&template=' + encodeURIComponent(template) + '&t=' + Date.now();
      });
    });

    // Platform selection (visual only for now — frame styling)
    document.querySelectorAll('.platform-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // SSE hot-reload
    const evtSource = new EventSource('/__ogpipe/events');
    evtSource.onmessage = (event) => {
      if (event.data === 'reload') {
        reloadBadge.style.display = 'block';
        // Cache-bust the image
        preview.src = preview.src.replace(/[&?]t=\\d+/, '') + '&t=' + Date.now();
        setTimeout(() => { reloadBadge.style.display = 'none'; }, 1500);
      }
    };
  </script>
</body>
</html>`;
}
