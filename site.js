/* AgentCore-Light 客户手册站点交互
   ---------------------------------------------------------------------------
   全部为渐进增强：脚本没加载时页面依然可以正常阅读。
   1) 深浅色切换（跟随系统，手动选择会记住）
   2) 阅读进度条
   3) 侧边目录高亮 + 平滑跳转
   4) 代码块一键复制
   5) 返回顶部
   6) 滚动进入视口的轻微上浮
   7) 语言切换的记忆
   --------------------------------------------------------------------------- */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- 0. 文案 ----------
     中英两版共用这一个脚本，页面上不重复出现的字符串在这里按语言取。
     「我是哪一语言」由构建时写死的 <html data-lang> 决定，不看网址。
     页面自己写死的文案（按钮初始文字、aria、页脚）在 HTML 里各写各的；
     这里只有那些**运行时才产生**的文字。 */
  const LANG = document.documentElement.dataset.lang === 'en' ? 'en' : 'zh';
  const T = {
    zh: {
      toDark: '切换到深色模式',
      toLight: '切换到浅色模式',
      copied: '已复制 ✓',
      copyFail: '请手动复制',
    },
    en: {
      toDark: 'Switch to dark mode',
      toLight: 'Switch to light mode',
      copied: 'Copied ✓',
      copyFail: 'Press Ctrl+C to copy',
    },
  }[LANG];

  /* ---------- 1. 深浅色切换 ---------- */
  const THEME_KEY = 'agentcore-manual-theme';

  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null; // 部分浏览器在 file:// 下禁止 localStorage
    }
  };

  const saveTheme = (value) => {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      /* 存不下也没关系，本次会话仍然生效 */
    }
  };

  const applyTheme = (value) => {
    const root = document.documentElement;
    if (value === 'dark' || value === 'light') {
      root.dataset.theme = value;
    } else {
      delete root.dataset.theme;
    }
  };

  const isDark = () => {
    const current = document.documentElement.dataset.theme;
    if (current === 'dark') return true;
    if (current === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const initThemeToggle = () => {
    const btn = $('#themeToggle');
    if (!btn) return;
    const sync = () => {
      const dark = isDark();
      btn.textContent = dark ? '☀️' : '🌙';
      btn.setAttribute('aria-label', dark ? T.toLight : T.toDark);
      btn.setAttribute('title', dark ? T.toLight : T.toDark);
    };
    btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      applyTheme(next);
      saveTheme(next);
      sync();
    });
    sync();
  };

  applyTheme(readTheme());

  /* ---------- 2. 阅读进度条 ---------- */
  const initProgress = () => {
    const bar = $('#progress');
    if (!bar) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.scale = `${ratio} 1`;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  };

  /* ---------- 3. 目录高亮 ---------- */
  const initToc = () => {
    const links = $$('.toc a[href^="#"]');
    if (!links.length) return;

    // 同一个标题可能对应多个链接（桌面侧栏 + 手机折叠目录），要一起高亮
    const byHeading = new Map();
    links.forEach((link) => {
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      const target = document.getElementById(id);
      if (!target) return;
      if (!byHeading.has(target)) byHeading.set(target, []);
      byHeading.get(target).push(link);
    });
    if (!byHeading.size) return;

    const headings = Array.from(byHeading.keys());
    const setActive = (heading) => {
      if (!heading) return;
      const current = byHeading.get(heading);
      links.forEach((item) => item.classList.toggle('active', current.includes(item)));
    };
    const headingForLink = (link) => {
      for (const [heading, list] of byHeading) {
        if (list.includes(link)) return heading;
      }
      return null;
    };

    // 视口上方最近的一个标题 = 客户正在读的小节
    const update = () => {
      const offset = 110;
      let current = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - offset <= 0) current = heading;
        else break;
      }
      setActive(current);
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    // 点击后先高亮，避免等待滚动结束才变色
    links.forEach((link) => {
      link.addEventListener('click', () => setActive(headingForLink(link)));
    });

    update();
  };

  /* ---------- 4. 代码块复制 ---------- */
  const initCopyButtons = () => {
    $$('.code-block').forEach((block) => {
      const btn = $('.copy-btn', block);
      const code = $('code', block);
      if (!btn || !code) return;
      const original = btn.textContent;
      btn.addEventListener('click', async () => {
        const text = code.textContent;
        let ok = false;
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          // 非安全上下文（例如直接双击打开的 file:// 页面）走兜底方案
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          try {
            ok = document.execCommand('copy');
          } catch {
            ok = false;
          }
          document.body.removeChild(area);
        }
        btn.textContent = ok ? T.copied : T.copyFail;
        btn.classList.toggle('done', ok);
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('done');
        }, 1600);
      });
    });
  };

  /* ---------- 5. 返回顶部 ---------- */
  const initToTop = () => {
    const btn = $('#toTop');
    if (!btn) return;
    const update = () => btn.classList.toggle('show', window.scrollY > 420);
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', update, { passive: true });
    update();
  };

  /* ---------- 6. 滚动上浮 ---------- */
  const initReveal = () => {
    const targets = $$('[data-reveal]');
    if (!targets.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        });
      },
      // 触发的范围要略大于视口：否则停在视口最底部的内容（页面已经到底、滚不动了）
      // 永远进不了触发区，就一直是透明的。
      { rootMargin: '0px 0px 90px 0px', threshold: 0.01 }
    );

    targets.forEach((target) => {
      target.classList.add('reveal');
      observer.observe(target);
    });
  };

  /* ---------- 7. 语言切换的记忆 ---------- */
  /* 顶栏那个「EN / 中文」胶囊是普通链接，没有脚本也能用，只是不记忆。
     点它的时候顺手把选择记下来，首页的自动识别下次就不会再把客户弹回另一边。
     不 preventDefault：让浏览器照常导航，中键 / ⌘ / Ctrl / 在新标签页打开
     一律原样交给它，这里只管记一笔。 */
  const initLangSwitch = () => {
    document.addEventListener('click', (event) => {
      const link = event.target.closest && event.target.closest('.tab-lang');
      if (!link || !link.dataset.lang) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      try {
        localStorage.setItem('agentcore-lang', link.dataset.lang);
      } catch {
        /* 存不下也没关系，这一次跳转照样生效 */
      }
    });
  };

  const boot = () => {
    initThemeToggle();
    initProgress();
    initToc();
    initCopyButtons();
    initToTop();
    initReveal();
    initLangSwitch();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
