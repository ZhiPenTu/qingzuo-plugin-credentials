import { _electron as electron, expect } from '@playwright/test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const platform = process.platform + '-' + process.arch;
const executable = process.env.QINGZUO_HOST_EXECUTABLE;
if (!executable) throw new Error('需要指向轻作桌面安装包的可执行文件：QINGZUO_HOST_EXECUTABLE=/path/to/Qingzuo');
const artifact = path.resolve(`release/${pkg.commerce.id}-${pkg.version}-${platform}.ecplugin`);

function commerceResources(executablePath) {
  const directory = path.dirname(path.resolve(executablePath));
  if (process.platform === 'darwin') return path.resolve(directory, '..', 'Resources', 'commerce');
  return path.resolve(directory, 'resources', 'commerce');
}

const resources = commerceResources(executable);
const configFile = path.join(resources, 'market.json');
const previous = await readFile(configFile);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'qingzuo-credentials-host-'));
const profile = path.join(temporary, 'profile');
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
let application;
try {
  const bytes = await readFile(artifact);
  const artifactUrl = 'https://market.example/' + pkg.commerce.id + '.ecplugin';
  const catalog = {
    schemaVersion: 1,
    plugins: [{
      ...pkg.commerce,
      version: pkg.version,
      artifacts: {
        [platform]: {
          url: artifactUrl,
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          signature: sign(null, bytes, privateKey).toString('base64'),
        },
      },
    }],
  };
  const existing = JSON.parse(previous.toString('utf8'));
  await writeFile(configFile, JSON.stringify({
    ...existing,
    url: 'https://market.example/catalog.json',
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
  }));

  application = await electron.launch({
    executablePath: path.resolve(executable),
    cwd: temporary,
    args: ['--user-data-dir=' + profile],
    timeout: 60000,
  });
  const page = await application.firstWindow();
  await expect.poll(async () => (await page.evaluate(() => window.commerceDesktop.invoke('status'))).kernel.ready, { timeout: 60000 }).toBe(true);
  await application.evaluate((_, value) => {
    globalThis.fetch = async address => String(address).endsWith('/catalog.json')
      ? new Response(JSON.stringify(value.catalog))
      : new Response(Buffer.from(value.bytes, 'base64'));
  }, { catalog, bytes: bytes.toString('base64') });

  await page.getByRole('button', { name: '工具中心', exact: true }).click();
  await page.getByRole('tab', { name: '全部', exact: true }).click();
  const card = page.locator('[data-slot="card"]').filter({ hasText: '凭证管理' });
  await expect(card.getByRole('heading', { name: '凭证管理', exact: true })).toBeVisible();
  await card.getByRole('button', { name: '安装插件', exact: true }).click();
  await expect(card.getByRole('button', { name: '已安装', exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('tab', { name: '已安装', exact: true }).click();
  const installedCard = page.locator('[data-slot="card"]').filter({ hasText: '凭证管理' });
  await installedCard.getByRole('button', { name: /^打开(?:工具)?$/ }).click();
  await expect.poll(() => application.context().pages().some(candidate => candidate.url().startsWith('commerce-plugin://' + pkg.commerce.id + '/')), { timeout: 60000 }).toBe(true);
  const plugin = application.context().pages().find(candidate => candidate.url().startsWith('commerce-plugin://' + pkg.commerce.id + '/'));
  await expect(plugin.getByRole('heading', { name: '凭证管理', exact: true })).toBeVisible();
  await expect(plugin.locator('#empty-state')).toBeVisible();

  await plugin.locator('#empty-create').click();
  await expect(plugin.locator('#record-secret')).toHaveAttribute('type', 'password');
  await plugin.locator('#record-label').fill('希音正式店铺');
  await plugin.locator('#record-app-id').fill('APP-HOST-CREDENTIAL-001');
  await plugin.locator('#record-environment').selectOption('production');
  await plugin.locator('#record-secret').fill('HOST-SECRET-MUST-NOT-LEAK');
  await plugin.locator('#record-save').click();
  await expect(plugin.locator('#record-list .record')).toHaveCount(1);
  await expect(plugin.locator('.record-label')).toHaveText('希音正式店铺');
  await expect(plugin.locator('.app-id')).toHaveText('APP-HOST-CREDENTIAL-001');
  await expect(plugin.locator('#record-dialog')).toBeHidden();
  await expect(plugin.locator('#status')).toHaveText('凭证已保存。');

  const pageText = await plugin.locator('body').innerText();
  expect(pageText).not.toContain('HOST-SECRET-MUST-NOT-LEAK');
  const index = JSON.parse(await readFile(path.join(profile, 'credential-records.json'), 'utf8'));
  expect(JSON.stringify(index)).not.toContain('HOST-SECRET-MUST-NOT-LEAK');
  const vault = await readFile(path.join(profile, 'credentials-vault.json'), 'utf8');
  expect(vault).toContain('enc:v1:');
  expect(vault).not.toContain('HOST-SECRET-MUST-NOT-LEAK');

  await plugin.locator('button[data-action="edit"]').click();
  await expect(plugin.locator('#record-secret')).toHaveValue('');
  await expect(plugin.locator('#record-secret')).toHaveAttribute('placeholder', '留空表示不更换');
  await plugin.locator('#record-label').fill('希音正式店铺（已改名）');
  await plugin.locator('#record-save').click();
  await expect(plugin.locator('.record-label')).toHaveText('希音正式店铺（已改名）');

  await plugin.locator('button[data-action="grants"]').click();
  await expect(plugin.locator('#grants-dialog')).toBeVisible();
  await expect(plugin.locator('#grants-empty')).toBeVisible();
  await plugin.locator('#grants-done').click();

  await plugin.locator('button[data-action="delete"]').click();
  await expect(plugin.locator('#delete-name')).toHaveText('希音正式店铺（已改名）');
  await plugin.locator('#delete-confirm').click();
  await expect(plugin.locator('#empty-state')).toBeVisible();
  await expect(plugin.locator('#status')).toHaveText('凭证已删除。');
  expect(JSON.parse(await readFile(path.join(profile, 'credential-records.json'), 'utf8')).records).toEqual([]);
  console.log('凭证管理插件以市场来源安装，增删改查通过，密钥未回显且加密落盘。');
} finally {
  await application?.close().catch(() => {});
  await writeFile(configFile, previous).catch(() => {});
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
