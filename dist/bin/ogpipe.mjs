#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/client/index.ts
var OGPipeClient;
var init_client = __esm({
  "src/client/index.ts"() {
    "use strict";
    OGPipeClient = class {
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
  }
});

// src/next/config.ts
import { readFileSync } from "fs";
import { resolve } from "path";
function resolveTemplateHtml(template, configDir) {
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
function injectVariables(html, variables) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] ?? "";
  });
}
function matchRoute(path, pattern) {
  if (pattern === "*") return true;
  const regexStr = pattern.replace(/\[\.\.\.[\w]+\]/g, ".*").replace(/\[[\w]+\]/g, "[^/]+").replace(/\*/g, "[^/]+");
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}
function findRouteConfig(path, routes) {
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
var init_config = __esm({
  "src/next/config.ts"() {
    "use strict";
  }
});

// src/preview/server.ts
var server_exports = {};
__export(server_exports, {
  startPreviewServer: () => startPreviewServer
});
import { createServer } from "http";
import { watch, existsSync as existsSync2 } from "fs";
import { resolve as resolve3 } from "path";
async function startPreviewServer(options) {
  const { config, configDir, port = DEFAULT_PORT } = options;
  const routes = buildPreviewRoutes(config);
  const clients = [];
  watchTemplateFiles(config, configDir, () => {
    for (const client of clients) {
      client.write("data: reload\n\n");
    }
  });
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = url.pathname;
    if (pathname === "/__ogpipe/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      clients.push(res);
      req.on("close", () => {
        const idx = clients.indexOf(res);
        if (idx >= 0) clients.splice(idx, 1);
      });
      return;
    }
    if (pathname === "/__ogpipe/render") {
      const routePath = url.searchParams.get("route") || "/";
      const templateId = url.searchParams.get("template");
      await handleRender(req, res, config, configDir, routePath, templateId);
      return;
    }
    if (pathname === "/__ogpipe/routes") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(routes));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateDashboardHtml(routes, port));
  });
  server.listen(port, () => {
    console.log(`
\u26A1 OGPipe Dev Preview`);
    console.log(`  \u2192 http://localhost:${port}
`);
    console.log(`  ${routes.length} routes configured`);
    console.log(`  Watching templates for changes...
`);
  });
}
function buildPreviewRoutes(config) {
  const routes = [];
  for (const [pattern, routeConfig] of Object.entries(config.routes)) {
    const samplePath = patternToSamplePath(pattern);
    const vars = typeof routeConfig.vars === "function" ? routeConfig.vars({ path: samplePath, title: "Sample Title", description: "Sample description", params: {} }) : { title: "Sample Title", description: "Sample description" };
    routes.push({
      path: samplePath,
      template: routeConfig.template,
      vars
    });
  }
  return routes;
}
function patternToSamplePath(pattern) {
  if (pattern === "*") return "/";
  return pattern.replace(/\[\.\.\.(\w+)\]/g, "example-$1").replace(/\[(\w+)\]/g, "example-$1").replace(/\*/g, "example");
}
async function handleRender(req, res, config, configDir, routePath, templateId) {
  try {
    const tplId = templateId || Object.keys(config.templates)[0];
    const template = config.templates[tplId];
    if (!template) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Template '${tplId}' not found` }));
      return;
    }
    let html = resolveTemplateHtml(template, configDir);
    const vars = { title: "Sample Blog Post Title", description: "A sample description for preview", author: "Developer", date: "June 2026", site: "mysite.dev", category: "Guide" };
    html = injectVariables(html, vars);
    const apiKey = config.apiKey || process.env.OGPIPE_API_KEY;
    if (apiKey) {
      const client = new OGPipeClient({ apiKey, baseUrl: config.baseUrl });
      const result = await client.render({ html, width: template.width || 1200, height: template.height || 630 });
      if (result.success) {
        const imgRes = await fetch(result.data.url);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        res.writeHead(200, {
          "Content-Type": `image/${result.data.format}`,
          "Cache-Control": "no-cache"
        });
        res.end(buffer);
        return;
      }
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Render failed" }));
  }
}
function watchTemplateFiles(config, configDir, onChange) {
  const filesToWatch = [];
  for (const template of Object.values(config.templates)) {
    if (template.file) {
      const fullPath = resolve3(configDir, template.file);
      if (existsSync2(fullPath)) {
        filesToWatch.push(fullPath);
      }
    }
  }
  for (const filePath of filesToWatch) {
    watch(filePath, { persistent: false }, (eventType) => {
      if (eventType === "change") {
        console.log(`  \u21BB Template changed: ${filePath}`);
        onChange();
      }
    });
  }
}
function generateDashboardHtml(routes, port) {
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
  <div class="reload-badge" id="reload-badge">\u21BB Reloading...</div>
  <h1>\u26A1 OGPipe Dev Preview</h1>
  <p class="subtitle">Live preview of your OG images across social platforms. Edit templates \u2192 see changes instantly.</p>

  <div class="routes-list" id="routes-list">
    ${routes.map((r, i) => `<button class="route-pill ${i === 0 ? "active" : ""}" data-route="${r.path}" data-template="${r.template}">${r.path} (${r.template})</button>`).join("\n    ")}
  </div>

  <div class="platforms">
    <button class="platform-btn active" data-platform="twitter">\u{1D54F} / Twitter</button>
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

    // Platform selection (visual only for now \u2014 frame styling)
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
var DEFAULT_PORT;
var init_server = __esm({
  "src/preview/server.ts"() {
    "use strict";
    init_client();
    init_config();
    DEFAULT_PORT = 3010;
  }
});

// src/bin/ogpipe.ts
import { resolve as resolve4 } from "path";
import { existsSync as existsSync3 } from "fs";

// src/next/generator.ts
init_client();
init_config();
import { readFileSync as readFileSync2, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve as resolve2, join, dirname as dirname2 } from "path";
async function generateOGImages(options) {
  const { projectDir, config, configDir, concurrency = 5 } = options;
  const startTime = Date.now();
  const manifestPath = join(projectDir, ".next", "prerender-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `[OGPipe] Cannot find .next/prerender-manifest.json. Run 'next build' first.`
    );
  }
  const manifest = JSON.parse(
    readFileSync2(manifestPath, "utf-8")
  );
  const routes = Object.keys(manifest.routes).filter(
    (route) => route !== "/_not-found" && !route.startsWith("/_")
  );
  if (routes.length === 0) {
    return { success: [], failed: [], totalDurationMs: 0 };
  }
  const outDir = resolve2(projectDir, config.outDir || "public/og");
  mkdirSync(outDir, { recursive: true });
  const client = new OGPipeClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl
  });
  const results = [];
  const failures = [];
  for (let i = 0; i < routes.length; i += concurrency) {
    const batch = routes.slice(i, i + concurrency);
    const batchPromises = batch.map(
      (route) => generateSingleImage({ route, config, configDir, client, outDir })
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
      }
    }
  }
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
    totalDurationMs: Date.now() - startTime
  };
}
async function generateSingleImage(options) {
  const { route, config, configDir, client, outDir } = options;
  const startTime = Date.now();
  const routeConfig = findRouteConfig(route, config.routes);
  if (!routeConfig) return null;
  const template = config.templates[routeConfig.template];
  if (!template) {
    throw new Error(`[OGPipe] Template '${routeConfig.template}' not found for route ${route}`);
  }
  let html = resolveTemplateHtml(template, configDir);
  const metadata = {
    path: route,
    title: extractTitleFromRoute(route),
    description: "",
    params: extractParamsFromRoute(route)
  };
  const vars = routeConfig.vars ? routeConfig.vars(metadata) : { title: metadata.title || "", description: metadata.description || "" };
  html = injectVariables(html, vars);
  const result = await client.render({
    html,
    width: template.width || 1200,
    height: template.height || 630,
    format: template.format || "png"
  });
  if (!result.success) {
    throw new Error(`API error for ${route}: ${result.error}`);
  }
  const filename = routeToFilename(route, template.format || "png");
  const outputPath = join(outDir, filename);
  const imageBuffer = await client.renderToBuffer({
    html,
    width: template.width || 1200,
    height: template.height || 630,
    format: template.format || "png"
  });
  if (imageBuffer) {
    mkdirSync(dirname2(outputPath), { recursive: true });
    writeFileSync(outputPath, imageBuffer);
  }
  return {
    route,
    outputPath: `/og/${filename}`,
    imageUrl: result.data.url,
    durationMs: Date.now() - startTime
  };
}
function routeToFilename(route, format) {
  if (route === "/") return `index.${format}`;
  const clean = route.replace(/^\//, "");
  return `${clean}.${format}`;
}
function extractTitleFromRoute(route) {
  const segments = route.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "Home";
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function extractParamsFromRoute(route) {
  const segments = route.split("/").filter(Boolean);
  if (segments.length >= 2) {
    return { slug: segments[segments.length - 1] };
  }
  return {};
}

// src/bin/ogpipe.ts
var args = process.argv.slice(2);
var command = args[0];
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
    case void 0:
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
  console.log("\n\u26A1 OGPipe \u2014 Generating OG images...\n");
  const config = await loadConfig(projectDir);
  if (!config) {
    console.error("\u274C No ogpipe.config.ts found in project root.");
    console.error("   Create one with: import { defineConfig } from '@ogpipe/next'");
    process.exit(1);
  }
  if (isDry) {
    console.log("\u{1F50D} Dry run \u2014 showing what would be generated:\n");
    console.log("   (dry run not yet implemented \u2014 run without --dry to generate)");
    return;
  }
  if (!existsSync3(resolve4(projectDir, ".next"))) {
    console.error("\u274C No .next directory found. Run 'next build' first.");
    process.exit(1);
  }
  try {
    const configDir = projectDir;
    const report = await generateOGImages({
      projectDir,
      config,
      configDir
    });
    console.log(`\u2705 Generated ${report.success.length} OG images in ${report.totalDurationMs}ms
`);
    for (const result of report.success) {
      console.log(`   ${result.route} \u2192 ${result.outputPath} (${result.durationMs}ms)`);
    }
    if (report.failed.length > 0) {
      console.log(`
\u26A0\uFE0F  ${report.failed.length} failed:
`);
      for (const failure of report.failed) {
        console.log(`   ${failure.route}: ${failure.error}`);
      }
    }
    console.log(`
\u{1F4C1} Output: ${config.outDir || "public/og/"}`);
    console.log(`\u{1F4CB} Manifest: ${config.outDir || "public/og"}/og-manifest.json
`);
  } catch (err) {
    console.error(`
\u274C Generation failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
async function runDev() {
  const projectDir = process.cwd();
  console.log("\n\u26A1 OGPipe Dev Preview \u2014 starting...\n");
  const config = await loadConfig(projectDir);
  if (!config) {
    console.error("\u274C No ogpipe.config.ts found in project root.");
    console.error("   Create one with: import { defineConfig } from '@ogpipe/next'");
    process.exit(1);
  }
  const { startPreviewServer: startPreviewServer2 } = await Promise.resolve().then(() => (init_server(), server_exports));
  await startPreviewServer2({
    config,
    configDir: projectDir,
    port: parseInt(process.env.OGPIPE_PORT || "3010")
  });
}
async function loadConfig(projectDir) {
  const configPaths = [
    resolve4(projectDir, "ogpipe.config.ts"),
    resolve4(projectDir, "ogpipe.config.js"),
    resolve4(projectDir, "ogpipe.config.mjs")
  ];
  for (const configPath of configPaths) {
    if (existsSync3(configPath)) {
      try {
        const module = await import(configPath);
        return module.default || module;
      } catch (err) {
        try {
          const module = await import(`file://${configPath}`);
          return module.default || module;
        } catch {
          console.error(`\u274C Failed to load config: ${configPath}`);
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
\u26A1 OGPipe CLI \u2014 Pixel-perfect OG images for Next.js

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
//# sourceMappingURL=ogpipe.mjs.map