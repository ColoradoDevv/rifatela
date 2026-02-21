module.exports = async (req, res) => {
  const apiBase = String(process.env.RAILWAY_API_BASE_URL || '').trim().replace(/\/+$/, '');

  if (!apiBase) {
    return res.status(500).json({
      message: 'Missing RAILWAY_API_BASE_URL in Vercel environment variables.'
    });
  }

  const target = buildTargetUrl(req, apiBase);
  const method = req.method || 'GET';

  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'connection' ||
      lower === 'content-length' ||
      lower === 'x-forwarded-host' ||
      lower === 'x-forwarded-port' ||
      lower === 'x-forwarded-proto' ||
      lower === 'x-vercel-id'
    ) {
      continue;
    }
    headers[key] = value;
  }

  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      body = req.body;
    } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
      if (!headers['content-type'] && !headers['Content-Type']) {
        headers['content-type'] = 'application/json';
      }
    } else if (req.body != null) {
      body = String(req.body);
    }
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'manual'
    });

    res.status(upstream.status);

    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === 'content-length' || lower === 'transfer-encoding' || lower === 'set-cookie') {
        continue;
      }
      res.setHeader(key, value);
    }

    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('set-cookie', setCookie);
    }

    if (upstream.status === 204 || upstream.status === 304) {
      return res.end();
    }

    const payload = Buffer.from(await upstream.arrayBuffer());
    return res.send(payload);
  } catch (error) {
    return res.status(502).json({
      message: 'Error proxying request to Railway backend',
      detail: error?.message || 'Unknown error'
    });
  }
};

function buildTargetUrl(req, apiBase) {
  const pathParts = Array.isArray(req.query?.path)
    ? req.query.path
    : req.query?.path
      ? [req.query.path]
      : [];

  const normalizedPath = pathParts.map((part) => String(part)).join('/');
  const pathname = normalizedPath ? `/${normalizedPath}` : '';

  const incoming = new URL(req.url || '/', 'http://localhost');
  return `${apiBase}${pathname}${incoming.search}`;
}
