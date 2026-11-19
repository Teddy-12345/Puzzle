/**
 * engine.worker.js - AI Worker（ES module Worker，薄壳）
 *
 * 算法本体在 ai/engine.js 里（纯逻辑，Node 也能直接 import）。
 * 这个文件只做一件事：把消息转成一次 decide() 调用，再把结果发回去。
 * 这里不写任何算法——想改 AI，请去 ai/engine.js。
 *
 * 用 ES module Worker（new Worker(url, { type: 'module' })）的好处：
 * engine.js 能直接 `import` rules.js，于是「合法出牌生成」在主线程与
 * Worker 里是**同一份实现**，不会出现两边规则不一致的诡异 bug。
 *
 * ── 协议 ─────────────────────────────────────────────────────────────
 *
 *   主线程 → Worker
 *     { type:'decide', seq, level, hand:[...], lastPlay:{...}|null,
 *       ctx:{ seat, landlord, handSizes:[3], playedCounts:[15], passCount } }
 *
 *   Worker → 主线程
 *     { type:'ready' }
 *     { type:'result', seq, candidates:[{cards,score,meta}], info:{...}, elapsedMs }
 *     { type:'error', seq, message }
 *
 * @license MIT
 */

import { decide } from './engine.js';

self.addEventListener('message', function (ev) {
  const msg = ev.data;
  if (!msg || msg.type !== 'decide') return;

  const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  try {
    const ctx = Object.assign({}, msg.ctx, { level: msg.level });
    const res = decide(msg.hand, msg.lastPlay, ctx);
    const elapsed = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    self.postMessage({
      type: 'result',
      seq: msg.seq,
      candidates: res.candidates,
      info: res.info,
      elapsedMs: Math.round(elapsed - started)
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      seq: msg.seq,
      message: String((err && err.message) || err)
    });
  }
});

self.postMessage({ type: 'ready' });
