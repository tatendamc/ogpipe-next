# OGPipe

**Open-source OG image generation for Next.js**

Pixel-perfect Open Graph images using real Chromium rendering. Full CSS support, any font, deploy anywhere. The open-source alternative to `@vercel/og`.

## Why OGPipe?

| Feature | @vercel/og | @ogpipe/next |
|---------|-----------|--------------|
| CSS Grid | ✗ | ✓ |
| Full Tailwind CSS | Subset only | ✓ |
| Custom fonts | Manual ArrayBuffer | `<link>` tag |
| Deploy anywhere | Vercel Edge only | Any host |
| Build-time generation | Per-request only | ✓ (default) |
| Local dev preview | ✗ | ✓ |

## Quick Start

```bash
npm install @ogpipe/next
```

Create `ogpipe.config.ts`:

```typescript
import { defineConfig } from '@ogpipe/next'

export default defineConfig({
  templates: {
    blog: { file: './og-templates/blog.html' },
  },
  routes: {
    '/blog/[slug]': {
      template: 'blog',
      vars: (meta) => ({ title: meta.title }),
    },
    '*': { template: 'default' },
  },
})
```

Create an HTML template (`og-templates/blog.html`):

```html
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Inter" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="w-[1200px] h-[630px] flex flex-col p-16
  bg-gradient-to-br from-slate-900 to-slate-800">
  <h1 class="text-5xl font-bold text-white">{{title}}</h1>
  <p class="text-xl text-slate-400 mt-4">{{description}}</p>
  <p class="text-lg text-slate-500 mt-auto">{{author}}</p>
</body>
</html>
```

Generate images at build time:

```bash
next build && ogpipe generate
```

Output goes to `public/og/` as static PNG files. Zero runtime dependency.

## How It Works

1. You write OG image templates in HTML/CSS (use Tailwind, Google Fonts, anything)
2. At build time, OGPipe launches headless Chromium and renders each template
3. Static PNG files are saved to `public/og/` with a manifest
4. Your Next.js app serves them as static assets — no API calls in production

## Features

- **Full CSS support** — CSS Grid, calc(), z-index, box-shadow, gradients — anything Chrome renders
- **Any font** — Google Fonts via `<link>`, custom WOFF2 files, no ArrayBuffer boilerplate
- **Build-time generation** — OG images become static files during `next build`
- **Deploy anywhere** — Vercel, AWS, Netlify, Cloudflare, self-hosted
- **Local preview** — `ogpipe dev` shows your images in social card frames with hot-reload
- **Pixel-perfect** — Real headless Chrome, not SVG approximation

## Self-Hosted API (Optional)

OGPipe can also run as an API service for dynamic/on-demand rendering:

```
POST /v1/images
  → API Gateway (auth + rate limiting)
  → Lambda (template resolution + rendering)
  → Playwright/Chromium (HTML → PNG)
  → S3 + CloudFront (storage + CDN delivery)
  → Return image URL
```

See the `infra/` directory for AWS CDK deployment.

## Project Structure

```
ogpipe/
├── packages/ogpipe-next/   # npm package (@ogpipe/next)
├── api/                    # Self-hosted API (Lambda)
├── infra/                  # AWS CDK infrastructure
├── site/                   # Documentation site
├── test-nextjs/            # Example Next.js app
└── LICENSE                 # MIT
```

## Development

```bash
# Install dependencies
cd packages/ogpipe-next && npm install

# Build the package
npm run build

# Run tests
npm test

# Try the example app
cd test-nextjs && npm install && npm run dev
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT — see [LICENSE](./LICENSE)
