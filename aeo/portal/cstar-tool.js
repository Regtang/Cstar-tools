/* ============================================================
   Cstar Tool JS — 喜事达工具平台 共享标准功能库 v1.0
   用法：在工具 HTML 引入即可（任何工具、任何 AI 生成的页面通用）：
     <script src="/cstar-tool.js"></script>
   提供：数据存储 / 历史台账 / 表单校验 / 电子签名 / 自动编号 /
        导出 CSV·JSON / 打印 / 嵌入模式 等标准功能，免去重复造轮子。
   线上地址：https://bot.regs.com/cstar-tool.js   （配合 /cstar-ui.css 使用）
   依赖：无。
   ============================================================ */
(function (w) {
  "use strict";

  // —— 嵌入模式：引入本库即自动处理 ?embed=1（首页弹窗内隐藏 .cs-header）——
  try {
    document.documentElement.classList.toggle(
      "embed-mode", new URLSearchParams(location.search).get("embed") === "1");
  } catch (e) {}

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- 通用下载 ---------- */
  function download(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "download.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- ① 数据存储（localStorage） ---------- */
  const store = {
    save(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (e) { return false; } },
    load(key, dflt) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? dflt : v; } catch (e) { return dflt; } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
    /* 绑定一组输入框的「自动暂存 + 恢复」。ids: 元素 id 数组。
       调用即恢复上次内容，并在输入时自动保存。返回 {save, restore, clear}。*/
    bindForm(key, ids, opts) {
      opts = opts || {};
      const get = id => { const el = $(id); return el ? (el.type === "checkbox" ? el.checked : el.value) : undefined; };
      const set = (id, v) => { const el = $(id); if (!el || v == null) return; if (el.type === "checkbox") el.checked = !!v; else el.value = v; };
      const save = () => { const o = {}; ids.forEach(id => o[id] = get(id)); store.save(key, o); };
      const restore = () => { const o = store.load(key, null); if (!o) return false; ids.forEach(id => { if (id in o) set(id, o[id]); }); if (opts.onRestore) opts.onRestore(o); return true; };
      const clear = () => store.remove(key);
      ids.forEach(id => { const el = $(id); if (el) { el.addEventListener("input", save); el.addEventListener("change", save); } });
      restore();
      return { save, restore, clear };
    }
  };

  /* ---------- ② 历史台账（记录 CRUD + 搜索 + 导出） ---------- */
  class Records {
    constructor(key, cap) { this.key = key; this.cap = cap || 500; }
    all() { return store.load(this.key, []); }
    add(rec) { const l = this.all(); l.unshift(Object.assign({ _ts: Date.now() }, rec)); store.save(this.key, l.slice(0, this.cap)); return l[0]; }
    get(i) { return this.all()[i]; }
    update(i, rec) { const l = this.all(); if (l[i]) { l[i] = Object.assign({}, l[i], rec); store.save(this.key, l); } }
    remove(i) { const l = this.all(); l.splice(i, 1); store.save(this.key, l); }
    clear() { store.remove(this.key); }
    /* 搜索：{text, fields:[字段名], from, to, dateField} */
    search(q) {
      q = q || {};
      const t = (q.text || "").toString().toUpperCase();
      const fields = q.fields || [];
      const df = q.dateField || "";
      return this.all().filter(r => {
        if (t && fields.length) { const hay = fields.map(f => r[f] || "").join(" ").toUpperCase(); if (!hay.includes(t)) return false; }
        if (df && (q.from || q.to)) { const day = (r[df] || "").slice(0, 10); if (q.from && day && day < q.from) return false; if (q.to && day && day > q.to) return false; }
        return true;
      });
    }
    /* 导出 CSV：columns = [[字段名, 表头], ...]；rows 默认全部 */
    exportCSV(filename, columns, rows) {
      rows = rows || this.all();
      const head = columns.map(c => c[1]).join(",");
      const body = rows.map(r => columns.map(c => '"' + String(r[c[0]] == null ? "" : r[c[0]]).replace(/"/g, '""') + '"').join(",")).join("\n");
      download("﻿" + head + "\n" + body, filename || "export.csv", "text/csv;charset=utf-8");
    }
    /* 导出 Excel（.xls）：columns = [[字段名, 表头], ...]；rows 默认全部 */
    exportExcel(filename, columns, rows) {
      rows = rows || this.all();
      exportExcelData(columns.map(c => c[1]), rows.map(r => columns.map(c => r[c[0]] == null ? "" : r[c[0]])), filename || "export.xls");
    }
  }

  /* ---------- ③ 电子签名（canvas，鼠标/触屏） ---------- */
  function signature(canvasId) {
    const c = $(canvasId); if (!c) return null;
    const ctx = c.getContext("2d"); let on = false, dirty = false, onEnd = null;
    const pos = e => { const r = c.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * (c.width / r.width), (t.clientY - r.top) * (c.height / r.height)]; };
    const start = e => { on = true; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); };
    const move = e => { if (!on) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.strokeStyle = "#1f2a37"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke(); dirty = true; e.preventDefault(); };
    const end = () => { if (on) { on = false; if (onEnd) onEnd(); } };
    c.addEventListener("mousedown", start); c.addEventListener("mousemove", move); w.addEventListener("mouseup", end);
    c.addEventListener("touchstart", start, { passive: false }); c.addEventListener("touchmove", move, { passive: false }); c.addEventListener("touchend", end);
    const api = {
      clear() { ctx.clearRect(0, 0, c.width, c.height); dirty = false; },
      isEmpty() { const d = ctx.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; },
      toDataURL() { return api.isEmpty() ? "" : c.toDataURL("image/png"); },
      fromDataURL(u) { if (!u) return; const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = u; },
      onEnd(fn) { onEnd = fn; }
    };
    return api;
  }

  /* ---------- ④ 表单校验（必填/格式） ---------- */
  /* rules: [{id, required, pattern(正则或函数), msg}]，返回 {ok, errors:[msg], firstError} */
  function validate(rules) {
    const errors = [];
    rules.forEach(rl => {
      const el = $(rl.id); if (!el) return;
      const v = (el.value || "").trim();
      let bad = false;
      if (rl.required && !v) bad = true;
      else if (v && rl.pattern) { bad = rl.pattern instanceof RegExp ? !rl.pattern.test(v) : !rl.pattern(v); }
      el.classList.toggle("cs-field-error", bad);
      if (bad) errors.push(rl.msg || (rl.id + " 不合法"));
    });
    return { ok: errors.length === 0, errors, firstError: errors[0] || "" };
  }

  /* ---------- ⑤ 自动编号 ---------- */
  /* serial('EIR') => CSTAR-EIR-YYYYMMDD-XXXX（XXXX 由 seed 决定，可重现） */
  function serial(prefix, seed, date) {
    const dt = (date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    let n = String(seed || (Math.random() + "")).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return "CSTAR-" + (prefix || "DOC") + "-" + dt + "-" + String(n % 9000 + 1000);
  }

  /* ---------- 导出 / 打印 / 日期 ---------- */
  const exportJSON = (obj, filename) => download(JSON.stringify(obj, null, 2), filename || "data.json", "application/json");
  const print = () => w.print();

  const _el = x => (typeof x === "string" ? $(x) : x);
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  /* 导出 Word（.doc）：Office-HTML 方案，无需联网/库。htmlOrEl=元素id/元素/HTML字符串 */
  function exportWord(htmlOrEl, filename) {
    let inner = typeof htmlOrEl === "string" && !/[<>]/.test(htmlOrEl) ? (_el(htmlOrEl) || {}).innerHTML : (htmlOrEl && htmlOrEl.nodeType ? htmlOrEl.innerHTML : htmlOrEl);
    inner = inner || "";
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:"Microsoft YaHei",sans-serif;color:#1f2a37}table{border-collapse:collapse}td,th{border:1px solid #999;padding:5px 8px;font-size:12pt}</style></head><body>' + inner + "</body></html>";
    download("﻿" + html, filename || "document.doc", "application/msword");
  }

  /* 导出 Excel（.xls）：Office-HTML 方案，无需联网/库。传入 <table> 元素/id 或任意含表格的元素 */
  function exportExcel(htmlOrEl, filename) {
    let inner = htmlOrEl && htmlOrEl.nodeType ? htmlOrEl.outerHTML : (_el(htmlOrEl) || {}).outerHTML;
    inner = inner || "";
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>' + inner + "</body></html>";
    download("﻿" + html, filename || "data.xls", "application/vnd.ms-excel");
  }

  /* 用二维数据导出 Excel（.xls）：columns=[表头...]，rows=[[...]...] */
  function exportExcelData(columns, rows, filename) {
    const th = "<tr>" + columns.map(c => "<th>" + esc(c) + "</th>").join("") + "</tr>";
    const tb = rows.map(r => "<tr>" + r.map(c => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("");
    const table = '<table border="1">' + th + tb + "</table>";
    const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>' + table + "</body></html>";
    download("﻿" + html, filename || "data.xls", "application/vnd.ms-excel");
  }

  /* 导出 PDF：用 cdnjs 的 html2canvas + jsPDF（按 A4 自动分页）；不可用时回退打印 */
  async function exportPDF(elId, filename) {
    const el = _el(elId); if (!el) return;
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      const canvas = await w.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      const JsPDF = (w.jspdf && w.jspdf.jsPDF) || w.jsPDF;
      const pdf = new JsPDF("p", "mm", "a4");
      const pw = 210, ph = 297, iw = pw, ih = canvas.height * pw / canvas.width;
      let heightLeft = ih, pos = 0;
      pdf.addImage(img, "JPEG", 0, pos, iw, ih); heightLeft -= ph;
      while (heightLeft > 0) { pos -= ph; pdf.addPage(); pdf.addImage(img, "JPEG", 0, pos, iw, ih); heightLeft -= ph; }
      pdf.save(filename || "document.pdf");
    } catch (e) {
      alert("PDF 导出组件加载失败（需联网），已改用打印——在打印对话框选「另存为 PDF」即可。");
      w.print();
    }
  }
  const today = () => new Date().toISOString().slice(0, 10);
  const nowStr = () => new Date().toLocaleString("zh-CN", { hour12: false });

  /* ---------- 给图片烧入时间水印（证据留痕，返回 dataURL Promise） ---------- */
  function watermarkPhoto(file, extra, maxW) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) return reject("非图片");
      const r = new FileReader();
      r.onload = () => { const img = new Image(); img.onload = () => {
        const max = maxW || 900, sc = Math.min(1, max / img.width);
        const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const txt = nowStr() + (extra ? "　" + extra : "");
        const fs = Math.max(13, Math.round(cv.width / 36)); ctx.font = "bold " + fs + "px sans-serif";
        const bh = fs + 12, tw = ctx.measureText(txt).width;
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, cv.height - bh, tw + 20, bh);
        ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(txt, 10, cv.height - bh / 2);
        resolve(cv.toDataURL("image/jpeg", 0.7));
      }; img.src = r.result; };
      r.onerror = reject; r.readAsDataURL(file);
    });
  }

  /* ---------- 作者姓名 + 版本号（标准必备）：页脚署名 + 供单据引用 ---------- */
  function stamp(o) {
    o = o || {};
    const info = { tool: o.tool || (document.title || "工具").split("·")[0].trim(), version: o.version || "v1.0.0", author: o.author || "喜事达 · Cstar" };
    w.Cstar.info = info;
    const txt = info.tool + "　" + info.version + "　·　作者 " + info.author + "　·　喜事达工具平台 CSTAR";
    let f = $("cs-stamp");
    if (!f) { f = document.createElement("div"); f.id = "cs-stamp"; f.className = "cs-footer"; f.style.textAlign = "center"; (document.body || document.documentElement).appendChild(f); }
    f.textContent = txt;
    return info;
  }
  /* 取署名一行（放进生成的单据/导出内容里） */
  function stampLine() {
    const i = w.Cstar.info || {};
    return (i.tool || "") + " " + (i.version || "") + " · 作者 " + (i.author || "") + " · 喜事达工具平台 CSTAR";
  }

  /* ---------- 喜事达通行证（统一账号）auth ----------
     token 存 localStorage `cstar_token`（兼容读取旧 `aeo_token`）。
     登录/注册/找回密码统一走 /account.html（通行证页）。 */
  const auth = {
    KEY: "cstar_token", LEGACY: "aeo_token",
    token() {
      try { return localStorage.getItem(this.KEY) || localStorage.getItem(this.LEGACY) || ""; } catch (e) { return ""; }
    },
    setToken(t) {
      try { localStorage.setItem(this.KEY, t); localStorage.setItem(this.LEGACY, t); } catch (e) {}
    },
    clear() {
      try { localStorage.removeItem(this.KEY); localStorage.removeItem(this.LEGACY); } catch (e) {}
    },
    headers() { const t = this.token(); return t ? { Authorization: "Bearer " + t } : {}; },
    /* 通行证页地址；next 仅允许站内路径 */
    loginUrl(next) {
      next = next || (location.pathname + location.search);
      if (!/^\/[^/]/.test(next)) next = "/";
      return "/account.html?next=" + encodeURIComponent(next);
    },
    gotoLogin(next) { location.href = this.loginUrl(next); },
    /* 取当前用户；未登录或失效返回 null（失效自动清 token） */
    async me() {
      const t = this.token(); if (!t) return null;
      try {
        const r = await fetch("/api/me", { headers: { Authorization: "Bearer " + t } });
        if (r.status === 401) { this.clear(); return null; }
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    }
  };

  w.Cstar = {
    $, esc, download, store, Records, records: (k, cap) => new Records(k, cap),
    signature, validate, serial, today, nowStr, watermarkPhoto,
    print, exportJSON, exportWord, exportExcel, exportExcelData, exportPDF, loadScript,
    stamp, stampLine, info: null, auth
  };
})(window);
