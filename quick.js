/* AgentCore-Light 快速上手站 —— 系统识别与切换
   ---------------------------------------------------------------------------
   这一页的全部逻辑就是「认出客户在用哪个系统」，然后让 CSS 把另外两个系统的
   步骤收起来（显隐规则在 quick.css 第 1 节）。

   为什么识别放在 index.html 的 <head> 里、这个文件只负责切换：
   识别结果要在首次绘制之前写到 <html data-os> 上，否则客户会先看到三个系统的
   步骤糊在一起、然后才收起来，闪一下很难看。

   三条底线：
     · 认不出来（手机、平板、ChromeOS、脚本被拦）不猜 —— 三个系统全部列出来，
       客户自己点胶囊选。宁可长一点，也不能给他看错的那一套。
     · 客户手动选过就记住（localStorage），下次打开直接是他选的那个。
     · 没有 JS 时页面照样能读，只是不折叠而已。
   --------------------------------------------------------------------------- */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const OS_LIST = ['windows', 'macos', 'linux'];
  const OS_NAME = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
  const STORE_KEY = 'agentcore-quick-os';

  // 中英两版共用这个脚本，页面文案按构建时写死的 <html data-lang> 取
  const LANG = document.documentElement.dataset.lang === 'en' ? 'en' : 'zh';
  const T = {
    zh: { confirm: '请确认你的电脑系统', chosen: '你选择了 ', detected: '检测到你在用 ' },
    en: { confirm: 'Confirm your computer system', chosen: 'You chose ', detected: 'Detected ' },
  }[LANG];

  /* ---------- 读写客户的选择 ---------- */
  // 隐私模式、file:// 下 localStorage 可能直接抛错，全部吞掉
  const readSaved = () => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      return OS_LIST.includes(saved) ? saved : '';
    } catch {
      return '';
    }
  };

  const saveChoice = (os) => {
    try {
      localStorage.setItem(STORE_KEY, os);
    } catch {
      /* 存不下也没关系，本次会话仍然生效 */
    }
  };

  /* ---------- 文案 ---------- */
  // 页面上那行小字：「检测到你在用 / 你选择了 / 请确认」三选一
  const kickerText = (os, manual) => {
    if (!os) return T.confirm;
    return (manual ? T.chosen : T.detected) + OS_NAME[os];
  };

  /* ---------- 应用识别结果 ---------- */
  const applyOS = (os, manual) => {
    const root = document.documentElement;

    if (os) root.dataset.os = os;
    else delete root.dataset.os;

    // 胶囊：只有一个显示为「已选中」，其余是普通按钮
    $$('.os-pill').forEach((pill) => {
      pill.setAttribute('aria-pressed', String(pill.dataset.os === os));
    });

    const kicker = $('#detectKicker');
    if (kicker) kicker.textContent = kickerText(os, manual);
  };

  /* ---------- 客户点胶囊 ---------- */
  const initPills = () => {
    const pills = $$('.os-pill');
    if (!pills.length) return;

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const os = pill.dataset.os;
        if (!OS_LIST.includes(os)) return;
        saveChoice(os);
        applyOS(os, true);
      });
    });
  };

  /* ---------- 启动 ---------- */
  // index.html 的 <head> 里已经识别过一次了，这里读回来用，不重复识别
  const boot = () => {
    const saved = readSaved();
    const detected = document.documentElement.dataset.os || '';
    applyOS(saved || detected, Boolean(saved));
    initPills();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
