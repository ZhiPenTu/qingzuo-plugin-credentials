import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { validateManifest } from '@commerce/plugin-sdk/manifest';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const [markup, app] = await Promise.all([
  readFile('ui/index.html', 'utf8'),
  readFile('ui/app.mjs', 'utf8'),
]);

test('the credentials plugin manifest is valid and requests only vault management', () => {
  const manifest = validateManifest(pkg);
  assert.equal(manifest.id, 'official.credentials');
  assert.equal(manifest.title, '凭证管理');
  assert.equal(manifest.category, '效率工具');
  assert.equal(manifest.permissions.credentialVault, 'manage');
  assert.match(pkg.commerce.api, /\^1\.7\.0/);
});

test('all UI files needed by the package are present', async () => {
  for (const file of ['ui/index.html', 'ui/app.mjs', 'ui/records.mjs', 'ui/sdk.mjs', 'ui/style.css', 'LICENSE']) {
    await access(file);
  }
});

test('the page never renders HTML strings or stores the secret', () => {
  assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
  assert.doesNotMatch(app, /localStorage|sessionStorage/);
  assert.match(markup, /id="record-secret" name="secretKey" type="password"/);
  assert.match(markup, /id="record-secret-hint"/);
  assert.match(app, /留空保留原密钥/);
});

test('every element referenced by the controller exists in the markup', () => {
  const ids = new Set([...markup.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
  const used = new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]));
  assert.deepEqual([...used].filter(id => !ids.has(id)), []);
});

test('the credential list exposes full AppID, environment and grant count', () => {
  assert.match(app, /record\.appId/);
  assert.match(app, /environmentLabel\(record\.environment\)/);
  assert.match(app, /grantCount\(record\)/);
  assert.match(app, /查看使用方/);
  assert.match(app, /撤销授权/);
});
