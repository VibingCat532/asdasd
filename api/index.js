const app = require('../backend-node/src/server');

module.exports = (req, res) => {
  const forwardedPath = req.query && req.query.path;

  if (forwardedPath) {
    const path = Array.isArray(forwardedPath) ? forwardedPath.join('/') : forwardedPath;
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue;

      const values = Array.isArray(value) ? value : [value];
      values.forEach((item) => {
        if (item !== undefined) {
          params.append(key, item);
        }
      });
    }

    const query = params.toString();
    req.url = `/api/${path}${query ? `?${query}` : ''}`;
  } else if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
};
