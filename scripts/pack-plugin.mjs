import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pack } from '@commerce/plugin-sdk/cli';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const stage = path.resolve('release/plugin');
const platform = process.platform + '-' + process.arch;
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp('ui', path.join(stage, 'ui'), { recursive: true });
const sdk = new URL('./index.mjs', import.meta.resolve('@commerce/plugin-sdk/cli'));
await cp(sdk, path.join(stage, 'ui/sdk.mjs'));
await cp('LICENSE', path.join(stage, 'LICENSE'));
await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, commerce: pkg.commerce }, null, 2));
const name = pkg.commerce.id + '-' + pkg.version + '-' + platform + '.ecplugin';
const filename = path.resolve('release', name);
const result = await pack(stage, filename);
const bytes = await readFile(filename);
const fragment = path.resolve('release', 'catalog-' + platform + '.json');
await writeFile(fragment, JSON.stringify({
  schemaVersion: 1,
  plugins: [{
    ...pkg.commerce,
    version: pkg.version,
    artifacts: {
      [platform]: {
        url: 'https://github.com/ZhiPenTu/qingzuo-plugin-credentials/releases/download/v' + pkg.version + '/' + name,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex')
      }
    }
  }]
}, null, 2) + '\n');
console.log(JSON.stringify({
  artifact: path.relative(process.cwd(), filename),
  fragment: path.relative(process.cwd(), fragment),
  platform,
  size: bytes.length,
  sha256: result.sha256
}, null, 2));
