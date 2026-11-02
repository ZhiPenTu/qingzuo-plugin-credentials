import { createPluginClient } from './sdk.mjs';
import {
  environmentLabel,
  errorText,
  formatUpdatedAt,
  grantCount,
  sortRecords,
  validateRecordInput,
} from './records.mjs';

const $ = id => document.getElementById(id);
const client = createPluginClient();
const state = {
  records: [],
  loading: true,
  error: '',
  editing: null,
  deleting: null,
  grantsFor: null,
  busy: false,
};

function element(tag, { className, text, attributes } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes ?? {})) node.setAttribute(name, value);
  return node;
}

function setStatus(message = '', tone = '') {
  const node = $('status');
  node.textContent = message;
  node.className = 'status' + (tone ? ' ' + tone : '');
}

function busy(value) {
  state.busy = value;
  document.documentElement.dataset.busy = value ? 'true' : 'false';
  for (const button of document.querySelectorAll('button')) {
    if (button.dataset.keepEnabled === 'true') continue;
    button.disabled = value;
  }
}

function recordItem(record) {
  const item = element('li', { className: 'record', attributes: { 'data-id': record.id } });
  const main = element('div', { className: 'record-main' });
  const heading = element('div', { className: 'record-heading' });
  heading.append(
    element('h2', { className: 'record-label', text: record.label }),
    element('span', { className: 'environment ' + record.environment, text: environmentLabel(record.environment) }),
  );
  main.append(
    heading,
    element('code', { className: 'app-id', text: record.appId }),
    element('p', {
      className: 'record-meta',
      text: `更新于 ${formatUpdatedAt(record.updatedAt)} · ${grantCount(record)} 个工具使用中`,
    }),
  );
  const actions = element('div', { className: 'record-actions' });
  for (const [action, label, className] of [
    ['grants', '查看使用方', 'secondary'],
    ['edit', '编辑', 'secondary'],
    ['delete', '删除', 'danger-quiet'],
  ]) {
    actions.append(element('button', {
      className,
      text: label,
      attributes: { type: 'button', 'data-action': action, 'data-id': record.id },
    }));
  }
  item.append(main, actions);
  return item;
}

function render() {
  $('content').setAttribute('aria-busy', state.loading ? 'true' : 'false');
  $('loading').hidden = !state.loading;
  $('error-state').hidden = state.loading || !state.error;
  $('error-message').textContent = state.error;
  $('empty-state').hidden = state.loading || Boolean(state.error) || state.records.length > 0;
  const list = $('record-list');
  list.hidden = state.loading || Boolean(state.error) || state.records.length === 0;
  list.replaceChildren(...state.records.map(recordItem));
  $('create-record').disabled = state.busy;
}

async function load() {
  state.loading = true;
  state.error = '';
  render();
  try {
    const records = await client.credentials.records.list();
    state.records = sortRecords(Array.isArray(records) ? records : []);
  } catch (error) {
    state.error = errorText(error);
  } finally {
    state.loading = false;
    render();
  }
}

function clearRecordForm() {
  $('record-form').reset();
  $('record-environment').value = 'production';
  $('record-error').textContent = '';
  $('record-secret').value = '';
  state.editing = null;
}

function openCreate() {
  clearRecordForm();
  $('record-dialog-title').textContent = '新建凭证';
  $('record-secret-label').textContent = '密钥';
  $('record-secret').placeholder = '输入密钥';
  $('record-secret-hint').textContent = '保存后无法再次查看；需要更换时只能整体替换。';
  $('record-dialog').showModal();
  $('record-label').focus();
}

function openEdit(record) {
  clearRecordForm();
  state.editing = record;
  $('record-dialog-title').textContent = '编辑凭证';
  $('record-label').value = record.label;
  $('record-app-id').value = record.appId;
  $('record-environment').value = record.environment;
  $('record-secret-label').textContent = '替换密钥（可选）';
  $('record-secret').placeholder = '留空表示不更换';
  $('record-secret-hint').textContent = '留空保留原密钥；填写后会用新密钥整体替换。';
  $('record-dialog').showModal();
  $('record-label').focus();
}

function closeRecordDialog() {
  if ($('record-dialog').open) $('record-dialog').close();
  clearRecordForm();
}

async function saveRecord(event) {
  event.preventDefault();
  $('record-error').textContent = '';
  let input;
  try {
    input = validateRecordInput({
      label: $('record-label').value,
      appId: $('record-app-id').value,
      environment: $('record-environment').value,
      secretKey: $('record-secret').value,
    }, { editing: Boolean(state.editing) });
  } catch (error) {
    $('record-error').textContent = error.message;
    return;
  }
  busy(true);
  try {
    if (state.editing) await client.credentials.records.update(state.editing.id, input);
    else await client.credentials.records.create(input);
    closeRecordDialog();
    setStatus('凭证已保存。', 'success');
    await load();
  } catch (error) {
    $('record-error').textContent = errorText(error);
  } finally {
    $('record-secret').value = '';
    busy(false);
    render();
  }
}

function openDelete(record) {
  state.deleting = record;
  $('delete-name').textContent = record.label;
  $('delete-app-id').textContent = record.appId;
  $('delete-error').textContent = '';
  $('delete-dialog').showModal();
}

function closeDeleteDialog() {
  if ($('delete-dialog').open) $('delete-dialog').close();
  state.deleting = null;
  $('delete-error').textContent = '';
}

async function confirmDelete() {
  if (!state.deleting) return;
  $('delete-error').textContent = '';
  busy(true);
  try {
    await client.credentials.records.remove(state.deleting.id);
    closeDeleteDialog();
    setStatus('凭证已删除。', 'success');
    await load();
  } catch (error) {
    $('delete-error').textContent = errorText(error);
  } finally {
    busy(false);
    render();
  }
}

function grantItem(grant) {
  const item = element('li', { className: 'grant' });
  const text = element('div', { className: 'grant-text' });
  text.append(
    element('strong', { text: grant.title || grant.pluginId }),
    element('span', { text: `确认于 ${formatUpdatedAt(grant.confirmedAt)}` }),
  );
  const revoke = element('button', {
    className: 'secondary',
    text: '撤销授权',
    attributes: { type: 'button', 'data-revoke': grant.pluginId },
  });
  item.append(text, revoke);
  return item;
}

async function loadGrants() {
  if (!state.grantsFor) return;
  const record = state.grantsFor;
  $('grants-record').textContent = `${record.label} · ${record.appId}`;
  $('grants-error').textContent = '';
  $('grants-loading').hidden = false;
  $('grants-empty').hidden = true;
  $('grant-list').replaceChildren();
  try {
    const grants = await client.credentials.records.grants(record.id);
    $('grant-list').replaceChildren(...(Array.isArray(grants) ? grants.map(grantItem) : []));
    $('grants-empty').hidden = grants.length > 0;
  } catch (error) {
    $('grants-error').textContent = errorText(error);
  } finally {
    $('grants-loading').hidden = true;
  }
}

function openGrants(record) {
  state.grantsFor = record;
  $('grants-dialog').showModal();
  void loadGrants();
}

function closeGrantsDialog() {
  if ($('grants-dialog').open) $('grants-dialog').close();
  state.grantsFor = null;
  $('grant-list').replaceChildren();
  $('grants-error').textContent = '';
}

async function revokeGrant(pluginId) {
  if (!state.grantsFor) return;
  busy(true);
  try {
    await client.credentials.records.revokeGrant(state.grantsFor.id, pluginId);
    setStatus('授权已撤销。', 'success');
    await loadGrants();
    await load();
  } catch (error) {
    $('grants-error').textContent = errorText(error);
  } finally {
    busy(false);
    render();
  }
}

$('create-record').addEventListener('click', openCreate);
$('empty-create').addEventListener('click', openCreate);
$('retry').addEventListener('click', () => void load());
$('record-close').addEventListener('click', closeRecordDialog);
$('record-cancel').addEventListener('click', closeRecordDialog);
$('record-dialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeRecordDialog();
});
$('record-form').addEventListener('submit', saveRecord);
$('delete-close').addEventListener('click', closeDeleteDialog);
$('delete-cancel').addEventListener('click', closeDeleteDialog);
$('delete-confirm').addEventListener('click', () => void confirmDelete());
$('delete-dialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeDeleteDialog();
});
$('grants-close').addEventListener('click', closeGrantsDialog);
$('grants-done').addEventListener('click', closeGrantsDialog);
$('grants-dialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeGrantsDialog();
});

$('record-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || state.busy) return;
  const record = state.records.find(item => item.id === button.dataset.id);
  if (!record) return;
  if (button.dataset.action === 'edit') openEdit(record);
  if (button.dataset.action === 'delete') openDelete(record);
  if (button.dataset.action === 'grants') openGrants(record);
});

$('grant-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-revoke]');
  if (button && !state.busy) void revokeGrant(button.dataset.revoke);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') $('record-secret').value = '';
});
window.addEventListener('pagehide', () => { $('record-secret').value = ''; });

void load();
