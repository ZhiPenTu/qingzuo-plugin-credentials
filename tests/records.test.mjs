import test from 'node:test';
import assert from 'node:assert/strict';
import {
  environmentLabel,
  errorText,
  formatUpdatedAt,
  grantCount,
  maskAppId,
  sortRecords,
  validateRecordInput,
} from '../ui/records.mjs';

test('record input enforces label, appId, environment and secret rules', () => {
  assert.deepEqual(validateRecordInput({ label: '  店铺 A  ', appId: ' app-1 ', environment: 'sandbox', secretKey: ' s ' }), {
    label: '店铺 A',
    appId: 'app-1',
    environment: 'sandbox',
    secretKey: 's',
  });
  assert.throws(() => validateRecordInput({ label: '', appId: 'app', secretKey: 's' }), /别名/);
  assert.throws(() => validateRecordInput({ label: 'a'.repeat(65), appId: 'app', secretKey: 's' }), /别名/);
  assert.throws(() => validateRecordInput({ label: '店铺', appId: '', secretKey: 's' }), /AppID/);
  assert.throws(() => validateRecordInput({ label: '店铺', appId: 'a'.repeat(257), secretKey: 's' }), /AppID/);
  assert.throws(() => validateRecordInput({ label: '店铺', appId: 'bad\u0000id', secretKey: 's' }), /AppID/);
  assert.throws(() => validateRecordInput({ label: '店铺', appId: 'app', environment: 'staging', secretKey: 's' }), /环境/);
  assert.throws(() => validateRecordInput({ label: '店铺', appId: 'app', secretKey: '' }), /密钥/);
  assert.throws(() => validateRecordInput({ label: '店铺', appId: 'app', secretKey: 'a\nb' }), /密钥/);
});

test('editing allows an omitted or blank secret but still validates a replacement', () => {
  assert.deepEqual(validateRecordInput({ label: '店铺', appId: 'app', environment: 'production', secretKey: '' }, { editing: true }), {
    label: '店铺',
    appId: 'app',
    environment: 'production',
  });
  assert.deepEqual(validateRecordInput({ label: '店铺', appId: 'app', environment: 'production', secretKey: ' next ' }, { editing: true }), {
    label: '店铺',
    appId: 'app',
    environment: 'production',
    secretKey: 'next',
  });
  assert.throws(() => validateRecordInput({ label: '店铺', appId: 'app', secretKey: 'x'.repeat(1025) }, { editing: true }), /密钥/);
});

test('records are sorted by update time with a stable label fallback', () => {
  const records = [
    { label: 'B', updatedAt: 10 },
    { label: 'A', updatedAt: 10 },
    { label: 'C', updatedAt: 30 },
  ];
  assert.deepEqual(sortRecords(records).map(record => record.label), ['C', 'A', 'B']);
  assert.deepEqual(records.map(record => record.label), ['B', 'A', 'C'], 'sort must not mutate the input');
});

test('display helpers mask identifiers and normalize environment and counts', () => {
  assert.equal(maskAppId('app-1234'), '••••1234');
  assert.equal(maskAppId('abc'), '••••');
  assert.equal(environmentLabel('production'), '生产');
  assert.equal(environmentLabel('sandbox'), '沙箱');
  assert.equal(grantCount({ grants: 3 }), 3);
  assert.equal(grantCount({ grants: -1 }), 0);
  assert.equal(grantCount({}), 0);
  assert.equal(formatUpdatedAt(0).length, 16);
  assert.equal(formatUpdatedAt('invalid'), '时间未知');
});

test('host errors stay actionable while unknown failures are hidden', () => {
  assert.equal(errorText(new Error('请从工具市场安装后使用凭证管理。')), '请从工具市场安装后使用凭证管理。');
  assert.equal(errorText('已存在同名凭证。'), '已存在同名凭证。');
  assert.equal(errorText(new Error('ENOENT: /Users/private/path')), '操作未完成，请稍后重试。');
  assert.equal(errorText(''), '操作未完成，请稍后重试。');
});
