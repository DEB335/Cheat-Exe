const http = require('http');

module.exports = (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    const options = {
      hostname: '103.99.36.146',
      port: 80,
      path: '/api/db/index.php',
      method: req.method,
      headers: {
        'Host': 'cheatexe.online',
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
};
