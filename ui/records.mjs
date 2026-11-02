export const ENVIRONMENTS = Object.freeze(['production', 'sandbox']);
export const LIMITS = Object.freeze({ label: 64, appId: 256, secret: 1024, records: 64, grants: 64 });

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const USER_ERRORS = [
  '请从工具市场安装后使用凭证管理。',
  '凭据库未授权。',
  '已存在同名凭证。',
  '最多保存 64 条凭证。',
  '这条凭证的授权数量已达上限。',
  '凭证已删除，请重新选择。',
  '无法读取已保存的密钥，请重新填写。',
  '凭证别名格式无效。',
  'AppID 格式无效。',
  '密钥格式无效。',
  '凭证环境无效。',
];

export function environmentLabel(value) {
  return value === 'sandbox' ? '沙箱' : '生产';
}

export function maskAppId(value) {
  const text = String(value ?? '');
  return text.length <= 4 ? '••••' : '••••' + text.slice(-4);
}

export function sortRecords(records) {
  return [...records].sort((left, right) => {
    const delta = Number(right.updatedAt || 0) - Number(left.updatedAt || 0);
    return delta || String(left.label).localeCompare(String(right.label), 'zh-CN');
  });
}

export function formatUpdatedAt(value) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) return '时间未知';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function validateRecordInput(input, { editing = false } = {}) {
  const label = typeof input?.label === 'string' ? input.label.trim() : '';
  if (!label || label.length > LIMITS.label || CONTROL.test(label)) throw new Error('凭证别名需为 1–64 个字符。');
  const appId = typeof input?.appId === 'string' ? input.appId.trim() : '';
  if (!appId || appId.length > LIMITS.appId || CONTROL.test(appId)) throw new Error('AppID 需为 1–256 个可打印字符。');
  const environment = input?.environment ?? 'production';
  if (!ENVIRONMENTS.includes(environment)) throw new Error('请选择凭证环境。');
  const secret = typeof input?.secretKey === 'string' ? input.secretKey.trim() : '';
  if (!editing && !secret) throw new Error('请输入密钥。');
  if (secret && (secret.length > LIMITS.secret || /[\u0000\r\n]/.test(secret))) throw new Error('密钥需为 1–1024 个字符，且不能包含换行。');
  return { label, appId, environment, ...(secret ? { secretKey: secret } : {}) };
}

export function errorText(error) {
  const message = typeof error === 'string' ? error : error?.message;
  if (typeof message !== 'string' || !message.trim()) return '操作未完成，请稍后重试。';
  if (USER_ERRORS.includes(message)) return message;
  if (/^[\u4e00-\u9fa5\d，。、“”‘’：；！？（）\sA-Za-z._-]{2,120}$/.test(message)) return message;
  return '操作未完成，请稍后重试。';
}

export function grantCount(record) {
  return Number.isSafeInteger(record?.grants) && record.grants > 0 ? record.grants : 0;
}
