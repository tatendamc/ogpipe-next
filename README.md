# @ogpipe/next

**Pixel-perfect OG images for Next.js — full CSS, any font, any hosting platform.**

![OGPipe output example](https://ogpipe.dev/readme-hero.png)

Alternative to `@vercel/og` that uses real Chromium rendering. No Satori CSS limitations, no font-loading boilerplate, works on any deployment target.

## Why?

`@vercel/og` uses Satori (an SVG renderer), not a real browser. This means:
- ❌ No CSS Grid
- ❌ No `display: block` or `display: inline`
- ❌ No `calc()`, no `z-index`, no 3D transforms
- ❌ No WOFF2 fonts
- ❌ Flexbox-only layouts with rendering quirks
- ❌ Only works well on Vercel

**@ogpipe/next** uses real Chromium (headless, on Lambda). This means:
- ✅ Any CSS that works in Chrome works here
- ✅ Any font format (TTF, OTF, WOFF, WOFF2, Google Fonts)
- ✅ Tailwind CSS, CSS Grid, complex layouts — all supported
- ✅ Deploy anywhere (Vercel, AWS, Netlify, Cloudflare, self-hosted)
- ✅ Pixel-perfect rendering — what you see in DevTools is what you get

## Quick Start

```bash
npm install @ogpipe/next
```

### 1. Create a config

```ts
// ogpipe.config.ts
import { defineConfig } from '@ogpipe/next'

export default defineConfig({
  templates: {
    blog: { file: './og-templates/blog.html' },
    default: {
      html: `<div style="display:flex; width:1200px; height:630px; background:#1a1a2e; align-items:center; justify-content:center; padding:60px;">
        <h1 style="color:white; font-size:56px;">{{title}}</h1>
      </div>`,
    },
  },
  routes: {
    '/blog/[slug]': {
      template: 'blog',
      vars: (meta) => ({ title: meta.title || '', date: meta.params?.slug || '' }),
    },
    '*': { template: 'default' },
  },
})
```

### 2. Add to your build script

```json
{
  "scripts": {
    "build": "next build && ogpipe generate"
  }
}
```

### 3. Set your API key

```bash
export OGPIPE_API_KEY=og_live_your_key_here
```

Get a free key (50 renders/month) at [ogpipe.dev/signup.html](https://ogpipe.dev/signup.html).

### 4. Build — OG images generated automatically

```bash
npm run build
# → ✅ Generated 12 OG images in 4200ms
# → 📁 Output: public/og/
```

## Local Preview (Dev Mode)

See your OG images in real-time with hot-reload:

```bash
npx ogpipe dev
# → ⚡ OGPipe Dev Preview
# → http://localhost:3010
```

Preview shows your images inside Twitter, LinkedIn, Slack, and Discord frames. Edit a template → preview updates instantly.

## Dynamic Routes (On-Demand)

For pages created after build (blogs, products, UGC), use the on-demand handler:

```ts
// app/blog/[slug]/opengraph-image.ts
import { OGImageHandler } from '@ogpipe/next'

export default OGImageHandler({
  html: `<div style="...">{{title}}</div>`,
  vars: (params) => ({
    title: params.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }),
  revalidate: 86400, // cache 24h
  fallback: '/og-fallback.png',
})
```

First request renders via API (~1-2s). All subsequent requests serve from CDN cache.

## Templates

Templates are HTML files with `{{variable}}` placeholders. Use any CSS:

```html
<!-- og-templates/blog.html -->
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="w-[1200px] h-[630px] flex flex-col justify-center p-20 bg-gradient-to-br from-blue-600 to-purple-700">
  <h1 class="text-5xl font-bold text-white">{{title}}</h1>
  <p class="text-xl text-blue-100 mt-4">{{description}}</p>
  <p class="text-lg text-blue-200 mt-auto">{{author}} · {{date}}</p>
</body>
</html>
```

## API Client (Framework-Agnostic)

Use the raw API client from any Node.js context:

```ts
import { OGPipeClient } from '@ogpipe/next/client'

const client = new OGPipeClient({ apiKey: process.env.OGPIPE_API_KEY })
const result = await client.render({
  html: '<div style="...">Hello World</div>',
  width: 1200,
  height: 630,
})

if (result.success) {
  console.log(result.data.url) // → CDN URL of rendered image
}
```

## Pricing

| Plan | Renders/mo | Price |
|------|-----------|-------|
| Free | 50 | $0 |
| Pro | 5,000 | $19/mo |
| Scale | 25,000 | $49/mo |

Get your key at [ogpipe.dev](https://ogpipe.dev).

## License

MIT
