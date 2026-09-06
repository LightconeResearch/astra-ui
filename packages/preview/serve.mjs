// A static server for a MyST export that resolves extensionless paths the way
// Vercel does with `trailingSlash: false`: `/clustering` serves
// `clustering/index.html` without a redirect, which a plain directory server
// would bounce to `/clustering/` and confuse the theme's client-side router.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.csv': 'text/csv',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml',
  '.xsl': 'application/xml',
};

export function serve(dir, port) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const candidates = pathname.endsWith('/')
      ? [`${pathname}index.html`]
      : [pathname, `${pathname}/index.html`, `${pathname}.html`];
    for (const candidate of candidates) {
      const file = join(dir, normalize(candidate));
      if (file !== dir && !file.startsWith(dir + sep)) break;
      if (existsSync(file) && statSync(file).isFile()) {
        response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        createReadStream(file).pipe(response);
        return;
      }
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end(`not found: ${pathname}`);
  });
  server.listen(port, () => {
    console.log(`\n👉 http://localhost:${port}  (Ctrl-C to stop)`);
  });
  return server;
}
