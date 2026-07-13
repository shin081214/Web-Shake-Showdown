const express = require('express');
const { existsSync } = require('node:fs');
const path = require('node:path');

function mountProductionFrontend(app, { distPath } = {}) {
  const entryPath = distPath ? path.join(distPath, 'index.html') : null;
  const isReady = entryPath !== null && existsSync(entryPath);

  app.get('/health', (_request, response) => {
    response
      .status(isReady ? 200 : 503)
      .json({ status: isReady ? 'ok' : 'unavailable' });
  });

  if (isReady) {
    app.use(express.static(distPath));
    app.use((request, response, next) => {
      const isClientRoute =
        (request.method === 'GET' || request.method === 'HEAD') &&
        !request.path.startsWith('/socket.io/') &&
        path.extname(request.path) === '';

      if (!isClientRoute) return next();
      return response.sendFile(entryPath);
    });
  }
}

module.exports = { mountProductionFrontend };
