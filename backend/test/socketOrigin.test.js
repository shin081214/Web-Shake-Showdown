const test = require('node:test');
const assert = require('node:assert/strict');
const { createSocketRequestAuthorizer } = require('../socketOrigin');

function authorize(options, headers, socket = {}) {
  const authorizer = createSocketRequestAuthorizer(options);
  return new Promise((resolve, reject) => {
    authorizer({ headers, socket }, (error, allowed) => {
      if (error) reject(error);
      else resolve(allowed);
    });
  });
}

test('production accepts the public same origin behind a reverse proxy', async () => {
  const allowed = await authorize(
    { environment: 'production' },
    {
      origin: 'https://game.example',
      host: 'internal-service:10000',
      'x-forwarded-host': 'game.example',
      'x-forwarded-proto': 'https',
    }
  );

  assert.equal(allowed, true);
});

test('production rejects browser requests from an unrelated origin', async () => {
  const allowed = await authorize(
    { environment: 'production' },
    {
      origin: 'https://attacker.example',
      host: 'game.example',
      'x-forwarded-proto': 'https',
    }
  );

  assert.equal(allowed, false);
});

test('production accepts an explicitly configured additional origin', async () => {
  const allowed = await authorize(
    {
      environment: 'production',
      allowedOrigins: 'https://controller.example, https://other.example/path',
    },
    {
      origin: 'https://controller.example',
      host: 'game.example',
      'x-forwarded-proto': 'https',
    }
  );

  assert.equal(allowed, true);
});

test('development keeps the deliberate cross-origin override', async () => {
  const allowed = await authorize(
    { environment: 'development' },
    {
      origin: 'https://local-controller.example',
      host: '127.0.0.1:3001',
    }
  );

  assert.equal(allowed, true);
});
