const express = require('express');
const path = require('node:path');

function mountProductionFrontend(app, { distPath } = {}) {
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  if (distPath) {
    app.use(express.static(distPath));
    app.use((request, response, next) => {
      const isClientRoute =
        request.method === 'GET' &&
        !request.path.startsWith('/socket.io/') &&
        path.extname(request.path) === '';

      if (!isClientRoute) return next();
      return response.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

module.exports = { mountProductionFrontend };
