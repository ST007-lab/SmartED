import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAIRouter } from './server/routes/ai.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers (preserving iframe embedding compatibility for AI Studio preview)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '512kb' }));

  // Handle malformed JSON request bodies cleanly without leaking parser stack details
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
          error: 'Malformed JSON request body.',
          code: 'INVALID_JSON',
        });
        return;
      }
      next(err);
    }
  );

  const GOOGLE_VERIFICATION_FILE = path.resolve(
    __dirname,
    'public/assets/aistudio/googlec04a40a791ecc81e_9483ab8a.html'
  );
  const OG_IMAGE_FILE = path.resolve(
    __dirname,
    'src/assets/images/hero_smarted_workspace_1794738910334.jpg'
  );

  const resolvePublicBaseUrl = (req: express.Request): string => {
    const envUrl = process.env.APP_URL?.trim();
    if (envUrl && /^https?:\/\//i.test(envUrl) && !envUrl.includes('MY_APP_URL')) {
      return envUrl.replace(/\/+$/, '');
    }
    const host = req.get('host');
    return host ? `${req.protocol}://${host}` : '';
  };

  // Google Search Console HTML file verification
  app.get('/googlec04a40a791ecc81e.html', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(GOOGLE_VERIFICATION_FILE);
  });

  // Search crawler directives with dynamic Sitemap URL
  app.get('/robots.txt', (req, res) => {
    const baseUrl = resolvePublicBaseUrl(req);
    const sitemapLine = baseUrl ? `\nSitemap: ${baseUrl}/sitemap.xml\n` : '\n';
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`User-agent: *\nAllow: /\nDisallow: /api/${sitemapLine}`);
  });

  // Dynamic XML Sitemap for search engines
  app.get('/sitemap.xml', (req, res) => {
    const baseUrl =
      resolvePublicBaseUrl(req) ||
      'https://ais-pre-3mc27nzhqb3z5dmtegfnpp-874570488382.asia-southeast1.run.app';
    const lastMod = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url>\n` +
        `    <loc>${baseUrl}/</loc>\n` +
        `    <lastmod>${lastMod}</lastmod>\n` +
        `    <changefreq>daily</changefreq>\n` +
        `    <priority>1.0</priority>\n` +
        `  </url>\n` +
        `</urlset>\n`
    );
  });

  // Social share OpenGraph image
  app.get('/og-smarted.jpg', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(OG_IMAGE_FILE);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'smarted-backend' });
  });

  app.use('/api/ai', createAIRouter());

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SmartEd server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SmartEd server:', err);
  process.exit(1);
});
