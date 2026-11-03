const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
// Solo se publican estas rutas: nunca .git, index.js ni package.json.
const ARCHIVOS = { '/': 'index.html', '/index.html': 'index.html', '/favicon.ico': 'favicon.ico' };
const CARPETAS = ['css', 'js', 'assets'].map((c) => path.join(RAIZ, c) + path.sep);
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function resolver(url) {
  let ruta;
  try {
    ruta = decodeURIComponent(url.split('?')[0]);
  } catch (e) {
    return null;
  }
  if (ruta.includes('\\') || ruta.includes('\0')) return null;
  if (ARCHIVOS[ruta]) return path.join(RAIZ, ARCHIVOS[ruta]);
  const archivo = path.join(RAIZ, path.posix.normalize(ruta));
  return CARPETAS.some((c) => archivo.startsWith(c)) ? archivo : null;
}

function noEncontrado(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const archivo = resolver(req.url);
  if (!archivo) return noEncontrado(res);
  fs.readFile(archivo, (err, data) => {
    if (err) return noEncontrado(res);
    const ext = path.extname(archivo).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.listen(process.env.PORT || 3000);
