import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Firebase Hosting is configured as a safe SPA deployment', () => {
  const config = JSON.parse(read('firebase.json')) as {
    hosting: {
      public: string;
      ignore: string[];
      rewrites: Array<{ source: string; destination: string }>;
    };
  };

  assert.equal(config.hosting.public, 'dist');
  assert.ok(config.hosting.ignore.includes('**/node_modules/**'));
  assert.ok(config.hosting.ignore.includes('**/.*'));
  assert.deepEqual(config.hosting.rewrites, [{ source: '**', destination: '/index.html' }]);
});

test('manifest and service worker describe an app-shell-only PWA', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest')) as {
    start_url: string;
    display: string;
    theme_color: string;
    icons: Array<{ src: string; sizes: string; type: string }>;
  };
  const worker = read('public/sw.js');

  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#7C2E3A');
  assert.deepEqual(manifest.icons.map(({ sizes, type }) => ({ sizes, type })), [
    { sizes: '192x192', type: 'image/png' },
    { sizes: '512x512', type: 'image/png' },
  ]);
  assert.match(worker, /request\.method !== 'GET'/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /request\.mode === 'navigate'/);
});
