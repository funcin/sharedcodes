import { Hono } from 'hono';
import { csp } from './analytics';
import { runCleanup } from './cleanup';
import { handleEmail } from './email';
import { registerAdminRoutes } from './routes/admin';
import { LANDING_PATHS, registerLandingRoutes } from './routes/landing';
import { registerPublicRoutes } from './routes/public';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

/** PUBLIC_BASE_URL 解析成 URL；没配或不是合法 URL 时为 null（顶层模板留空 → 不做任何跳转） */
function canonicalOrigin(env: Env): URL | null {
  const configured = env.PUBLIC_BASE_URL?.trim();
  if (!configured) return null;
  try {
    return new URL(configured);
  } catch {
    return null;
  }
}

// 配了 PUBLIC_BASE_URL 时，其他主机名（旧域名、www）永久跳转到正式域名的同一路径（含 query）。
// 本地与 workers.dev 预览地址豁免，否则 `wrangler dev --env production` 和分支预览会被弹到线上。
// 静态文件（public/）由 Workers Assets 在 Worker 之前返回，不经过这里，旧域名上仍直接 200。
app.use('*', async (c, next) => {
  const canonical = canonicalOrigin(c.env);
  const url = new URL(c.req.url);
  const exempt = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.workers.dev');
  if (canonical && !exempt && url.hostname !== canonical.hostname) {
    // 不写的话浏览器会对 301 做启发式长期缓存；稳定一周后可提到 86400
    c.header('Cache-Control', 'public, max-age=3600');
    const method = c.req.method;
    return c.redirect(`${canonical.origin}${url.pathname}${url.search}`, method === 'GET' || method === 'HEAD' ? 301 : 308);
  }
  await next();
});

// 除首页外都是私密内容：禁止索引、不带 referrer、不缓存
app.use('*', async (c, next) => {
  await next();
  const isLanding = LANDING_PATHS.has(c.req.path);
  if (!isLanding) c.header('X-Robots-Tag', 'noindex, nofollow');
  c.header('Referrer-Policy', isLanding ? 'strict-origin-when-cross-origin' : 'no-referrer');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
  // 自家页面一律严格 CSP（src/analytics.ts）；首页在 landing.ts 里自己设（配了统计时多放行 Plausible 的域）
  if (c.res.headers.get('content-type')?.includes('text/html') && !c.res.headers.has('Content-Security-Policy')) {
    c.header('Content-Security-Policy', csp());
  }
});

registerLandingRoutes(app);
registerPublicRoutes(app);
registerAdminRoutes(app);

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});

export default {
  fetch: app.fetch,
  email: handleEmail,
  scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runCleanup(env).then((r) => console.log('cleanup done', r)),
    );
  },
} satisfies ExportedHandler<Env>;
