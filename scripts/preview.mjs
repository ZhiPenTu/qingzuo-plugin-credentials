import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../ui', import.meta.url));
const server = http.createServer(async (request, response) => {
  const name = request.url === '/' ? 'index.html' : request.url.split('?')[0].slice(1);
  try {
    const body = await readFile(path.join(root, name));
    const type = ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8' })[path.extname(name)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const records = [
  { id: 'rec-111111111111', label: '希音正式店铺', appId: 'APP-2026-QINGZUO-SHEIN', environment: 'production', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 120000, hasSecret: true, grants: 2 },
  { id: 'rec-222222222222', label: '图片处理沙箱', appId: 'sandbox-demo-app', environment: 'sandbox', createdAt: Date.now() - 172800000, updatedAt: Date.now() - 3600000, hasSecret: true, grants: 0 },
];
const init = `(() => {
  const records = ${JSON.stringify(records)};
  const grants = { 'rec-111111111111': [
    { pluginId: 'official.shein-full', title: '希音全托管铺货', confirmedAt: Date.now() - 3600000 },
    { pluginId: 'official.removebg', title: 'AI 抠图', confirmedAt: Date.now() - 7200000 }
  ] };
  window.commercePlugin = {
    async invoke(method, args = {}) {
      if (method === 'credentials.records.list') return records;
      if (method === 'credentials.records.grants') return grants[args.id] ?? [];
      if (method === 'credentials.records.create') { throw new Error('预览模式不保存凭证。'); }
      return null;
    },
    onDispose() {}
  };
})();`;
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height, name] of [[1280, 800, 'preview-1280.png'], [880, 820, 'preview-880.png']]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.addInitScript({ content: init });
    await page.goto(origin);
    await page.locator('.record').first().waitFor();
    await page.screenshot({ path: '/tmp/' + name, fullPage: true });
    console.log('Saved /tmp/' + name);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
