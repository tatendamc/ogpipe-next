# Migrating from @vercel/og to @ogpipe/next

If you've hit the CSS limitations of `@vercel/og` (Satori), this guide shows you how to switch to OGPipe — real Chromium rendering with full CSS support.

## Why migrate?

`@vercel/og` uses Satori, an SVG renderer that only supports a subset of CSS:

| Feature | @vercel/og (Satori) | @ogpipe/next |
|---------|--------------------:|-------------:|
| CSS Grid | ❌ | ✅ |
| `display: block` / `inline` | ❌ | ✅ |
| `calc()` | ❌ | ✅ |
| `z-index` | ❌ | ✅ |
| `position: absolute` (nested) | ⚠️ Buggy | ✅ |
| WOFF2 fonts | ❌ | ✅ |
| Tailwind CSS (full) | ⚠️ Subset | ✅ |
| Background images | ⚠️ Limited | ✅ |
| `box-shadow` | ⚠️ Buggy | ✅ |
| Multi-line text truncation | ❌ | ✅ |
| Google Fonts (any) | ⚠️ Manual ArrayBuffer | ✅ Via `<link>` tag |
| Deploy anywhere | ❌ Vercel/Edge only | ✅ Any platform |
| Bundle size limit | 500KB | No limit |

## Step-by-step migration

### Before: @vercel/og

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }

export default async function Image({ params }: { params: { slug: string } }) {
  // Manual font loading 😩
  const interBold = fetch(
    new URL('../../assets/Inter-Bold.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer())

  const post = await getPost(params.slug)

  return new ImageResponse(
    (
      // Only flexbox works. No grid, no real CSS.
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '60px',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        color: 'white',
        fontFamily: 'Inter',
      }}>
        <h1 style={{ fontSize: '56px', fontWeight: 700 }}>{post.title}</h1>
        <p style={{ fontSize: '24px', color: '#94a3b8' }}>{post.author}</p>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: await interBold, style: 'normal', weight: 700 }],
    }
  )
}
```

**Pain points:**
- Edge runtime required
- Manual font loading as ArrayBuffer
- Only `display: flex` and `display: none` work
- No Tailwind, no CSS Grid, no real CSS
- Breaks outside Vercel deployment

---

### After: @ogpipe/next (build-time)

```bash
npm install @ogpipe/next
```

**1. Create your template (real HTML/CSS — anything goes):**

```html
<!-- og-templates/blog.html -->
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="w-[1200px] h-[630px] flex flex-col justify-center p-16 bg-gradient-to-br from-slate-900 to-slate-800">
  <h1 class="text-[56px] font-bold text-white leading-tight">{{title}}</h1>
  <p class="text-2xl text-slate-400 mt-4">{{author}}</p>
</body>
</html>
```

**2. Configure routes:**

```ts
// ogpipe.config.ts
import { defineConfig } from '@ogpipe/next'

export default defineConfig({
  templates: {
    blog: { file: './og-templates/blog.html' },
  },
  routes: {
    '/blog/[slug]': {
      template: 'blog',
      vars: (meta) => ({
        title: meta.title || 'Untitled',
        author: meta.params?.slug || '',
      }),
    },
  },
})
```

**3. Update build script:**

```json
{
  "scripts": {
    "build": "next build && ogpipe generate"
  }
}
```

**4. Set API key:**

```bash
export OGPIPE_API_KEY=og_live_your_key
```

**5. Build — images generated automatically:**

```bash
npm run build
# ✅ Generated 12 OG images in 4200ms
# 📁 Output: public/og/
```

**That's it.** No edge runtime. No font ArrayBuffers. No CSS limitations. Full Tailwind. Works on any hosting platform.

---

### After: @ogpipe/next (on-demand for dynamic routes)

For pages that don't exist at build time (new blog posts, user content):

```ts
// app/blog/[slug]/opengraph-image.ts
import { OGImageHandler } from '@ogpipe/next'

export default OGImageHandler({
  html: `<!DOCTYPE html>
<html><head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="w-[1200px] h-[630px] flex flex-col justify-center p-16 bg-gradient-to-br from-slate-900 to-slate-800">
  <h1 class="text-[56px] font-bold text-white leading-tight">{{title}}</h1>
  <p class="text-2xl text-slate-400 mt-4">By {{author}}</p>
</body></html>`,
  vars: (params) => ({
    title: params.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    author: 'Your Name',
  }),
  revalidate: 86400, // CDN cache for 24 hours
  fallback: '/og-fallback.png',
})
```

First request: renders via API (~1-2s). All subsequent requests: served from CDN cache instantly.

---

## Key differences

| Concern | @vercel/og | @ogpipe/next |
|---------|-----------|-------------|
| **Where rendering happens** | In your edge function (Satori SVG) | On OGPipe's Chromium servers |
| **CSS support** | Flexbox subset only | Full browser CSS |
| **Font loading** | Manual ArrayBuffer fetch | `<link>` tag in HTML |
| **Template format** | JSX with inline styles | HTML/CSS (Tailwind, any framework) |
| **Build vs runtime** | Always runtime | Build-time (default) + runtime fallback |
| **Hosting** | Vercel Edge required | Any platform |
| **Cost** | Free (included in Vercel) | Free tier: 50/mo, Pro: $19/mo |
| **Offline/self-host** | Local only | Hosted API (self-host option coming) |

## When to stay with @vercel/og

- Your OG images are simple (text + solid background) and Satori handles them fine
- You're on Vercel and don't deploy elsewhere
- You need zero external dependencies (no API calls)
- You don't hit any CSS limitations

## When to switch to @ogpipe/next

- You need CSS Grid, complex layouts, or advanced typography
- Your designs break in Satori (rendering bugs, font issues)
- You deploy to AWS, Netlify, Cloudflare, or self-hosted
- You want Tailwind CSS in your OG templates
- You want build-time generation (static files, no runtime dependency)
- You want a local preview server to iterate on designs

## FAQ

**Is there vendor lock-in?**
Your templates are standard HTML/CSS files. If you stop using OGPipe, you still have your templates — just need a different rendering backend (e.g., self-hosted Puppeteer).

**What if the OGPipe API goes down?**
Build-time generated images are static files — they survive API outages. For on-demand routes, configure a `fallback` image that's served when the API is unreachable.

**Can I use my existing @vercel/og JSX components?**
Not directly (JSX → HTML conversion is planned for v2). For now, rewrite your templates as HTML/CSS. This usually takes 5-10 minutes per template since you can use Tailwind.

**Does it work with the Pages Router?**
Yes. The CLI (`ogpipe generate`) works with any Next.js version that produces a prerender-manifest.json (Next.js 13+).

---

Get your free API key (50 renders/month): [ogpipe.dev/signup.html](https://ogpipe.dev/signup.html)

Full docs: [ogpipe.dev/docs.html](https://ogpipe.dev/docs.html)
