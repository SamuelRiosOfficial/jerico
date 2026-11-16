import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordVisit } from './visitTracking.js';

const ENDPOINT = 'https://sgzattxgduoowsmijifa.supabase.co/functions/v1/jerico-visit';

test('recordVisit sends one entry request and returns the numeric total', async () => {
  const originalFetch = globalThis.fetch;
  let receivedUrl;
  let receivedOptions;

  globalThis.fetch = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;
    return new Response(JSON.stringify({ total: 27 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    assert.equal(await recordVisit(), 27);
    assert.equal(receivedUrl, ENDPOINT);
    assert.equal(receivedOptions.method, 'POST');
    assert.equal(receivedOptions.body, '{}');
    assert.equal(receivedOptions.cache, 'no-store');
    assert.match(receivedOptions.headers.apikey, /^sb_publishable_/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recordVisit rejects unsuccessful server responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });

  try {
    await assert.rejects(recordVisit(), /Visit tracking failed: 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recordVisit rejects invalid totals', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ total: 'not-a-number' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    await assert.rejects(recordVisit(), /Invalid visit count received/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
