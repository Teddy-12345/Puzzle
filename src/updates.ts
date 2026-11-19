import { Channel, invoke, isTauri } from '@tauri-apps/api/core';

type Policy = { enabled?: boolean; title?: string; message?: string; mode?: string; maxDirectMB?: number; packageBytes?: number };
let busy = false;
let idleTimer: number | undefined;
const website = 'http://teddy-personal.cloud:22830/projects/puzzle';

function dialog(title: string, message: string, accept?: { label: string; action: (panel: HTMLDialogElement) => Promise<void> }) {
  const panel = document.createElement('dialog');
  panel.className = 'settings-dialog confirm-dialog';
  panel.dataset.updateDialog = 'true';
  panel.innerHTML = '<div class="settings-heading"><h2></h2></div><p class="confirm-message" style="white-space:pre-wrap"></p><p class="update-status" role="status"></p><div class="confirm-actions"></div>';
  panel.querySelector('h2')!.textContent = title;
  panel.querySelector('.confirm-message')!.textContent = message;
  const actions = panel.querySelector('.confirm-actions')!;
  const button = (label: string, gold: boolean) => {
    const node = document.createElement('button');
    node.className = 'control capsule ' + (gold ? 'gold' : 'blue');
    const text = document.createElement('span');
    text.textContent = label;
    node.append(text);
    actions.append(node);
    return node;
  };
  button(accept ? '稍后' : '知道了', false).onclick = () => panel.close();
  if (accept) button(accept.label, true).onclick = () => void accept.action(panel);
  panel.addEventListener('close', () => panel.remove());
  document.body.append(panel);
  panel.showModal();
}

async function openWebsite() {
  // Fixed URL, opened by the OS adapter; no arbitrary command or path is accepted.
  const bridge = (window as any).InfluenceUpdates;
  if (bridge?.website) { bridge.website(); return; }
  try { await invoke('open_update_website'); }
  catch { dialog('下载新版', website); }
}

export async function checkPuzzleUpdate(automatic = false) {
  if (busy || document.querySelector('[data-update-dialog]')) return;
  if (!automatic && idleTimer !== undefined) {
    clearInterval(idleTimer);
    idleTimer = undefined;
  }
  if (!isTauri()) {
    if (!automatic) dialog('检查更新', '请在已安装的 Puzzle 中检查更新。');
    return;
  }
  if (/Android/i.test(navigator.userAgent)) {
    const bridge = (window as any).InfluenceUpdates;
    if (bridge) bridge.check();
    else if (!automatic) dialog('检查更新', '请前往网站下载安装最新版。', { label: '前往网站', action: async (panel) => {
      await openWebsite(); panel.close();
    } });
    return;
  }
  busy = true;
  try {
    const [release, policy] = await Promise.all([
      invoke<{ version: string; notes: string } | null>('check_update'),
      fetch('http://teddy-personal.cloud:22830/updates/puzzle-windows.json', { cache: 'no-store', signal: AbortSignal.timeout(3000) })
        .then(async (response) => response.ok ? await response.json() as Policy : {}).catch(() => ({} as Policy)),
    ]);
    if (!release) { if (!automatic) dialog('检查更新', '当前已是最新版本。'); return; }
    if (policy.enabled === false) { if (!automatic) dialog('检查更新', '更新提醒暂未启用。'); return; }
    const bytes = policy.packageBytes || 0;
    const useWebsite = policy.mode === 'website' || bytes <= 0 || (policy.mode !== 'direct' && bytes > (policy.maxDirectMB || 128) * 1024 ** 2);
    const message = (policy.message || '{product} {version}\n{notes}').replaceAll('{product}', 'Puzzle')
      .replaceAll('{version}', release.version).replaceAll('{notes}', release.notes);
    // The network check runs during play; only the modal waits until the table is idle.
    if (automatic && document.querySelector('.hand, .table, dialog[open]')) {
      if (idleTimer !== undefined) clearInterval(idleTimer);
      idleTimer = window.setInterval(() => {
        if (!document.querySelector('.hand, .table, dialog[open]')) {
          clearInterval(idleTimer); idleTimer = undefined; void checkPuzzleUpdate(true);
        }
      }, 15000);
      return;
    }
    dialog(policy.title || '发现新版本', message + (useWebsite ? '\n请前往网站下载新版并覆盖安装。' : ''), {
      label: useWebsite ? '前往网站' : '下载更新',
      action: async (panel) => {
        if (useWebsite) { await openWebsite(); panel.close(); return; }
        const buttons = panel.querySelectorAll<HTMLButtonElement>('button');
        busy = true;
        buttons.forEach((button) => button.disabled = true);
        const prevent = (event: Event) => event.preventDefault();
        panel.addEventListener('cancel', prevent);
        const status = panel.querySelector('.update-status')!;
        const progress = new Channel<{ phase: string; downloaded: number; total?: number }>();
        progress.onmessage = (value) => status.textContent = value.phase === 'installing' ? '校验完成，正在打开安装器…'
          : value.total ? `正在下载 ${Math.floor(value.downloaded / value.total * 100)}%` : '正在下载更新…';
        try { await invoke('install_update', { onProgress: progress }); }
        catch {
          busy = false;
          panel.removeEventListener('cancel', prevent);
          panel.close();
          dialog('更新未完成', '当前版本和数据保持不变，可前往网站下载新版。', { label: '前往网站', action: async (fallback) => {
            await openWebsite(); fallback.close();
          } });
        }
      },
    });
  } catch { if (!automatic) dialog('检查更新', '暂时无法检查更新，请稍后重试。'); }
  finally { busy = false; }
}

if (isTauri() && !/Android/i.test(navigator.userAgent)) {
  window.setTimeout(() => void checkPuzzleUpdate(true), 12000);
}
