/* ===== Service worker (modo instalável): o próprio v2.js é registrado como service worker; nas páginas esse trecho não roda ===== */
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.window = self; // o resto do arquivo só define funções; nada aqui usa a tela
  // Guarda uma cópia dos arquivos do app para abrir mesmo sem internet.
  // Sempre tenta a internet primeiro (assim as atualizações chegam); só usa a cópia se estiver offline.
  const CACHE = 'joaninha-app-v2';
  const BASE = ['./', 'index.html', 'escoteira.html', 'tropa-senior.html', 'alcateia.html', 'cla-pioneiro.html', 'diretoria.html', 'Apoio/secao.css', 'visualizacao.html', 'formacao.html', 'Apoio/competencias.js', 'sw.js', 'Apoio/v2.js', 'Apoio/manifest.webmanifest'];

  self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(BASE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
  });
  self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
  });
  self.addEventListener('fetch', (e) => {
    const r = e.request;
    if (r.method !== 'GET') return;
    const u = new URL(r.url);
    if (u.origin !== location.origin) return; // Firebase e outros sites passam direto
    e.respondWith(
      fetch(r, { cache: 'no-cache' }).then((res) => { // 'no-cache': sempre confere se há versão nova (não usa a cópia temporária do navegador)
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); }
        return res;
      }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('index.html')))
    );
  });

}
// Seção aberta escondida dentro da Diretoria (só para ler os números do relatório): nada de pop-ups.
try {
  if (typeof document !== 'undefined' && window.parent !== window && /[?&]resumo=1/.test(location.search)) {
    window.alert = function () {};
    // modo só leitura: esta cópia da seção (escondida na Diretoria) NUNCA grava nada no banco
    // e não mexe no armazenamento do navegador (cópias locais, pendências, sessão): só o login pode renovar o token
    try {
      var _set = Storage.prototype.setItem, _rem = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (k, val) { if (k === 'chefeSessao') return _set.call(this, k, val); };
      Storage.prototype.removeItem = function () {};
    } catch (e) {}
    var _fetchOrig = window.fetch.bind(window);
    window.fetch = function (u, o) {
      var m = ((o && o.method) || (u && u.method) || 'GET').toUpperCase();
      if (m !== 'GET' && /firebaseio\.com/.test(String((u && u.url) || u))) return Promise.resolve(new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return _fetchOrig(u, o);
    };
  }
} catch (e) {}

/* ---------- ícones dos ramos (SVG na cor do ramo; icoTxt = versão em texto para listas de seleção) ---------- */
(function () {
  var COR = { escoteira: '#2E8B57', senior: '#7B1E3A', cla: '#D32F2F', diretoria: '#1F5FBF' };
  var EMO = { alcateia: '🐺', escoteira: '⚜️', senior: '🧭', cla: '🦉' };
  var SVG = {
    escoteira: '<path d="M12 1.2c2.3 2.7 3.1 5.2 2.5 7.6-.4 1.6-1.4 2.8-2.5 3.8-1.1-1-2.1-2.2-2.5-3.8C8.9 6.4 9.7 3.9 12 1.2z"/><path d="M8.2 6.9C5.4 6.6 3 8.3 2.8 10.8c-.2 2.3 1.4 4 3.5 4.1 1.4.1 2.6-.5 3.4-1.5-1.7-.2-3-1-3.5-2.3-.5-1.4 0-2.7 1.4-3.5-.4-.4-.9-.7-1.4-.7z"/><path d="M15.8 6.9c2.8-.3 5.2 1.4 5.4 3.9.2 2.3-1.4 4-3.5 4.1-1.4.1-2.6-.5-3.4-1.5 1.7-.2 3-1 3.5-2.3.5-1.4 0-2.7-1.4-3.5.4-.4.9-.7 1.4-.7z"/><rect x="6.5" y="15.2" width="11" height="2.1" rx="1"/><path d="M9.3 17.6h5.4l1.3 5-4-2-4 2z"/>',
    senior: '<path d="M12 .8l2.2 9 8.8 2.2-8.8 2.2-2.2 9-2.2-9L1 12l8.8-2.2z"/><path transform="rotate(45 12 12) translate(12 12) scale(.6) translate(-12 -12)" opacity=".7" d="M12 .8l2.2 9 8.8 2.2-8.8 2.2-2.2 9-2.2-9L1 12l8.8-2.2z"/><circle cx="12" cy="12" r="2.2" fill="#fff" opacity=".85"/>',
    cla: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 2.5v6.2a6.5 6.5 0 0 0 13 0V2.5"/><path d="M12 2.5v19"/></g>',
    diretoria: '<g fill="none"><g stroke="currentColor" stroke-width="3.4"><ellipse cx="12" cy="12" rx="9.4" ry="4.6"/><ellipse cx="12" cy="12" rx="9.4" ry="4.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.4" ry="4.6" transform="rotate(-60 12 12)"/></g><g stroke="#fff" stroke-width="1" opacity=".75"><ellipse cx="12" cy="12" rx="9.4" ry="4.6"/><ellipse cx="12" cy="12" rx="9.4" ry="4.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.4" ry="4.6" transform="rotate(-60 12 12)"/></g></g>'
  };
  window.icoRamo = function (id, px, cor) {
    if (EMO[id]) return EMO[id];
    if (!SVG[id]) return '';
    var t = (px || 1.15) + 'em';
    return '<svg class="ico-ramo" viewBox="0 0 24 24" width="' + t + '" height="' + t + '" fill="currentColor" aria-hidden="true" style="display:inline-block;vertical-align:-.2em;color:' + (cor || COR[id]) + '">' + SVG[id] + '</svg>';
  };
  window.icoTxt = { alcateia: '🐺', escoteira: '⚜️', senior: '🧭', cla: '🦉', diretoria: '\uD83E\uDEA2' };
  window.icoCor = COR;
  // Listas de seleção: o menu nativo do navegador ficava ilegível (texto fora da caixa) com extensões de modo escuro.
  // No computador, o clique abre um menu próprio (cores fixas, texto sempre dentro da caixa); no celular continua o seletor nativo.
  if (typeof document !== 'undefined') {
    (function () {
      var st = document.createElement('style');
      st.textContent = '.cs-panel{position:fixed;z-index:100010;background:#fff;color:#222;border:1px solid #bbb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.28);overflow-y:auto;overflow-x:hidden;padding:4px;box-sizing:border-box;font-family:inherit;}' +
        '.cs-grp{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#666;padding:8px 10px 4px;}' +
        '.cs-opt{display:block;width:100%;text-align:left;padding:9px 10px;border:none;border-radius:7px;background:transparent;color:#222;font:inherit;font-size:13px;line-height:1.3;white-space:normal;word-break:break-word;cursor:pointer;}' +
        '.cs-opt:hover,.cs-opt.cs-foco{background:#E6EEF9;}' +
        '.cs-opt.cs-sel{font-weight:800;background:#F1ECE4;}' +
        '.cs-opt.cs-sel::after{content:" ✓";}' +
        '.cs-opt[disabled]{opacity:.45;cursor:not-allowed;}';
      (document.head || document.documentElement).appendChild(st);
      var painel = null, alvo = null, itens = [], foco = -1;
      function fechar() { if (painel) { painel.remove(); painel = null; } alvo = null; itens = []; foco = -1; }
      function escolher(sel, op) {
        if (op.disabled) return;
        var mudou = sel.value !== op.value; sel.value = op.value; fechar();
        if (mudou) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
        try { sel.focus({ preventScroll: true }); } catch (e) {}
      }
      function marcarFoco(i) {
        if (!itens.length) return;
        foco = (i + itens.length) % itens.length;
        itens.forEach(function (b, k) { b.classList.toggle('cs-foco', k === foco); });
        itens[foco].scrollIntoView({ block: 'nearest' });
      }
      function abrir(sel) {
        fechar(); alvo = sel;
        var cs = getComputedStyle(sel), r = sel.getBoundingClientRect();
        painel = document.createElement('div'); painel.className = 'cs-panel'; painel.setAttribute('role', 'listbox');
        painel.style.fontFamily = cs.fontFamily;
        Array.prototype.forEach.call(sel.children, function (n) {
          function add(op) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'cs-opt' + (op.selected ? ' cs-sel' : ''); b.textContent = op.textContent || ' ';
            if (op.disabled) b.disabled = true;
            b.addEventListener('mousedown', function (e) { e.preventDefault(); });
            b.addEventListener('click', function (e) { e.stopPropagation(); escolher(sel, op); });
            painel.appendChild(b); itens.push(b);
          }
          if (n.tagName === 'OPTGROUP') { var g = document.createElement('div'); g.className = 'cs-grp'; g.textContent = n.label; painel.appendChild(g); Array.prototype.forEach.call(n.children, add); }
          else if (n.tagName === 'OPTION') add(n);
        });
        document.body.appendChild(painel);
        var largura = Math.max(r.width, 180), vh = window.innerHeight, abaixo = vh - r.bottom - 8, acima = r.top - 8;
        var h = Math.min(painel.scrollHeight + 2, 340);
        var emCima = abaixo < Math.min(h, 200) && acima > abaixo;
        painel.style.width = Math.min(largura, window.innerWidth - 16) + 'px';
        painel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.min(largura, window.innerWidth - 16) - 8)) + 'px';
        painel.style.maxHeight = Math.max(120, Math.min(340, emCima ? acima : abaixo)) + 'px';
        if (emCima) painel.style.bottom = (vh - r.top + 2) + 'px'; else painel.style.top = (r.bottom + 2) + 'px';
        var i = 0; Array.prototype.forEach.call(sel.options, function (op, k) { if (op.selected) i = k; });
        var sele = painel.querySelector('.cs-sel'); if (sele) sele.scrollIntoView({ block: 'nearest' });
        foco = itens.indexOf(sele);
      }
      document.addEventListener('pointerdown', function (e) {
        var t = e.target;
        if (painel && painel.contains(t)) return;
        var sel = t && t.closest ? t.closest('select') : null;
        if (sel && e.pointerType !== 'touch' && !sel.disabled && !sel.multiple && !(sel.size > 1)) { e.preventDefault(); if (alvo === sel) fechar(); else abrir(sel); return; }
        fechar();
      }, true);
      document.addEventListener('keydown', function (e) {
        if (painel) {
          if (e.key === 'Escape') { e.preventDefault(); fechar(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); marcarFoco(foco + 1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); marcarFoco(foco - 1); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var op = alvo && alvo.options[0] ? null : null; if (foco >= 0 && itens[foco]) itens[foco].click(); }
          return;
        }
        var t = e.target;
        if (t && t.tagName === 'SELECT' && !t.multiple && !(t.size > 1) && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey !== undefined) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') return; e.preventDefault(); abrir(t); }
      }, true);
      window.addEventListener('resize', fechar);
      window.addEventListener('scroll', function (e) { if (painel && !(e.target && e.target.nodeType === 1 && painel.contains(e.target))) fechar(); }, true);
    })();
  }
  if (typeof document !== 'undefined') {
    var preencher = function () { Array.prototype.forEach.call(document.querySelectorAll('[data-ico]'), function (e) { if (!e.firstChild) e.innerHTML = window.icoRamo(e.getAttribute('data-ico')); }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preencher); else preencher();
  }
})();

/* ============================================================
   v2-config.js — configuração única da migração (Firebase v2)
   Edite SÓ este arquivo quando o tutorial pedir.
   ============================================================ */
window.V2_CONFIG = {
  // Banco de dados (os mesmos valores que já existem nos seus apps)
  DB_URL: "https://joaninha-progressao-default-rtdb.firebaseio.com",
  API_KEY: "AIzaSyB50r7SU6qU_dwq03v_oQksLi1bAxbU614",

  // Pasta nova do banco onde os dados migrados ficam (o app antigo NÃO usa).
  RAIZ: "v2",

  // Nomes das páginas: "-v2" durante o teste; "" quando você for oficializar.
  SUFIXO: "",

  // true = mostra a faixa laranja "VERSÃO DE TESTE". Mude para false ao oficializar.
  MODO_TESTE: false,

  // Listas de objetos que têm "id" próprio: viram nós pelo id (e não pela posição).
  ID_ARRAYS: {
    escoteira: ["eventos", "extraJovens", "patrulhas"],
    senior: ["PATRULHAS_SR"]
  },

  LIMITE_ANEXO_MB: 3,

  // Mude este texto quando publicar uma versão nova: força o navegador a baixar de novo a página da Sênior.
  VERSAO: "2026-11-13b"
};

/* ============================================================
   v2-core.js — motor da migração
   - converte  "objeto grande"  <->  nós reais do Firebase
   - salva SÓ o que mudou (nada de regravar tudo)
   - sincronização em tempo real (EventSource)
   - anexos em /v2/anexos (sem precisar do Storage pago)
   ============================================================ */
(function (root) {
  'use strict';
  var CFG = root.V2_CONFIG || {};
  var VAZIO_ARR = '$$[]', VAZIO_OBJ = '$$obj';

  /* ---------- chaves seguras ---------- */
  function escCodes(k) {
    k = String(k);
    if (k === '') return '!_';
    return k.replace(/[!.$#\[\]\/\u0000-\u001f\u007f]/g, function (c) {
      return '!' + ('0' + c.charCodeAt(0).toString(16)).slice(-2);
    });
  }
  function escKey(k) {
    var r = escCodes(k);
    // chaves só com dígitos virariam "lista" no Firebase; chaves i0000 colidiriam com nossas listas
    if (/^(\d+|i\d{4,})$/.test(r)) r = '!k' + r;
    return r;
  }
  function unescKey(k) {
    if (k === '!_') return '';
    if (k.indexOf('!k') === 0) k = k.slice(2);
    return k.replace(/!([0-9a-f]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
  }

  /* ---------- objeto -> árvore ---------- */
  function enc(v) {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) {
      var o = {}, n = 0;
      v.forEach(function (x, i) {
        var e = enc(x);
        if (e !== undefined) { o['i' + String(i).padStart(4, '0')] = e; n++; }
      });
      return n ? o : VAZIO_ARR;
    }
    switch (typeof v) {
      case 'object':
        var r = {}, c = 0;
        Object.keys(v).forEach(function (k) {
          var e = enc(v[k]);
          if (e !== undefined) { r[escKey(k)] = e; c++; }
        });
        return c ? r : VAZIO_OBJ;
      case 'number': return isFinite(v) ? v : undefined;
      case 'boolean': case 'string': return v;
      default: return undefined;
    }
  }
  function podePorId(arr) {
    var vistos = {};
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (!it || typeof it !== 'object' || Array.isArray(it) || it.id === undefined || it.id === null || it.id === '') return false;
      var k = String(it.id);
      if (vistos[k]) return false;
      vistos[k] = 1;
    }
    return arr.length > 0;
  }
  function encPorId(arr) {
    var o = {};
    arr.forEach(function (it, i) {
      var c = {}; Object.keys(it).forEach(function (k) { c[k] = it[k]; });
      c._o = i;
      o['k_' + escCodes(String(it.id))] = enc(c);
    });
    return o;
  }
  function encDados(dados, ids) {
    var out = {};
    Object.keys(dados || {}).forEach(function (k) {
      var v = dados[k], e;
      if (ids && ids.indexOf(k) >= 0 && Array.isArray(v) && podePorId(v)) e = encPorId(v);
      else e = enc(v);
      if (e !== undefined) out[escKey(k)] = e;
    });
    return out;
  }

  /* ---------- árvore -> objeto ---------- */
  function dec(v) {
    if (v === VAZIO_ARR) return [];
    if (v === VAZIO_OBJ) return {};
    if (Array.isArray(v)) return v.map(dec);
    if (v && typeof v === 'object') {
      var ks = Object.keys(v);
      if (ks.length && ks.every(function (k) { return /^i\d{4,}$/.test(k); })) {
        var max = -1;
        ks.forEach(function (k) { max = Math.max(max, parseInt(k.slice(1), 10)); });
        var a = new Array(max + 1).fill(null);
        ks.forEach(function (k) { a[parseInt(k.slice(1), 10)] = dec(v[k]); });
        return a;
      }
      var o = {};
      ks.forEach(function (k) { o[unescKey(k)] = dec(v[k]); });
      return o;
    }
    return v;
  }
  function decCampo(nome, v, ids) {
    if (ids && ids.indexOf(nome) >= 0 && v && typeof v === 'object' && !Array.isArray(v)) {
      var ks = Object.keys(v);
      if (ks.length && ks.every(function (k) { return k.indexOf('k_') === 0; })) {
        var itens = ks.map(function (k) { return dec(v[k]); });
        itens.sort(function (a, b) { return (a._o === undefined ? 1e9 : a._o) - (b._o === undefined ? 1e9 : b._o); });
        itens.forEach(function (x) { delete x._o; });
        return itens;
      }
    }
    return dec(v);
  }
  function decDados(tree, ids) {
    var o = {};
    Object.keys(tree || {}).forEach(function (k) { var n = unescKey(k); o[n] = decCampo(n, tree[k], ids); });
    return o;
  }

  /* ---------- comparação ---------- */
  function flatten(t, p, out) {
    out = out || {};
    if (t && typeof t === 'object') {
      Object.keys(t).forEach(function (k) { flatten(t[k], p ? p + '/' + k : k, out); });
    } else if (t !== undefined && p) out[p] = t;
    return out;
  }
  function diff(base, novo) {
    var sets = {}, dels = {}, ns = 0, nd = 0, antes = {};
    Object.keys(novo).forEach(function (k) { if (!(k in base) || base[k] !== novo[k]) { sets[k] = novo[k]; antes[k] = (k in base) ? base[k] : null; ns++; } });
    Object.keys(base).forEach(function (k) { if (!(k in novo)) { dels[k] = null; antes[k] = base[k]; nd++; } });
    return { sets: sets, dels: dels, nSets: ns, nDels: nd, antes: antes };
  }
  function iguaisFlat(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) if (!(ka[i] in b) || a[ka[i]] !== b[ka[i]]) return false;
    return true;
  }
  // forma "canônica" p/ conferir se nada se perdeu (ignora null e vazios de ponta)
  function canon(v) {
    if (Array.isArray(v)) {
      var a = v.map(canon);
      while (a.length && (a[a.length - 1] === null || a[a.length - 1] === undefined)) a.pop();
      return a;
    }
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).sort().forEach(function (k) {
        var c = canon(v[k]);
        if (c !== null && c !== undefined) o[k] = c;
      });
      return o;
    }
    if (typeof v === 'number' && !isFinite(v)) return null;
    return v === undefined ? null : v;
  }
  function canonStr(v) { return JSON.stringify(canon(v)); }

  /* ---------- cópia local da árvore ---------- */
  function setAt(rootObj, parts, data) {
    if (!parts.length) return data === undefined ? null : data;
    var r = (rootObj && typeof rootObj === 'object') ? rootObj : {};
    var cur = r;
    for (var i = 0; i < parts.length - 1; i++) {
      var p = parts[i];
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    var last = parts[parts.length - 1];
    if (data === null || data === undefined) delete cur[last]; else cur[last] = data;
    return r;
  }
  function podar(o) {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (v && typeof v === 'object') { podar(v); if (!Object.keys(v).length) delete o[k]; }
    });
  }
  function aplicarMulti(tree, mapa) { // simula o PATCH do Firebase (usado nos testes)
    Object.keys(mapa).forEach(function (p) { tree = setAt(tree, p.split('/'), mapa[p]); });
    podar(tree);
    return tree;
  }

  /* ---------- autenticação (cada app informa como obter o token) ---------- */
  var auth = { getToken: function () { return null; }, renovar: null };
  function configurarAuth(a) { if (a.getToken) auth.getToken = a.getToken; if (a.renovar) auth.renovar = a.renovar; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fetchTimeout(url, opt, ms) {
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms) : null;
    opt = opt || {}; if (ctl) opt.signal = ctl.signal;
    return fetch(url, opt).finally(function () { if (t) clearTimeout(t); });
  }

  /* ---------- store (banco em tempo real) ---------- */
  function criarStore(o) {
    var ids = (CFG.ID_ARRAYS || {})[o.node] || [];
    var raiz = CFG.DB_URL + '/' + CFG.RAIZ + '/' + o.node;
    var cache = null, baseFlat = {}, carregou = false, bloqueado = false, timerCache = null, offline = false, sincronizando = false, timerSinc = null;
    var es = null, fila = Promise.resolve(), salvando = 0, sujo = false, timerAp = null, timerRetry = null, fechado = false;

    function token() { return (o.getToken ? o.getToken() : null) || auth.getToken(); }
    function renovar() { return o.renovarToken ? o.renovarToken() : (auth.renovar ? auth.renovar() : Promise.resolve()); }
    function url(sub) {
      var t = token();
      return raiz + (sub || '') + '.json' + (t ? '?auth=' + encodeURIComponent(t) : '');
    }
    function guardarCache() {
      clearTimeout(timerCache);
      timerCache = setTimeout(function () { try { localStorage.setItem('v2cache_' + o.node, JSON.stringify(cache)); } catch (e) {} }, 3000);
    }
    function lerCache() {
      var dados = cache ? decDados(cache, ids) : null;
      baseFlat = cache ? flatten(encDados(dados, ids)) : {};
      return dados;
    }

    async function carregar() {
      var ultimo;
      for (var i = 1; i <= 3; i++) {
        try {
          var r = await fetchTimeout(url(''), {}, 15000);
          if (r.status === 401 || r.status === 403) { try { await renovar(); } catch (e) {} throw new Error('HTTP ' + r.status); }
          if (!r.ok) throw new Error('HTTP ' + r.status);
          cache = await r.json();
          if (cache && typeof cache !== 'object') cache = null;
          carregou = true;
          try { localStorage.setItem('v2cache_' + o.node, JSON.stringify(cache)); } catch (e) {}
          return lerCache();
        } catch (e) { ultimo = e; await sleep(1200 * i); }
      }
      // o banco respondeu, mas recusou a sessão (não é falta de internet): pede para entrar de novo
      if (ultimo && /^HTTP (401|403)/.test(String(ultimo.message)) && o.onSessaoInvalida) {
        bloqueado = true;
        o.onSessaoInvalida(String(ultimo.message));
        throw ultimo;
      }
      // sem conexão: abre a última cópia guardada neste aparelho e deixa editar; as mudanças ficam guardadas aqui
      // (como pendência) e são enviadas quando o sinal voltar
      try {
        var guardado = localStorage.getItem('v2cache_' + o.node);
        if (guardado) {
          cache = JSON.parse(guardado);
          if (cache && typeof cache === 'object') {
            offline = true; carregou = true; bloqueado = false;
            var dOff = lerCache();
            // se já havia pendência guardada de uma sessão anterior, ela volta para a tela
            var pOff = lerPend();
            if (pOff) {
              Object.keys(pOff.dels || {}).forEach(function (k) { cache = setAt(cache, k.split('/'), null); });
              Object.keys(pOff.sets || {}).forEach(function (k) { cache = setAt(cache, k.split('/'), pOff.sets[k]); });
              dOff = cache ? decDados(cache, ids) : null;
              cache = JSON.parse(guardado); // a base continua sendo a cópia original
            }
            clearInterval(timerSinc); timerSinc = setInterval(sincronizar, 20000);
            var motivo = String((ultimo && ultimo.message) || ultimo || 'sem resposta do banco');
            if (o.onModoOffline) o.onModoOffline(motivo); else if (o.onModoLeitura) o.onModoLeitura();
            return dOff;
          }
        }
      } catch (e) {}
      bloqueado = true;
      throw ultimo;
    }

    /* ---- pendências (mudanças que não chegaram ao banco) ---- */
    function chavePend() { return 'v2pend_' + o.node; }
    function lerPend() { try { var t = localStorage.getItem(chavePend()); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
    function limparPend() { try { localStorage.removeItem(chavePend()); } catch (e) {} }
    function guardarPend(d) {
      var base = {};
      Object.keys(d.sets).concat(Object.keys(d.dels)).forEach(function (k) { base[k] = (k in baseFlat) ? baseFlat[k] : null; });
      try { localStorage.setItem(chavePend(), JSON.stringify({ em: new Date().toISOString(), sets: d.sets, dels: d.dels, base: base })); } catch (e) {}
    }
    // envia as pendências ao banco, trocando só os caminhos que mudaram (o que outras pessoas mexeram em outros pontos é preservado)
    async function enviarPend() {
      var p = lerPend();
      if (!p) return null;
      var remoto = cache ? flatten(cache) : {};
      var conflitos = 0;
      Object.keys(p.sets).concat(Object.keys(p.dels)).forEach(function (k) {
        var b = p.base[k] === null ? undefined : p.base[k], r = remoto[k], m = (k in p.sets) ? p.sets[k] : undefined;
        if (r !== b && r !== m) conflitos++;
      });
      var n = Object.keys(p.sets).length + Object.keys(p.dels).length;
      if (n) {
        if (Object.keys(p.dels).length) await enviar(p.dels);
        if (Object.keys(p.sets).length) await enviar(p.sets);
      }
      limparPend();
      return { n: n, conflitos: conflitos };
    }
    async function sincronizar() {
      if (sincronizando || fechado) return false;
      if (!offline && !lerPend()) return false;
      sincronizando = true;
      try {
        var r = await fetchTimeout(url(''), {}, 8000);
        if (r.status === 401 || r.status === 403) { try { await renovar(); } catch (e) {} r = await fetchTimeout(url(''), {}, 8000); }
        if (!r.ok) return false;
        cache = await r.json();
        if (cache && typeof cache !== 'object') cache = null;
        var res = await enviarPend();
        clearInterval(timerSinc);
        if (o.onSincronizado) o.onSincronizado(res || { n: 0, conflitos: 0 }, true);
        return true;
      } catch (e) { return false; }
      finally { sincronizando = false; }
    }

    function aplicarRemoto() {
      if (fechado) return;
      if (salvando > 0) { sujo = true; return; }
      if (o.temPendente && o.temPendente()) { sujo = true; clearTimeout(timerRetry); timerRetry = setTimeout(aplicarRemoto, 1500); return; }
      sujo = false;
      var dados = cache ? decDados(cache, ids) : null;
      var novoFlat = cache ? flatten(encDados(dados, ids)) : {};
      if (iguaisFlat(novoFlat, baseFlat)) return; // nada mudou de verdade (eco do próprio salvamento)
      baseFlat = novoFlat;
      if (o.onDados) o.onDados(dados, false);
    }
    function agendar() { clearTimeout(timerAp); timerAp = setTimeout(aplicarRemoto, 40); guardarCache(); }

    function receber(path, data, ehPatch) {
      var partes = (path || '/').split('/').filter(Boolean);
      if (ehPatch) {
        Object.keys(data || {}).forEach(function (k) {
          cache = setAt(cache, partes.concat(k.split('/').filter(Boolean)), data[k]);
        });
      } else {
        cache = setAt(cache, partes, data);
      }
      podar(cache);
      if (cache && typeof cache === 'object' && !Object.keys(cache).length) cache = null;
      agendar();
    }

    function abrirStream() {
      if (fechado || typeof EventSource === 'undefined') return;
      try { if (es) es.close(); } catch (e) {}
      try { es = new EventSource(url('')); } catch (e) { es = null; return; }
      es.addEventListener('put', function (e) { try { var m = JSON.parse(e.data); receber(m.path, m.data, false); } catch (err) { console.error(err); } });
      es.addEventListener('patch', function (e) { try { var m = JSON.parse(e.data); receber(m.path, m.data, true); } catch (err) { console.error(err); } });
      es.addEventListener('auth_revoked', function () { reabrir(); });
      es.addEventListener('cancel', function () { reabrir(); });
      es.onerror = function () { if (es && es.readyState === 2) reabrir(); };
    }
    async function reabrir() {
      try { if (es) es.close(); } catch (e) {}
      await sleep(3000);
      try { await renovar(); } catch (e) {}
      abrirStream();
    }

    async function iniciar() {
      var dados = null;
      try { dados = await carregar(); }
      catch (e) { console.error('Não consegui carregar:', e); if (o.onErroCarga) o.onErroCarga(e); }
      // online de novo e sobrou algo que não tinha sido enviado (ex.: a pessoa fechou o app sem sinal): envia agora
      if (!offline && !bloqueado && lerPend()) {
        try {
          var res = await enviarPend();
          if (res) { dados = await carregar(); if (o.onSincronizado) o.onSincronizado(res, false); }
        } catch (e) { console.error('Pendências não enviadas:', e); }
      }
      if (o.onDados) o.onDados(dados, true);
      if (o.stream && !bloqueado && !offline) abrirStream();
    }

    async function enviar(mapa) {
      var chaves = Object.keys(mapa);
      for (var i = 0; i < chaves.length; i += 1500) {
        var parte = {};
        chaves.slice(i, i + 1500).forEach(function (k) { parte[k] = mapa[k]; });
        var r = await fetch(url(''), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parte) });
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) { try { await renovar(); } catch (e) {} }
          throw new Error('HTTP ' + r.status);
        }
      }
    }
    async function salvarInterno(dados) {
      if (bloqueado || !carregou) throw new Error('Salvamento bloqueado: os dados não foram carregados com sucesso.');
      var novo = flatten(encDados(dados, ids));
      var d = diff(baseFlat, novo);
      if (!d.nSets && !d.nDels) { limparPend(); return { sets: 0, dels: 0 }; }
      if (offline) { guardarPend(d); return { sets: d.nSets, dels: d.nDels, offline: true }; }
      var ultimo;
      for (var t = 1; t <= 3; t++) {
        try {
          if (d.nDels) await enviar(d.dels);   // primeiro apaga, depois grava (evita caminhos sobrepostos)
          if (d.nSets) await enviar(d.sets);
          baseFlat = novo;
          limparPend();
          if (o.onSalvo) { try { o.onSalvo(d); } catch (e) {} }
          return { sets: d.nSets, dels: d.nDels };
        } catch (e) { ultimo = e; if (t < 3) await sleep(800); }
      }
      guardarPend(d); // a conexão caiu: guarda aqui para não perder, mesmo se a página for fechada
      throw ultimo;
    }
    function salvar(dados) {
      salvando++;
      var p = fila.then(function () { return salvarInterno(dados); });
      fila = p.catch(function () {});
      return p.finally(function () {
        salvando--;
        if (!salvando && sujo) setTimeout(aplicarRemoto, 0);
      });
    }

    return {
      iniciar: iniciar, carregar: carregar, salvar: salvar, sincronizar: sincronizar,
      get offline() { return offline; },
      get temPendencia() { return !!lerPend(); },
      fechar: function () { fechado = true; try { if (es) es.close(); } catch (e) {} },
      get bloqueado() { return bloqueado; },
      get carregado() { return carregou; },
      _debug: { get cache() { return cache; }, get base() { return baseFlat; } }
    };
  }

  /* ---------- Anexos (ficam no próprio banco, em /v2/anexos/<id>, fora dos dados principais) ---------- */
  function urlAnexoDb(chave) {
    var t = auth.getToken();
    return CFG.DB_URL + '/' + CFG.RAIZ + '/anexos' + (chave ? '/' + chave : '') + '.json' + (t ? '?auth=' + encodeURIComponent(t) : '');
  }
  function nomeSeguro(n) {
    return String(n || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'arquivo';
  }
  function chaveSegura(s) { return String(s).split('/').map(nomeSeguro).join('_').replace(/\./g, '-').slice(0, 150); }
  async function gravarAnexo(chave, b64) {
    for (var t = 0; t < 2; t++) {
      var r = await fetch(urlAnexoDb(chave), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: b64 }) });
      if (r.status === 401 || r.status === 403) {
        if (t === 0 && auth.renovar) { try { await auth.renovar(); } catch (e) {} continue; }
        throw new Error('O banco recusou o anexo (HTTP ' + r.status + '). Confira as regras e se você está logada.');
      }
      if (!r.ok) throw new Error('Falha ao gravar o anexo (HTTP ' + r.status + ')');
      return chave;
    }
  }
  function lerArquivoB64(file) {
    return new Promise(function (ok, erro) {
      var fr = new FileReader();
      fr.onload = function (e) { ok(String(e.target.result).split(',')[1]); };
      fr.onerror = function () { erro(new Error('Erro ao ler o arquivo.')); };
      fr.readAsDataURL(file);
    });
  }
  async function subirAnexo(file, pasta) {
    var max = (CFG.LIMITE_ANEXO_MB || 3) * 1024 * 1024;
    if (file.size > max) throw new Error('Arquivo muito grande! Limite máximo: ' + (CFG.LIMITE_ANEXO_MB || 3) + 'MB');
    var chave = chaveSegura(pasta) + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await gravarAnexo(chave, await lerArquivoB64(file));
    return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, ref: chave };
  }
  function ehAnexoInline(o) {
    return o && typeof o === 'object' && !Array.isArray(o) && typeof o.data === 'string' && o.data.length > 100 && typeof o.name === 'string' && !o.ref;
  }
  // Procura anexos antigos (base64 dentro dos dados) e move para /v2/anexos. Troca no lugar.
  async function garantirAnexos(obj, pasta, aoSubir) {
    var achados = [];
    (function andar(v, caminho) {
      if (!v || typeof v !== 'object') return;
      if (ehAnexoInline(v)) { achados.push([v, caminho]); return; }
      Object.keys(v).forEach(function (k) { andar(v[k], caminho + '/' + k); });
    })(obj, '');
    var n = 0;
    for (var i = 0; i < achados.length; i++) {
      var att = achados[i][0];
      var chave = chaveSegura(pasta + achados[i][1] + '_' + att.name);
      await gravarAnexo(chave, att.data);
      delete att.data; att.ref = chave; n++;
      if (aoSubir) aoSubir(n, achados.length, att);
    }
    return n;
  }
  async function removerAnexo(att) {
    if (!att || !att.ref) return;
    try { await fetch(urlAnexoDb(att.ref), { method: 'DELETE' }); } catch (e) {}
  }
  // Abre o arquivo numa aba nova (PDF e imagem aparecem direto no navegador; o que o navegador
  // não sabe mostrar é baixado). De lá dá para salvar, se quiser.
  async function baixarAnexo(att) {
    if (!att) return;
    var aba = null;
    try { aba = window.open('', '_blank'); } catch (e) {}
    if (aba) { try { aba.document.write('<p style="font:14px sans-serif;padding:20px">Abrindo ' + String(att.name || 'arquivo').replace(/[<&]/g, '') + '…</p>'); } catch (e) {} }
    try {
      var b64;
      if (att.ref) {
        var r = await fetch(urlAnexoDb(att.ref + '/data'));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        b64 = await r.json();
        if (!b64) throw new Error('arquivo não encontrado');
      } else if (att.data) b64 = att.data;
      else throw new Error('anexo sem conteúdo');
      var href = URL.createObjectURL(b64ParaBlob(b64, att.type));
      if (aba) aba.location.href = href;
      else {
        var a = document.createElement('a'); a.href = href; a.target = '_blank'; a.download = att.name || 'arquivo';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(function () { URL.revokeObjectURL(href); }, 10 * 60 * 1000);
    } catch (e) {
      if (aba) aba.close();
      alert('Não consegui abrir o arquivo: ' + e.message);
    }
  }
  function b64ParaBlob(b64, tipo) {
    var bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: tipo || 'application/octet-stream' });
  }

  /* ---------- pequenos avisos na tela ---------- */
  function aviso(texto) {
    if (typeof document === 'undefined') return function () {};
    var el = document.getElementById('v2Aviso');
    if (!el) {
      el = document.createElement('div'); el.id = 'v2Aviso';
      el.style.cssText = 'position:fixed;left:50%;top:44px;transform:translateX(-50%);z-index:100000;background:#222;color:#fff;font:700 12px sans-serif;padding:8px 16px;border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,.3)';
      document.body.appendChild(el);
    }
    el.textContent = texto; el.style.display = 'block';
    return function () { el.style.display = 'none'; };
  }
  async function comEspera(promessa, texto) {
    var fim = aviso(texto || 'Enviando arquivo…');
    try { return await promessa; } finally { fim(); }
  }
  function pagina(nome, query) { return nome + (CFG.SUFIXO || '') + '.html?' + (query ? query + '&' : '') + 'v=' + encodeURIComponent(CFG.VERSAO || ''); }

  function bannerTeste() {
    if (typeof document === 'undefined' || !CFG.MODO_TESTE) return;
    try { if (window.top !== window) return; } catch (e) { return; }
    var b = document.createElement('div');
    b.textContent = '🧪 VERSÃO DE TESTE (v2) — os dados daqui NÃO são os do app oficial';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#C2410C;color:#fff;text-align:center;font:700 10px sans-serif;padding:2px;pointer-events:none;letter-spacing:.3px';
    document.body.appendChild(b);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bannerTeste); else bannerTeste();
  }

  /* ---------- snapshots de segurança (guarda os 2 mais recentes) ---------- */
  function urlV2(sub, q) {
    var t = auth.getToken(), qs = [];
    if (t) qs.push('auth=' + encodeURIComponent(t));
    if (q) qs.push(q);
    return CFG.DB_URL + '/' + CFG.RAIZ + '/' + sub + '.json' + (qs.length ? '?' + qs.join('&') : '');
  }
  async function snapshot(tropa, dados, motivo, por) {
    var ids = (CFG.ID_ARRAYS || {})[tropa] || [];
    var id = 's' + Date.now();
    var corpo = { meta: { em: new Date().toISOString(), motivo: motivo || '', por: String(por || '') }, dados: encDados(dados, ids) };
    var r = await fetch(urlV2('snapshots/' + tropa + '/' + id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    if (!r.ok) throw new Error('snapshot HTTP ' + r.status);
    try {
      var l = await fetch(urlV2('snapshots/' + tropa, 'shallow=true'));
      var ks = Object.keys((await l.json()) || {}).sort();
      var apagar = ks.slice(0, Math.max(0, ks.length - 2));
      for (var i = 0; i < apagar.length; i++) await fetch(urlV2('snapshots/' + tropa + '/' + apagar[i]), { method: 'DELETE' });
    } catch (e) {}
    return id;
  }
  async function listarSnapshots(tropa) {
    var r = await fetch(urlV2('snapshots/' + tropa, 'shallow=true'));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var ks = Object.keys((await r.json()) || {}).sort().reverse();
    var out = [];
    for (var i = 0; i < ks.length; i++) {
      var m = await (await fetch(urlV2('snapshots/' + tropa + '/' + ks[i] + '/meta'))).json();
      out.push({ id: ks[i], em: m && m.em, motivo: m && m.motivo, por: m && m.por });
    }
    return out;
  }
  async function lerSnapshot(tropa, id) {
    var ids = (CFG.ID_ARRAYS || {})[tropa] || [];
    var r = await fetch(urlV2('snapshots/' + tropa + '/' + id + '/dados'));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var tree = await r.json();
    if (!tree) throw new Error('Snapshot vazio');
    return decDados(tree, ids);
  }
  // Pede um snapshot antes de uma ação destrutiva. Devolve false se der erro e a pessoa preferir cancelar.
  async function protegerAntes(tropa, dados, motivo, por) {
    try { await snapshot(tropa, dados, motivo, por); return true; }
    catch (e) {
      console.error('Snapshot falhou:', e);
      return confirm('Não consegui criar a cópia de segurança (snapshot) antes desta ação.\n\nContinuar mesmo assim?');
    }
  }

  /* ---------- leitura pública: busca só os campos liberados, sem login ---------- */
  async function lerCamposPublicos(node, campos) {
    var ids = (CFG.ID_ARRAYS || {})[node] || [], dados = {};
    await Promise.all(campos.map(async function (c) {
      var r = await fetchTimeout(CFG.DB_URL + '/' + CFG.RAIZ + '/' + node + '/' + c + '.json', {}, 15000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var v = await r.json();
      if (v !== null) dados[c] = decCampo(c, v, ids);
    }));
    return dados;
  }

  /* ---------- dados importados do Paxtu (área privada: /v2/paxtu/<ramo>/<id do jovem>) ---------- */
  var paxtuCache = {};
  async function paxtuLer(ramo, forcar) {
    var c = paxtuCache[ramo];
    if (!forcar && c && Date.now() - c.em < 60000) return c.dados;
    var r = await fetch(urlV2('paxtu/' + ramo));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var d = (await r.json()) || {};
    delete d._atualizadoEm;
    paxtuCache[ramo] = { em: Date.now(), dados: d };
    return d;
  }
  async function paxtuTestar(ramo) {
    var r = await fetch(urlV2('paxtu/' + ramo), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _atualizadoEm: new Date().toISOString() }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }
  async function paxtuGravar(ramo, mapa) {
    var r = await fetch(urlV2('paxtu/' + ramo), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mapa) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    delete paxtuCache[ramo];
  }
  function paxtuData(iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : 'sem data'; }
  function paxtuHtml(d) {
    var esp = d.especialidades || [], prog = (d.progressao || []).slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); }), conq = d.conquistas || [];
    var lista = function (l, nivel) { return l.map(function (e) { return '<li>' + escHtml(e.nome) + (nivel && e.nivel ? ' · nível ' + escHtml(e.nivel) : '') + ' <span style="color:#777">(' + paxtuData(e.data) + ')</span></li>'; }).join(''); };
    var bloco = function (t, l, nivel) { return l.length ? '<div style="font-weight:800;margin:8px 0 3px;">' + t + ' (' + l.length + ')</div><ul style="margin:0;padding-left:17px;line-height:1.45;">' + lista(l, nivel) + '</ul>' : ''; };
    return '<details style="margin-top:9px;background:#fff;border:1px solid #E0D8D0;border-radius:8px;padding:8px 10px;font-size:11px;color:#1A1A1A;text-align:left;"><summary style="cursor:pointer;font-weight:800;">📋 Dados do Paxtu · ' + esp.length + ' especialidades</summary><div style="margin-top:6px;">Registro ' + escHtml(d.registro || '—') + (d.importadoEm ? ' · importado em ' + paxtuData(String(d.importadoEm).slice(0, 10)) : '') + '</div>' + bloco('Progressão', prog) + bloco('Especialidades', esp, true) + bloco('Conquistas', conq) + '</details>';
  }
  async function paxtuPreencher(ramo, raiz) {
    if (!auth.getToken()) return;
    var alvos = (raiz || document).querySelectorAll('[data-paxtu]');
    if (!alvos.length) return;
    try {
      var d = await paxtuLer(ramo);
      alvos.forEach(function (el) { var x = d[el.getAttribute('data-paxtu')]; el.innerHTML = x ? paxtuHtml(x) : ''; });
    } catch (e) {}
  }

  /* ---------- histórico de alterações ---------- */
  var ROTULOS = {
    S: 'Progressão', PRESENCA: 'Presença', eventos: 'Calendário', ciclo: 'Ciclo de programa', cicloInfo: 'Ciclo de programa',
    cicloDestaque: 'Ciclo de programa', patrulhas: 'Patrulhas', patrulhaDe: 'Patrulhas', cargoDe: 'Cargos', observacoes: 'Observações',
    datasNascimento: 'Datas de nascimento', justificativas: 'Justificativas', JUSTIFICATIVAS_SR: 'Justificativas', nomesBase: 'Nomes',
    extraJovens: 'Jovens', excluidos: 'Jovens', arquivados: 'Jovens', JOVENS: 'Jovens', JNOMES: 'Jovens', JCORES: 'Jovens', YOUTH_DATA: 'Jovens',
    lisOuroDe: 'Lis de Ouro', conversarCom: 'Conversar com', EP_DATA: 'Especialidades', CAL_EXTRAS: 'Calendário', CAL_2S26: 'Calendário',
    CAL_1S27: 'Calendário', METAS_SR: 'Metas', CICLO_BLOCOS_SR: 'Ciclo de programa', PATRULHAS_SR: 'Patrulhas', PATRULHA_DE_SR: 'Patrulhas',
    SEMESTRES_SR: 'Semestres', semAbertoSr: 'Semestres', CICLO_SEM: 'Ciclo', cicloAbertos: 'Ciclo'
  };
  // nomeDe(segmento) devolve o nome do jovem se o segmento for o ID de um jovem
  function resumirDiff(d, nomeDe) {
    var grupos = {}, ordem = [];
    function add(chave, apagou) {
      var seg = chave.split('/').map(unescKey);
      var rot = ROTULOS[seg[0]] || seg[0];
      var g = grupos[rot];
      if (!g) { g = grupos[rot] = { n: 0, nomes: [] }; ordem.push(rot); }
      g.n++;
      seg.forEach(function (s) {
        var nm = nomeDe ? nomeDe(s) : null;
        if (nm && g.nomes.indexOf(nm) < 0) g.nomes.push(nm);
      });
    }
    Object.keys(d.sets || {}).forEach(function (k) { add(k, false); });
    Object.keys(d.dels || {}).forEach(function (k) { add(k, true); });
    return ordem.map(function (rot) {
      var g = grupos[rot], nomes = g.nomes.slice(0, 3).join(', ') + (g.nomes.length > 3 ? ' +' + (g.nomes.length - 3) : '');
      return rot + (nomes ? ' (' + nomes + ')' : '') + ': ' + g.n + (g.n === 1 ? ' alteração' : ' alterações');
    }).join(' · ');
  }
  function nomeDaSessao() { try { var o = JSON.parse(localStorage.getItem('chefeSessao') || 'null'); return (o && o.nome) || ''; } catch (e) { return ''; } }
  async function registrarHistorico(tropa, por, nome, resumo, n, d) {
    if (!resumo) return;
    try {
      var e = { em: new Date().toISOString(), por: String(por || ''), nome: nomeDaSessao() || nome || '', resumo: resumo, n: n || 0 };
      // guarda os valores de antes para poder desfazer (só se a alteração for pequena)
      if (d && d.antes && Object.keys(d.antes).length && Object.keys(d.antes).length <= 300) { var js = JSON.stringify(d.antes); if (js.length < 60000) e.desf = d.antes; }
      await fetch(urlV2('historico/' + tropa), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
    } catch (x) {}
  }
  var NOS_HIST = ['escoteira', 'senior', 'alcateia', 'cla', 'diretoria'];
  async function lerHistorico(qtd, nos) {
    var tudo = [];
    for (var t of (nos || NOS_HIST)) {
      try {
        var r = await fetch(urlV2('historico/' + t, 'orderBy=%22%24key%22&limitToLast=' + (qtd || 60)));
        var o = (await r.json()) || {};
        if (o.error) continue;
        Object.keys(o).forEach(function (k) { var e = o[k]; if (e && e.em) { e.tropa = t; e.id = k; tudo.push(e); } });
      } catch (e) {}
    }
    tudo.sort(function (a, b) { return a.em < b.em ? 1 : -1; });
    return tudo.slice(0, qtd || 60);
  }
  // desfaz uma alteração: devolve os valores de antes e registra quem desfez, quando
  async function desfazerHistorico(e, quemNome, quemReg) {
    if (!e || !e.desf || e.desfeito) throw new Error('Esta alteração não pode ser desfeita.');
    var r = await fetch(urlV2(e.tropa), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e.desf) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var quando = new Date().toISOString();
    await fetch(urlV2('historico/' + e.tropa + '/' + e.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ desfeito: { em: quando, nome: quemNome || '', por: String(quemReg || '') } }) });
    await registrarHistorico(e.tropa, quemReg, quemNome, 'Desfez a alteração: ' + e.resumo, 0);
  }
  async function podarHistorico(manter) {
    manter = manter || 300;
    for (var t of NOS_HIST) {
      try {
        var ks = Object.keys((await (await fetch(urlV2('historico/' + t, 'shallow=true'))).json()) || {}).sort();
        var apagar = ks.slice(0, Math.max(0, ks.length - manter));
        if (apagar.length) { var mapa = {}; apagar.forEach(function (k) { mapa[k] = null; }); await fetch(urlV2('historico/' + t), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mapa) }); }
      } catch (e) {}
    }
  }
  function temPendenciaLocal() { try { return Object.keys(localStorage).some(function (k) { return k.indexOf('v2pend_') === 0; }); } catch (e) { return false; } }
  function limparCacheLocal() { try { Object.keys(localStorage).filter(function (k) { return k.indexOf('v2cache_') === 0 || k.indexOf('v2pend_') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }

  /* ---------- relatório de progressão (abre uma página pronta para imprimir / salvar como PDF) ---------- */
  function escHtml(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* ---------- relatórios em PDF (o arquivo PDF é montado aqui mesmo, sem janela de impressão: funciona no app instalado do celular) ---------- */
  function criarPdf(W, H) {
    var paginas = [], cur = null;
    function nova() { cur = []; paginas.push(cur); }
    nova();
    function rgb(hex) { var n = parseInt(String(hex || '#000000').replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (x) { return (x / 255).toFixed(3); }).join(' '); }
    var MAPA = { '—': '-', '–': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '•': '-' };
    function lat1(s) {
      var o = '';
      String(s == null ? '' : s).split('').forEach(function (ch) {
        var c = ch.charCodeAt(0);
        if (MAPA[ch]) o += MAPA[ch]; else if (c >= 32 && c <= 126 || c >= 160 && c <= 255) o += ch; else if (c < 32) o += ' '; else o += '?';
      });
      return o.replace(/[\\()]/g, '\\$&');
    }
    var P = {
      W: W, H: H,
      nova: nova,
      texto: function (x, y, s, o) {
        o = o || {};
        cur.push('BT /' + (o.b ? 'F2' : 'F1') + ' ' + (o.t || 10) + ' Tf ' + rgb(o.c || '#222222') + ' rg ' + x.toFixed(1) + ' ' + (H - y).toFixed(1) + ' Td (' + lat1(s) + ') Tj ET');
      },
      rect: function (x, y, w, h, c) { cur.push(rgb(c) + ' rg ' + x.toFixed(1) + ' ' + (H - y - h).toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1) + ' re f'); },
      // largura aproximada (conservadora) de um texto em Helvetica
      larg: function (s, t, b) { return String(s).length * t * (b ? 0.56 : 0.52); },
      cortar: function (s, max, t, b) {
        s = String(s == null ? '' : s);
        var n = Math.floor(max / (t * (b ? 0.56 : 0.52)));
        return s.length <= n ? s : s.slice(0, Math.max(1, n - 1)) + '...';
      },
      quebrar: function (s, max, t, b) { // quebra em linhas por palavras
        var pal = String(s).split(/\s+/), linhas = [], l = '';
        var n = Math.floor(max / (t * (b ? 0.56 : 0.52)));
        pal.forEach(function (p) { if ((l + ' ' + p).trim().length > n && l) { linhas.push(l); l = p; } else l = (l + ' ' + p).trim(); });
        if (l) linhas.push(l);
        return linhas;
      },
      paginaAtual: function () { return paginas.length; },
      total: function () { return paginas.length; },
      bytes: function () {
        var objs = [], partes = [];
        function add(s) { objs.push(s); return objs.length; }
        add('<< /Type /Catalog /Pages 2 0 R >>');
        add(''); // pages (preenchido depois)
        add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        var kids = [];
        paginas.forEach(function (ops) {
          var cont = ops.join('\n');
          var c = add('<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream');
          var p = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + c + ' 0 R >>');
          kids.push(p + ' 0 R');
        });
        objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
        var out = '%PDF-1.4\n', offs = [];
        objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
        var xref = out.length;
        out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(function (n) { return ('0000000000' + n).slice(-10) + ' 00000 n \n'; }).join('');
        out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
        var u = new Uint8Array(out.length);
        for (var i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255;
        return u;
      }
    };
    return P;
  }
  async function entregarPdf(bytes, nomeArq) {
    var file = new File([bytes], nomeArq, { type: 'application/pdf' });
    var toque = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    if (toque && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nomeArq }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    var url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = nomeArq; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function dataExtenso() { return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  // r = { tropa, nome, info:[[rotulo,valor]], resumo:{n,total,etapa}, eixos:[{nome,cor,feitos,total,blocos:[{nome,ok,detalhe}]}], presenca:{presentes,ausentes,total}|null }
  function montarPdfJovem(r) {
    try {
      var P = criarPdf(595, 842), M = 36, y = 0, VINHO = '#6D1026';
      function novaPagina() { P.nova(); y = M + 6; }
      function rod(num) { P.texto(M, P.H - 20, 'GE Joaninha · Relatório de progressão · ' + r.nome, { t: 7.5, c: '#888888' }); P.texto(P.W - M - 40, P.H - 20, 'Pág. ' + num, { t: 7.5, c: '#888888' }); }
      var num = 1;
      y = M + 4;
      P.texto(M, y + 14, r.nome, { t: 20, b: 1, c: VINHO });
      P.texto(M, y + 30, r.tropa + ' · GE Joaninha · Relatório de progressão · ' + dataExtenso(), { t: 9, c: '#666666' });
      P.rect(M, y + 38, P.W - 2 * M, 2, VINHO);
      y += 56;
      var info = (r.info || []).filter(function (i) { return i[1]; });
      info.forEach(function (i, k) {
        var x = M + (k % 2) * 270, yy = y + Math.floor(k / 2) * 15;
        P.texto(x, yy, i[0] + ':', { t: 9.5, c: '#777777' });
        P.texto(x + P.larg(i[0] + ': ', 9.5), yy, P.cortar(i[1], 250 - P.larg(i[0] + ': ', 9.5), 9.5), { t: 9.5 });
      });
      y += Math.ceil(info.length / 2) * 15 + 8;
      var pct = r.resumo.total ? Math.round(r.resumo.n / r.resumo.total * 100) : 0;
      P.rect(M, y, P.W - 2 * M, 48, '#F6EFEA');
      P.texto(M + 12, y + 20, r.resumo.n + ' de ' + r.resumo.total + ' blocos concluídos (' + pct + '%)' + (r.resumo.etapa ? ' - etapa: ' + r.resumo.etapa : ''), { t: 12, b: 1 });
      P.rect(M + 12, y + 30, P.W - 2 * M - 24, 8, '#E4D9D0');
      if (pct) P.rect(M + 12, y + 30, (P.W - 2 * M - 24) * pct / 100, 8, VINHO);
      y += 60;
      if (r.presenca && r.presenca.total) {
        var pp = Math.round(r.presenca.presentes / r.presenca.total * 100);
        P.rect(M, y, P.W - 2 * M, 26, '#F6EFEA');
        P.texto(M + 12, y + 17, 'Presença: ' + r.presenca.presentes + ' em ' + r.presenca.total + ' atividade(s) com chamada (' + pp + '%)' + (r.presenca.ausentes ? ' - ' + r.presenca.ausentes + ' falta(s)' : ''), { t: 10 });
        y += 38;
      }
      (r.eixos || []).forEach(function (e) {
        if (y + 22 + 2 * 18 > P.H - 40) { rod(num++); novaPagina(); }
        P.rect(M, y, P.W - 2 * M, 20, e.cor);
        P.texto(M + 8, y + 14, e.nome, { t: 10.5, b: 1, c: '#FFFFFF' });
        P.texto(P.W - M - 34, y + 14, e.feitos + '/' + e.total, { t: 10.5, b: 1, c: '#FFFFFF' });
        y += 26;
        e.blocos.forEach(function (b) {
          if (y + 18 > P.H - 40) { rod(num++); novaPagina(); }
          P.texto(M + 6, y + 8, b.ok ? 'OK' : '-', { t: 9, b: 1, c: b.ok ? '#1E8449' : '#AAAAAA' });
          P.texto(M + 30, y + 8, P.cortar(b.nome, 290, 10), { t: 10 });
          P.texto(M + 340, y + 8, P.cortar(b.detalhe, P.W - 2 * M - 340, 9.5), { t: 9.5, c: '#555555' });
          P.rect(M, y + 13, P.W - 2 * M, 0.5, '#E6E0DA');
          y += 18;
        });
        y += 10;
      });
      y += 4;
      P.texto(M, y + 8, 'Os dados refletem o que estava registrado no momento da emissão.', { t: 8, c: '#888888' });
      rod(num);
      return { bytes: P.bytes(), nome: 'relatorio-' + nomeSeguro(r.nome) + '.pdf' };
    } catch (e) { console.error(e); throw e; }
  }

  // r = { tropa, resumo:{jovens, media, total}, etapas:[[nome,qtd]], colunas:[{nome,cor,total}], linhas:[{nome,patrulha,cargo,n,total,etapa,porEixo:[n],presenca}] }
  function desenharTropa(P, r, nova) {
    {
      var M = 30, y = 0, VINHO = '#6D1026', num = 1;
      if (nova) P.nova();
      function rod(n) { P.texto(M, P.H - 16, 'GE Joaninha · Relatório da ' + r.tropa, { t: 7.5, c: '#888888' }); P.texto(P.W - M - 40, P.H - 16, 'Pág. ' + n, { t: 7.5, c: '#888888' }); }
      y = M;
      P.texto(M, y + 14, r.tropa, { t: 20, b: 1, c: VINHO });
      P.texto(M, y + 30, 'GE Joaninha · Relatório de progressão da tropa · ' + dataExtenso(), { t: 9, c: '#666666' });
      P.rect(M, y + 38, P.W - 2 * M, 2, VINHO);
      y += 52;
      var cartoes = [[String(r.resumo.jovens), 'jovens'], [String(r.resumo.media), 'média de blocos (de ' + r.resumo.total + ')']].concat((r.etapas || []).map(function (e) { return [String(e[1]), e[0]]; }));
      var x = M;
      cartoes.forEach(function (c) {
        var w = Math.max(70, P.larg(c[1], 8.5) + 20);
        if (x + w > P.W - M) return;
        P.rect(x, y, w, 40, '#F6EFEA');
        P.texto(x + 10, y + 18, c[0], { t: 16, b: 1, c: VINHO });
        P.texto(x + 10, y + 32, c[1], { t: 8.5, c: '#555555' });
        x += w + 8;
      });
      y += 54;
      var col = { nome: M, pat: M + 140, cargo: M + 222, etapa: M + 294, bl: M + 362, eixo0: M + 452, w: 66 };
      col.pres = col.eixo0 + 4 * col.w + 2;
      function cabecalho() {
        P.rect(M, y, P.W - 2 * M, 28, VINHO);
        [['Jovem', col.nome], [r.rotuloGrupo || 'Patrulha', col.pat], r.semCargo ? ['', col.cargo] : ['Cargo', col.cargo], ['Etapa', col.etapa], ['Blocos', col.bl]].forEach(function (c) { P.texto(c[1] + 4, y + 17, c[0], { t: 9, b: 1, c: '#FFFFFF' }); });
        r.colunas.forEach(function (c, i) {
          var cx = col.eixo0 + i * col.w;
          P.rect(cx, y, col.w - 2, 28, c.cor);
          P.quebrar(c.nome, col.w - 8, 7, true).slice(0, 2).forEach(function (l, k) { P.texto(cx + 3, y + 11 + k * 9, l, { t: 7, b: 1, c: '#FFFFFF' }); });
        });
        P.texto(col.pres + 4, y + 17, 'Presença', { t: 8, b: 1, c: '#FFFFFF' });
        y += 32;
      }
      cabecalho();
      r.linhas.forEach(function (l, k) {
        if (y + 22 > P.H - 30) { rod(num++); P.nova(); y = M; cabecalho(); }
        if (k % 2) P.rect(M, y - 2, P.W - 2 * M, 22, '#FAF6F2');
        P.texto(col.nome + 4, y + 11, P.cortar(l.nome, 132, 9.5, true), { t: 9.5, b: 1 });
        P.texto(col.pat + 4, y + 11, P.cortar(l.patrulha, 74, 9), { t: 9 });
        if (!r.semCargo) P.texto(col.cargo + 4, y + 11, P.cortar(l.cargo, 66, 9), { t: 9 });
        P.texto(col.etapa + 4, y + 11, P.cortar(l.etapa, 64, 9), { t: 9 });
        var pc = l.total ? l.n / l.total : 0;
        P.texto(col.bl + 4, y + 8, l.n + '/' + l.total, { t: 9 });
        P.rect(col.bl + 4, y + 11, 76, 5, '#E4D9D0');
        if (pc) P.rect(col.bl + 4, y + 11, 76 * pc, 5, VINHO);
        l.porEixo.forEach(function (n, i) { P.texto(col.eixo0 + i * col.w + 20, y + 11, n + '/' + r.colunas[i].total, { t: 9 }); });
        P.texto(col.pres + 14, y + 11, l.presenca || '-', { t: 9 });
        y += 22;
      });
      y += 10;
      if (y + 12 < P.H - 30) P.texto(M, y + 8, 'Os dados refletem o que estava registrado no momento da emissão.', { t: 8, c: '#888888' });
      rod(num);
    }
  }
  function montarPdfTropa(r) {
    try { var P = criarPdf(842, 595); desenharTropa(P, r, false); return { bytes: P.bytes(), nome: 'relatorio-' + nomeSeguro(r.tropa) + '.pdf' }; }
    catch (e) { console.error(e); throw e; }
  }
  // Relatório do grupo inteiro: uma lista de relatórios de tropa/seção (mesmo formato do abrirRelatorioTropa), um depois do outro.
  function montarPdfGrupo(specs) {
    try { var P = criarPdf(842, 595); specs.forEach(function (r, i) { desenharTropa(P, r, i > 0); }); return { bytes: P.bytes(), nome: 'relatorio-grupo.pdf' }; }
    catch (e) { console.error(e); throw e; }
  }


  /* ---------- tela de visualização do relatório (abre dentro do app; daqui dá para baixar o PDF ou imprimir) ---------- */
  var CSS_REL = '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:18px;max-width:900px;margin:auto;font-size:13px;line-height:1.4}' +
    'header{border-bottom:3px solid #6D1026;padding-bottom:10px;margin-bottom:14px}h1{margin:0;font-size:22px;color:#6D1026}.sub{color:#666;font-size:12px;margin-top:2px}' +
    '.info{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin:12px 0}.info div span{color:#777}' +
    '.resumo{background:#F6EFEA;border-radius:8px;padding:12px 14px;margin:12px 0}.resumo b{font-size:15px}.barra{height:10px;background:#E4D9D0;border-radius:6px;margin-top:8px;overflow:hidden}.barra i{display:block;height:100%;background:#6D1026}' +
    '.eixo{margin-top:14px;break-inside:avoid}.eixo h2{font-size:14px;margin:0 0 6px;padding:6px 10px;border-radius:6px;color:#fff;display:flex;justify-content:space-between}' +
    'table{width:100%;border-collapse:collapse}td{padding:5px 8px;border-bottom:1px solid #EEE;vertical-align:top}td.s{width:26px;text-align:center;font-weight:bold}.ok{color:#1E8449}.pend{color:#B0A89F}td.d{color:#666;text-align:right}' +
    '.cards{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.card{background:#F6EFEA;border-radius:8px;padding:10px 14px;min-width:110px}.card b{display:block;font-size:20px;color:#6D1026}' +
    'th{background:#6D1026;color:#fff;text-align:left;padding:6px 8px;font-size:11px}th.e{text-align:center}td.c{text-align:center}.tb{overflow-x:auto}.tb table{min-width:720px}tr{break-inside:avoid}' +
    'footer{margin-top:20px;border-top:1px solid #DDD;padding-top:8px;color:#888;font-size:11px}';
  function htmlJovem(r) {
    var pct = r.resumo.total ? Math.round(r.resumo.n / r.resumo.total * 100) : 0;
    var h = '<header><h1>' + escHtml(r.nome) + '</h1><div class="sub">' + escHtml(r.tropa) + ' · GE Joaninha · Relatório de progressão · ' + escHtml(dataExtenso()) + '</div></header>';
    var info = (r.info || []).filter(function (i) { return i[1]; });
    if (info.length) h += '<div class="info">' + info.map(function (i) { return '<div><span>' + escHtml(i[0]) + ':</span> ' + escHtml(i[1]) + '</div>'; }).join('') + '</div>';
    h += '<div class="resumo"><b>' + r.resumo.n + ' de ' + r.resumo.total + ' blocos concluídos</b> (' + pct + '%)' + (r.resumo.etapa ? ' — etapa: <b>' + escHtml(r.resumo.etapa) + '</b>' : '') + '<div class="barra"><i style="width:' + pct + '%"></i></div></div>';
    if (r.presenca && r.presenca.total) {
      var pp = Math.round(r.presenca.presentes / r.presenca.total * 100);
      h += '<div class="resumo"><b>Presença:</b> ' + r.presenca.presentes + ' em ' + r.presenca.total + ' atividade(s) com chamada (' + pp + '%)' + (r.presenca.ausentes ? ' · ' + r.presenca.ausentes + ' falta(s)' : '') + '</div>';
    }
    (r.eixos || []).forEach(function (e) {
      h += '<div class="eixo"><h2 style="background:' + escHtml(e.cor) + '"><span>' + escHtml(e.nome) + '</span><span>' + e.feitos + '/' + e.total + '</span></h2><table>' +
        e.blocos.map(function (b) { return '<tr><td class="s ' + (b.ok ? 'ok' : 'pend') + '">' + (b.ok ? '✓' : '○') + '</td><td>' + escHtml(b.nome) + '</td><td class="d">' + escHtml(b.detalhe) + '</td></tr>'; }).join('') + '</table></div>';
    });
    return h + '<footer>Os dados refletem o que estava registrado no momento da emissão.</footer>';
  }
  function htmlTropa(r) {
    var h = '<header><h1>' + escHtml(r.tropa) + '</h1><div class="sub">GE Joaninha · Relatório de progressão da tropa · ' + escHtml(dataExtenso()) + '</div></header>' +
      '<div class="cards"><div class="card"><b>' + r.resumo.jovens + '</b>jovens</div><div class="card"><b>' + r.resumo.media + '</b>média de blocos (de ' + r.resumo.total + ')</div>' +
      (r.etapas || []).map(function (e) { return '<div class="card"><b>' + e[1] + '</b>' + escHtml(e[0]) + '</div>'; }).join('') + '</div>' +
      '<div class="tb"><table><thead><tr><th>Jovem</th><th>' + (r.rotuloGrupo || 'Patrulha') + '</th>' + (r.semCargo ? '' : '<th>Cargo</th>') + '<th>Etapa</th><th>Blocos</th>' +
      (r.colunas || []).map(function (c) { return '<th class="e" style="background:' + escHtml(c.cor) + '">' + escHtml(c.nome) + '</th>'; }).join('') + '<th class="e">Presença</th></tr></thead><tbody>' +
      r.linhas.map(function (l) {
        var pct = l.total ? Math.round(l.n / l.total * 100) : 0;
        return '<tr><td><b>' + escHtml(l.nome) + '</b></td><td>' + escHtml(l.patrulha) + '</td>' + (r.semCargo ? '' : '<td>' + escHtml(l.cargo) + '</td>') + '<td>' + escHtml(l.etapa) + '</td>' +
          '<td style="min-width:100px">' + l.n + '/' + l.total + '<div class="barra" style="height:6px;margin-top:3px"><i style="width:' + pct + '%"></i></div></td>' +
          l.porEixo.map(function (n, i) { return '<td class="c">' + n + '/' + r.colunas[i].total + '</td>'; }).join('') + '<td class="c">' + escHtml(l.presenca || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div><footer>Os dados refletem o que estava registrado no momento da emissão.</footer>';
    return h;
  }
  function visualizarRelatorio(titulo, corpoHtml, gerarPdf, paisagem) {
    var ant = document.getElementById('v2RelatorioOv'); if (ant) ant.remove();
    var toque = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    var ov = document.createElement('div');
    ov.id = 'v2RelatorioOv';
    ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:100000;background:#EDE7E0;display:flex;flex-direction:column;font-family:Arial,sans-serif';
    var btn = 'border:0;border-radius:18px;padding:9px 14px;font-size:13px;font-weight:bold;cursor:pointer;';
    ov.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;background:#6D1026;color:#fff">' +
      '<span style="flex:1;min-width:140px;font-size:14px;font-weight:bold">' + escHtml(titulo) + '</span>' +
      '<button id="v2RelBaixar" style="' + btn + 'background:#fff;color:#6D1026">' + (toque ? '⬇ Baixar / compartilhar PDF' : '⬇ Baixar PDF') + '</button>' +
      (toque ? '' : '<button id="v2RelImprimir" style="' + btn + 'background:#fff;color:#6D1026">🖨 Imprimir</button>') +
      '<button id="v2RelFechar" style="' + btn + 'background:transparent;color:#fff;border:1px solid #fff">✕ Fechar</button></div>' +
      (toque ? '<div style="padding:6px 12px;font-size:11px;color:#555;background:#F6EFEA">Para imprimir no celular: toque em Baixar / compartilhar PDF e escolha "Imprimir".</div>' : '') +
      '<iframe id="v2RelFrame" style="flex:1;border:0;width:100%;background:#fff"></iframe>';
    document.body.appendChild(ov);
    var fr = document.getElementById('v2RelFrame');
    fr.srcdoc = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escHtml(titulo) + '</title><style>' + CSS_REL +
      '@media print{body{padding:0}}@page{margin:12mm;size:A4 ' + (paisagem ? 'landscape' : 'portrait') + '}</style></head><body>' + corpoHtml + '</body></html>';
    function fechar() { ov.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') fechar(); }
    document.addEventListener('keydown', esc);
    document.getElementById('v2RelFechar').onclick = fechar;
    document.getElementById('v2RelBaixar').onclick = function () {
      try { var p = gerarPdf(); entregarPdf(p.bytes, p.nome); } catch (e) { alert('Não consegui gerar o PDF: ' + e.message); }
    };
    var bi = document.getElementById('v2RelImprimir');
    if (bi) bi.onclick = function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { alert('Não consegui abrir a impressão. Use "Baixar PDF" e imprima o arquivo.'); } };
  }
  // Abre o relatório em outra aba do navegador (página própria, com botões de baixar PDF e imprimir).
  // O PDF já vai dentro da página, então os botões funcionam mesmo se a aba ficar aberta sem o app.
  function abrirNovaAba(titulo, corpoHtml, gerarPdf, paisagem) {
    var pdf;
    try { pdf = gerarPdf(); } catch (e) { alert('Não consegui gerar o relatório: ' + e.message); return; }
    var bin = '', CH = 8192;
    for (var i = 0; i < pdf.bytes.length; i += CH) bin += String.fromCharCode.apply(null, pdf.bytes.subarray(i, i + CH));
    var b64 = btoa(bin);
    var script = 'var B64="' + b64 + '",NOME=' + JSON.stringify(pdf.nome) + ';' +
      'function arq(){var s=atob(B64),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new File([u],NOME,{type:"application/pdf"});}' +
      'async function baixar(){var f=arq();var toque=matchMedia("(pointer:coarse)").matches;' +
      'if(toque&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:NOME});return;}catch(e){if(e&&e.name==="AbortError")return;}}' +
      'var a=document.createElement("a");a.href=URL.createObjectURL(f);a.download=NOME;document.body.appendChild(a);a.click();a.remove();}' +
      'function imprimir(){window.print();}';
    var btn = 'border:0;border-radius:18px;padding:9px 14px;font-size:13px;font-weight:bold;cursor:pointer;background:#fff;color:#6D1026;';
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escHtml(titulo) + '</title><style>' + CSS_REL +
      '.acoes{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:#6D1026;color:#fff;margin:-18px -18px 14px}.acoes span{flex:1;min-width:140px;font-weight:bold;font-size:14px}' +
      '@media print{.acoes{display:none}body{padding:0}}@page{margin:12mm;size:A4 ' + (paisagem ? 'landscape' : 'portrait') + '}</style></head><body>' +
      '<div class="acoes"><span>' + escHtml(titulo) + '</span><button style="' + btn + '" onclick="baixar()">⬇ Baixar PDF</button><button style="' + btn + '" onclick="imprimir()">🖨 Imprimir</button></div>' +
      corpoHtml + '<script>' + script + '<\/script></body></html>';
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    // se este código roda dentro do iframe da Sênior, abre a aba a partir da página principal (como a Escoteira faz)
    var abridor = window;
    try { if (window.top && window.top !== window && window.top.document) abridor = window.top; } catch (e) {}
    var w = abridor.open(url, '_blank');
    if (!w) { visualizarRelatorio(titulo, corpoHtml, function () { return pdf; }, paisagem); } // navegador não deixou abrir outra aba: mostra dentro do app
    setTimeout(function () { URL.revokeObjectURL(url); }, 600000);
  }
  function abrirRelatorio(r) { abrirNovaAba('Relatório — ' + r.nome, htmlJovem(r), function () { return montarPdfJovem(r); }, false); }
  function abrirRelatorioGrupo(specs) {
    var corpo = '<header><h1>Grupo Escoteiro Joaninha</h1><div class="sub">Relatório de progressão de todas as seções · ' + escHtml(dataExtenso()) + '</div></header>' +
      '<div class="cards">' + specs.map(function (r) { return '<div class="card"><b>' + r.resumo.jovens + '</b>' + escHtml(r.tropa) + '</div>'; }).join('') + '</div>' +
      specs.map(function (r) { return '<div style="break-before:page;margin-top:24px">' + htmlTropa(r) + '</div>'; }).join('');
    abrirNovaAba('Relatório — Grupo', corpo, function () { return montarPdfGrupo(specs); }, true);
  }
  function abrirRelatorioTropa(r) { abrirNovaAba('Relatório — ' + r.tropa, htmlTropa(r), function () { return montarPdfTropa(r); }, true); }

  /* ---------- lembrete mensal de backup (admins) ---------- */
  // Janela: últimos 5 dias do mês até o dia 5 do mês seguinte. Devolve "AAAA-MM" do mês a fechar, ou null fora da janela.
  function cicloBackup(d) {
    d = d || new Date();
    var dia = d.getDate(), ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var y = d.getFullYear(), m = d.getMonth();
    if (dia >= ultimo - 4) { /* mês atual */ }
    else if (dia <= 5) { m--; if (m < 0) { m = 11; y--; } }
    else return null;
    return y + '-' + String(m + 1).padStart(2, '0');
  }
  function urlBackup(ciclo, tropa) {
    var t = auth.getToken();
    return CFG.DB_URL + '/' + CFG.RAIZ + '/meta/backups/' + ciclo + (tropa ? '/' + tropa : '') + '.json' + (t ? '?auth=' + encodeURIComponent(t) : '');
  }
  // Devolve { ciclo, pendentes:['alcateia','escoteira','senior','cla'] } ou null se não é hora / já foi tudo feito.
  async function lembreteBackup() {
    var ciclo = cicloBackup();
    if (!ciclo) return null;
    try {
      var r = await fetch(urlBackup(ciclo));
      if (!r.ok) return null;
      var feito = (await r.json()) || {};
      var pend = ['alcateia', 'escoteira', 'senior', 'cla'].filter(function (t) { return !feito[t]; });
      return pend.length ? { ciclo: ciclo, pendentes: pend } : null;
    } catch (e) { return null; }
  }
  async function registrarBackup(tropa, registro) {
    var ciclo = cicloBackup();
    if (!ciclo) return;
    try {
      await fetch(urlBackup(ciclo, tropa), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ por: String(registro || ''), em: new Date().toISOString() }) });
    } catch (e) {}
  }

  /* ---------- senha do app (guardada com hash PBKDF2; senhas antigas em texto continuam valendo até serem convertidas) ---------- */
  function b64(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
  function deB64(t) { var s = atob(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  async function derivar(senha, salt, iter) {
    var k = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, k, 256));
  }
  async function hashSenha(senha) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iter = 100000;
    return 'pbkdf2$' + iter + '$' + b64(salt) + '$' + await derivar(String(senha), salt, iter);
  }
  function senhaComHash(g) { return typeof g === 'string' && g.indexOf('pbkdf2$') === 0; }
  // guardada vazia → vale o número do registro; com hash → confere o hash; senão (antigo) → compara o texto
  async function conferirSenha(digitada, guardada, registro) {
    if (!guardada) return digitada === registro;
    if (!senhaComHash(guardada)) return digitada === guardada;
    try {
      var p = guardada.split('$');
      return (await derivar(String(digitada), deB64(p[2]), parseInt(p[1], 10))) === p[3];
    } catch (e) { return false; }
  }

  root.V2 = {
    abrirRelatorio: abrirRelatorio, abrirRelatorioTropa: abrirRelatorioTropa, abrirRelatorioGrupo: abrirRelatorioGrupo,
    snapshot: snapshot, listarSnapshots: listarSnapshots, lerSnapshot: lerSnapshot, protegerAntes: protegerAntes,
    resumirDiff: resumirDiff, registrarHistorico: registrarHistorico, lerHistorico: lerHistorico, desfazerHistorico: desfazerHistorico, podarHistorico: podarHistorico, limparCacheLocal: limparCacheLocal, temPendenciaLocal: temPendenciaLocal,
    hashSenha: hashSenha, conferirSenha: conferirSenha, senhaComHash: senhaComHash,
    cicloBackup: cicloBackup, lembreteBackup: lembreteBackup, registrarBackup: registrarBackup,
    CFG: CFG, escKey: escKey, unescKey: unescKey, enc: enc, dec: dec, encDados: encDados, decDados: decDados, decCampo: decCampo,
    flatten: flatten, diff: diff, canon: canon, canonStr: canonStr, setAt: setAt, podar: podar, aplicarMulti: aplicarMulti,
    configurarAuth: configurarAuth, criarStore: criarStore,
    subirAnexo: subirAnexo, garantirAnexos: garantirAnexos, removerAnexo: removerAnexo, baixarAnexo: baixarAnexo,
    ehAnexoInline: ehAnexoInline, gravarAnexo: gravarAnexo, urlAnexoDb: urlAnexoDb, nomeSeguro: nomeSeguro,
    criarPdf: criarPdf, entregarPdf: entregarPdf,
    lerCamposPublicos: lerCamposPublicos, paxtuLer: paxtuLer, paxtuLimpar: function () { paxtuCache = {}; }, paxtuTestar: paxtuTestar, paxtuGravar: paxtuGravar, paxtuPreencher: paxtuPreencher, comEspera: comEspera, pagina: pagina, sleep: sleep, fetchTimeout: fetchTimeout
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.V2;
})(typeof window !== 'undefined' ? window : globalThis);


/* ============================================================
   Tabela de eixos e blocos da Tropa Escoteira (usada por index.html e visualizacao.html).
   Para ajustar um bloco ou uma ação, edite SÓ aqui.
   ============================================================ */
window.V2_BLOCOS = (function () {
/* blocos.js — tabela de eixos e blocos da Tropa Escoteira, usada por index.html e visualizacao.html.
   Para ajustar um bloco ou uma ação, edite SÓ aqui. */
const ICONE_FOLHA = '<svg viewBox="0 0 24 24" fill="white"><path d="M12 2C6.5 3.5 4 8 4 13c0 4.4 3.6 8 8 8s8-3.6 8-8c0-6-3.5-9.5-8-11z"/><rect x="11.3" y="6" width="1.4" height="13" fill="white" opacity="0.55"/></svg>';
const ICONE_POMBA = '<svg viewBox="0 0 24 24" fill="white"><path d="M23 4.2c-.8.5-1.7.8-2.6.9a4.7 4.7 0 0 0 2-2.6c-.9.5-1.9.9-3 1.1a4.6 4.6 0 0 0-7.9 4.2A13.1 13.1 0 0 1 2 2.9a4.6 4.6 0 0 0 1.4 6.2 4.6 4.6 0 0 1-2.1-.6v.1a4.6 4.6 0 0 0 3.7 4.5c-.7.2-1.4.2-2 .1a4.6 4.6 0 0 0 4.3 3.2A9.3 9.3 0 0 1 0 18.6a13 13 0 0 0 7.1 2.1c8.5 0 13.2-7.4 13.2-13.8v-.6c.9-.6 1.7-1.4 2.3-2.3z"/></svg>';
const ICONE_MAOS_CORACAO = '<svg viewBox="0 0 24 24" fill="white"><path d="M12.5 6.7c1.6-1.9 4.4-2.2 6.2-.5 1.8 1.7 1.9 4.5.2 6.3L12 19.5l-6.9-7c-1.7-1.8-1.6-4.6.2-6.3 1.8-1.7 4.6-1.4 6.2.5z"/><path d="M2.5 12.2 5.2 9.6a1.7 1.7 0 0 1 2.3 0l.5.5-1.6 1.7a1.15 1.15 0 0 0 1.6 1.65l2.2-2.2 1.1 1.15-2.2 2.2a1.15 1.15 0 0 0 1.6 1.65l2.2-2.2" fill="none" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/></svg>';
const ICONE_BUSSOLA = '<svg viewBox="0 0 24 24" fill="white"><path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm0 1.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4z"/><path d="M16.5 7.5 13 13l-5.5 3.5L11 11z"/></svg>';

const EIXOS = [
{ id:'ma', nome:'Meio Ambiente', cor:'#5CB85C', icone: ICONE_FOLHA, blocos:['mudancas','consumo','preservacao','vida_ar'] },
{ id:'pd', nome:'Paz e Desenvolvimento', cor:'#1B3B6F', icone: ICONE_POMBA, blocos:['paz','heranca','democracia','comunidade','valores'] },
{ id:'sb', nome:'Saúde e Bem-estar', cor:'#DB9270', icone: ICONE_MAOS_CORACAO, blocos:['habitos','saude_mental','cuidado','vinculos','espiritualidade'] },
{ id:'hv', nome:'Habilidades para a Vida', cor:'#E0355F', icone: ICONE_BUSSOLA, blocos:['criatividade','inteligencia','aprendizagem','autonomia'] },
];

const BLOCOS = {
criatividade:{nome:'1. Criatividade e Inovação', metaVar:4,
fixas:['Animar um Fogo de Conselho em um acampamento da patrulha ou de tropa.','Aplicar conceitos básicos de estruturas (cavaletes, encaixes, ancoragens) em projetos como pontes, balsas, pórticos ou outras pioneirias.'],
variaveis:['Organizar uma atividade de divulgação do escotismo no colégio, usando diferentes recursos: vídeos, cartazes, panfletos etc.','Conhecer e cantar canções e danças apropriadas para diferentes momentos.','Criar uma campanha publicitária divertida promovendo algum projeto ou atividade da patrulha ou Tropa Escoteira.','Construir equipamentos improvisados de campo (mesa, suporte, abrigo, utensílios) utilizando materiais disponíveis.','Propor e implementar soluções criativas para reduzir custos de uma atividade, aproveitando materiais recicláveis ou doados.','Ensinar e aplicar dois novos jogos para sua tropa.','Criar alternativas criativas para decorar o canto da patrulha ou o acampamento.','Participar de um festival de talentos na tropa.','Improvisar apresentações artísticas (esquetes, músicas, danças) em um Fogo de Conselho, explorando recursos disponíveis.','Criar um vídeo de divulgação das atividades de sua patrulha ou tropa.','Especialidade - Equivalente a 1 item variável']},
inteligencia:{nome:'2. Inteligência Emocional', metaVar:4,
fixas:['Identificar situações perigosas e de maus tratos, sabendo como agir e a quem recorrer.'],
variaveis:['Conversar com a patrulha sobre pontos fortes e de melhoria no desempenho da equipe em atividades e acampamentos.','Identificar seus medos e suas emoções diante a um obstáculo desafiador, trabalhando para conseguir superá-lo.','Em um acampamento, participar de um turno de ronda com outro companheiro de patrulha, refletindo sobre o cuidado com o outro.','Participar de jogos ou competições, respeitando regras e resultados.','Em uma atividade de patrulha ou de tropa aplicar técnicas de respiração, relaxamento ou meditação antes de um grande desafio.','Participar de rodas de conversa ou momentos de partilha após atividades intensas, ouvindo e respeitando as emoções dos demais.','Escrever uma pequena carta para si mesmo com palavras de incentivo, lembrando de suas qualidades e dando sugestões de como você pode superar desafios futuros.','Criar e encenar uma pequena história em que o personagem passa por dificuldades e encontra formas saudáveis de lidar com elas.','Especialidade - Equivalente a 1 item variável']},
aprendizagem:{nome:'3. Aprendizagem Contínua e Desenvolvimento Vocacional', metaVar:4,
fixas:['Conquistar, no Ramo Escoteiro, uma especialidade sobre um tema de seu interesse e que seja um conhecimento novo.','Em conjunto com a sua patrulha, realizar um Percurso de Gilwell de pelo menos 3km.'],
variaveis:['Enviar e receber mensagens simples em Alfabeto Fonético, Código Internacional de Sinais, Semáfora, Heliografia, Cifra de César ou Criptografia.','Visitar com a sua patrulha: hospital, quartel de bombeiros, delegacia, empresas, comércios locais ou outros para conhecer o funcionamento de diferentes profissões.','Conhecer o funcionamento de serviços de internet, rádio e TV, e usar esses conhecimentos para resolver problemas técnicos.','Convidar um especialista da comunidade para dialogar com a tropa e esclarecer dúvidas sobre determinado tema ou profissão.','Utilizar corretamente um rádio comunicador em atividade da patrulha.','Realizar uma pesquisa sobre um tema escolhido e apresentar os resultados para a patrulha ou tropa em formato criativo (cartaz, teatro, vídeo, oficina).','Planejar e executar, em conjunto com a sua patrulha, uma ação de serviço comunitário baseada em informações pesquisadas sobre necessidades locais.','Especialidade - Equivalente a 1 item variável']},
autonomia:{nome:'4. Autonomia e Liderança', metaVar:5,
fixas:['Montar corretamente uma mochila para um acampamento, mantendo o equipamento pessoal em bom estado.'],
variaveis:['Contribuir para o planejamento e a organização de uma excursão de patrulha.','Fazer uma excursão urbana com a sua patrulha ou tropa, se locomovendo por meio de transportes públicos como ônibus, trens, metrô, entre outros.','Pesquisar e realizar as compras dos alimentos para um acampamento, apresentando para a patrulha uma prestação de contas.','Saber onde encontrar, identificando em um mapa, os principais serviços públicos na cidade.','Planejar e executar em patrulha um projeto de captação de recursos para participação em uma atividade escoteira.','Participar de atividades ou oficinas sobre finanças pessoais.','Assumir pelo menos três encargos diferentes na patrulha, sendo bem avaliado pelos seus companheiros.','Administrar o fundo de patrulha por pelo menos três meses, registrando receitas e despesas, e utilizar os recursos em atividades planejadas pela patrulha.','Registrar receitas e despesas simples ou da mesada em planilha ou caderno por um período determinado.','Conduzir uma reunião de patrulha como monitor ou secretário, registrando decisões e acompanhando sua execução.','Especialidade - Equivalente a 1 item variável']},
mudancas:{nome:'5. Mudanças Climáticas', metaVar:5,
fixas:[],
variaveis:['Em um acampamento, criar uma estação meteorológica simples para registrar temperatura, umidade, direção do vento, nuvens e possíveis mudanças no tempo.','Participar da construção de um fogão solar e usá-lo em um acampamento de patrulha ou tropa.','Participar de uma excursão urbana com foco ecológico, identificando situações de risco para a sociedade referentes às mudanças climáticas.','Visitar ou participar de uma atividade com uma organização que atua em prol do meio ambiente.','Em uma excursão ou acampamento em área não urbana, identificar ações prejudiciais à natureza, como extrativismo e mineração, e listar seus impactos.','Planejar e participar de uma excursão, utilizando meios de transporte que dependem de fontes de energia limpa (bicicleta, ônibus elétrico, embarcação a remo, entre outros).','Organizar, com sua patrulha ou tropa, um projeto de conscientização sobre o uso de energia e água em sua escola, condomínio ou sede da UEL.','Participar de mutirões de plantio de mudas ou cultivo de uma horta em casa, na escola ou na UEL.','Especialidade - Equivalente a 1 item variável']},
consumo:{nome:'6. Consumo Responsável', metaVar:5,
fixas:['Em acampamentos e excursões, criar soluções para melhorar a higiene e conforto e classificar os resíduos em categorias, tratando-os adequadamente.','Planejar adequadamente e adquirir as quantidades dos alimentos para refeições em um acampamento para sua patrulha, evitando desperdício.'],
variaveis:['Registrar e analisar o consumo de água e energia da sua residência, buscando ideias para economizar, e apresentar para sua patrulha os resultados.','Avaliar o impacto ambiental de uma atividade e apresentar alternativas mais sustentáveis.','Visitar uma estação de energia renovável, uma estação de tratamento de água, uma cooperativa ou usina de reciclagem ou outras opções semelhantes.','Consertar objetos simples, como brinquedos ou pequenos eletrodomésticos.','Utilizar embalagens retornáveis ou reutilizáveis nas refeições de campo, evitando descartáveis.','Separar resíduos orgânicos e criar um sistema de compostagem caseira.','Criar uma campanha educativa para a tropa sobre consumo consciente e economia de recursos.','Trocar roupas, livros ou jogos com amigos e familiares em vez de comprar novos.','Organizar, com sua patrulha, uma campanha de conscientização sobre consumo responsável.','Confeccionar utensílios ou equipamentos a partir de materiais reciclados para uso nas atividades da patrulha.','Planejar e realizar as refeições de um dia de acampamento sem carne, garantindo a ingestão adequada de proteínas.','Organizar, cuidar e fazer reparos nos materiais da patrulha.','Especialidade - Equivalente a 1 item variável']},
preservacao:{nome:'7. Preservação da Biodiversidade', metaVar:5,
fixas:['Participar, em patrulha, de uma atividade de exploração em ambiente natural, reconhecendo a fauna e a flora locais e identificando riscos à preservação, além de propor soluções para evitá-los.'],
variaveis:['Reconhecer os animais venenosos e peçonhentos da região e saber como agir em casos de picadas ou contaminação.','Planejar e executar um projeto ambiental com a patrulha ou tropa.','Plantar uma espécie nativa e observar seu crescimento, registrando cada etapa.','Identificar as pegadas de pelo menos cinco animais da fauna brasileira e realizar levantamento das pegadas em áreas naturais.','Participar de uma atividade de mergulho que tenha o objetivo de conhecer e explorar a vida na água.','Participar de uma atividade de observação de animais noturnos com sua patrulha.','Observar e registrar espécies de aves, insetos, plantas ou outros animais durante um acampamento ou excursão.','Visitar parques, reservas ou centros de proteção ambiental para conhecer ações de preservação da fauna e da flora.','Construir comedouros ou bebedouros para aves e instalar em áreas adequadas, acompanhando seu uso.','Criar materiais educativos, como vídeos ou posts, sobre a importância de preservar a biodiversidade.','Especialidade - Equivalente a 1 item variável']},
vida_ar:{nome:'8. Vida ao Ar Livre', metaVar:5,
fixas:['Montar o campo de patrulha com pioneirias como mesa, pórtico e canto do lenhador, utilizando amarras adequadas.','Aplicar os nós direito, correr, aselha, volta do fiel, escolta, durante um acampamento sabendo sua utilização.','Escolher corretamente o local para montagem da barraca, incluindo técnicas de montagem, desmontagem e acondicionamento durante um acampamento de patrulha ou tropa.','Manusear corretamente ferramentas de corte e sapa durante um acampamento de patrulha ou tropa, zelando pela segurança e realizando reparos.','Preparar e executar uma fogueira para uma refeição mateira durante um acampamento de patrulha ou tropa, seguindo as técnicas de segurança.','Participar de ao menos duas excursões ao ar livre (patrulha ou tropa), utilizando normas de baixo impacto ambiental.','Participar de ao menos dois acampamentos ao ar livre (patrulha ou tropa), utilizando normas de baixo impacto ambiental.','Orientar-se com recursos naturais, bússola e mapa, utilizando azimutes.'],
variaveis:['Participar de um percurso no campo de pelo menos 1 km utilizando sinais de pista.','Colaborar na preparação de alimentos para a patrulha em pelo menos três atividades ao ar livre, sendo uma delas no estilo comida mateira, sem utensílios.','Desenvolver soluções para purificação e consumo de água em um acampamento.','Aplicar técnicas de "tocaia" em jogos com a patrulha.','Participar da construção de um fogão suspenso ou forno de acampamento para o preparo de uma refeição.','Construir e pernoitar em um bivaque ou abrigo natural durante uma atividade de patrulha.','Confeccionar falcaças, nó catau, lais de guia, pescador, oito duplo e demonstrar cuidados com as cordas.','Participar de uma atividade aquática com a tropa, seguindo as normas de segurança.','Desenhar um croqui de um acampamento, usando sinais topográficos.','Especialidade - Equivalente a 1 item variável']},
paz:{nome:'9. Promoção da Paz', metaVar:4,
fixas:['Aplicar uma atividade para a patrulha sobre Direitos Humanos ou os Direitos da Criança e do Adolescente.'],
variaveis:['Convidar a patrulha a cooperar em ações organizadas por uma comunidade em favor de pessoas vulneráveis.','Participar de uma excursão com sua patrulha ou tropa visitando diferentes templos e conhecendo um pouco mais sobre cada religião.','Participar de eventos de trocas culturais entre jovens de diferentes origens para estimular o respeito mútuo.','Participar de uma atividade com outro grupo escoteiro ou seção autônoma e refletir sobre o que é Fraternidade Mundial Escoteira.','Conhecer as diferentes denominações de fé e crença de amigos da patrulha, tropa, escola e comunidade.','Promover uma campanha que incentive atitudes de respeito e cooperação entre todos.','Convidar representantes de diferentes crenças para compartilhar experiências e responder perguntas da tropa.','Criar com sua patrulha ou seção um calendário de celebrações religiosas das diferentes denominações de fé e crença ali presentes.','Especialidade - Equivalente a 1 item variável']},
heranca:{nome:'10. Herança Cultural', metaVar:5,
fixas:['Realizar o hasteamento ou arriamento da bandeira em cerimônia de abertura ou encerramento de atividade.'],
variaveis:['Desenvolver sua "Árvore Genealógica", pesquisando seu sobrenome, significado e a história dos seus antepassados, situando-os no contexto histórico, e apresentá-la para sua patrulha.','Participar das cerimônias com os símbolos nacionais e cantar o Hino Nacional corretamente.','Apresentar para sua patrulha ou tropa histórias de mulheres que se destacaram em nosso país.','Participar, com sua patrulha, de uma comemoração ou festa típica da sua região.','Participar, com sua patrulha, de um safari fotográfico em sua cidade, identificando os locais de importância histórica da localidade.','Participar de um jantar festivo representando um estado diferente do seu.','Aplicar jogos e atividades típicas da sua região.','Visitar museus, centros culturais ou pontos históricos locais para conhecer o patrimônio da região.','Investigar lendas, histórias ou personagens do folclore brasileiro e dramatizá-los em esquetes no Fogo de Conselho.','Aplicar canções e danças típicas do Brasil.','Confeccionar artesanato típico de alguma região do Brasil.','Apresentar a cultura da sua cidade em um evento regional ou nacional, como feira das cidades ou noite folclórica.','Especialidade - Equivalente a 1 item variável']},
democracia:{nome:'11. Democracia', metaVar:2,
fixas:['Participar ativamente das decisões do Conselho de Patrulha, contribuindo com ideias, votando e assumindo responsabilidades, respeitando os resultados.','Participar ativamente das decisões da Assembleia de Tropa, contribuindo com ideias, votando e assumindo responsabilidades, respeitando os resultados.','Participar da eleição do monitor da patrulha e das decisões de encargos, respeitando os resultados.'],
variaveis:['Visitar a sede administrativa de qualquer um dos três poderes, e explicar a importância e as particularidades desta forma de governo, conhecendo a constituição e os símbolos nacionais, do estado e município.','Conhecer a estrutura do grupo escoteiro ou seção autônoma e participar de uma Assembleia da UEL.','Participar ativamente de um fórum de jovens do grupo escoteiro.','Aprender e compartilhar sobre a história do voto e da democracia no Brasil.','Especialidade - Equivalente a 1 item variável']},
comunidade:{nome:'12. Comunidade', metaVar:3,
fixas:['Identificar, sozinho ou em patrulha, uma necessidade da comunidade e planejar e executar uma ação comunitária.','Identificar os riscos de desastres naturais na comunidade e conhecer os hospitais e contatos de emergência, sabendo quando acionar cada um.'],
variaveis:['Aplicar o conhecimento adquirido nas especialidades em ações de serviço à comunidade.','Participar ativamente de pelo menos uma campanha de serviço e desenvolvimento comunitário organizadas pela UEL, distrito ou região.','Organizar uma oficina de brinquedos, doando os itens consertados para uma instituição que atende crianças carentes.','Colaborar em ações organizadas por outras instituições de serviço.','Especialidade - Equivalente a 1 item variável']},
valores:{nome:'13. Valores', metaVar:3,
fixas:['Avaliar, com seus companheiros de patrulha, a vivência da Promessa e Lei Escoteira.'],
variaveis:['Participar da avaliação da sua Progressão Pessoal e dos companheiros da patrulha.','Explicar o significado da Lei e da Promessa Escoteira aos novos membros da patrulha.','Auxiliar um companheiro de patrulha a realizar sua Promessa Escoteira.','Explicar aos novos membros da patrulha os significados da flor-de-lis e da Saudação Escoteira.','Conhecer e cantar o Hino Alerta.','Especialidade - Equivalente a 1 item variável']},
habitos:{nome:'14. Hábitos Saudáveis', metaVar:3,
fixas:['Planejar e executar um cardápio completo e saudável (café da manhã, almoço e jantar) para a patrulha em acampamento.','Conhecer e aplicar normas de limpeza no tratamento e conservação de alimentos nas atividades de patrulha.'],
variaveis:['Manter hábitos de higiene pessoal, utilizar o vestuário ou uniforme adequadamente, demonstrando aplicação correta dos distintivos.','Contribuir para manter a sede do grupo e canto de patrulha em ordem e em perfeito estado de conservação.','Montar um cronograma semanal, equilibrando estudos, responsabilidades e momentos de lazer.','Praticar uma atividade física regularmente.','Promover um piquenique com alimentos saudáveis com sua patrulha ou tropa.','Manter adequada rotina de sono e alimentação saudável.','Saber o que são as indicações de rótulos, o que são gorduras saturadas, conservantes, corantes além dos selos de advertência.','Arrumar e limpar seu quarto e contribuir nas rotinas da casa.','Especialidade - Equivalente a 1 item variável']},
saude_mental:{nome:'15. Saúde Mental', metaVar:2,
fixas:['Conhecer o conceito de Espaços Seguros e aplicá-los em todas as atividades de sua patrulha ou tropa.','Aprender a identificar sinais de tristeza ou isolamento em colegas e saber como oferecer apoio inicial, como conversar com respeito e buscar ajuda de um adulto de confiança.'],
variaveis:['Participar de uma atividade sobre a importância do autocuidado e da saúde mental.','Conduzir uma sessão de relaxamento como yoga, meditação, caminhadas silenciosas na natureza, alongamentos, entre outras, para sua patrulha ou tropa.','Organizar sua rotina de atividades semanais, considerando a importância do equilíbrio entre as atividades do mundo digital e real e realizar uma atividade de bem-estar offline.','Propor momentos de descontração com a família ao ar livre, evitando o uso da tecnologia e compartilhar como foi a experiência.','Participar com sua patrulha de uma atividade que promova o contato com seus sentidos e promova momentos de equilíbrio emocional como por exemplo: uma trilha sensorial, pintura livre, roda de canções, observação de céu ou fogueira etc.','Especialidade - Equivalente a 1 item variável']},
cuidado:{nome:'16. Cuidado com o Corpo', metaVar:4,
fixas:['Conhecer as ações iniciais em acidentes e como cuidar de: pequenos cortes; contusões; escoriações; queimaduras e picadas de animais peçonhentos.','Aplicar técnicas de bandagens e transporte de feridos.','Cuidar da segurança física e mental nas atividades escoteiras, respeitando os limites próprios e dos outros, e seguindo as orientações dos escotistas.'],
variaveis:['Conhecer as medidas do seu corpo (palmo, envergadura, passo simples e duplo) e aplicá-las durante uma excursão com sua patrulha.','Participar de uma atividade, oficina, palestra que trate dos malefícios dos seguintes assuntos: anorexia, bulimia, drogas, álcool, cigarro e cigarros eletrônicos.','Saber contato dos órgãos de emergência e saber como informar os sinais vitais e situação da vítima.','Participar de uma simulação de acidente e atuar em conjunto com a sua patrulha.','Proteger-se do sol e do frio durante as atividades, identificando casos de desidratação e insolação, e respeitar os limites do seu corpo.','Demonstrar como ajudar uma pessoa em casos de obstrução das vias aéreas e convulsões.','Conhecer os itens que compõem a caixa de primeiros socorros da patrulha e mantê-la organizada.','Saber agir em casos de hemorragia.','Especialidade - Equivalente a 1 item variável']},
vinculos:{nome:'17. Vínculos Saudáveis', metaVar:4,
fixas:['Realizar uma campanha para combater o bullying e cyberbullying para a comunidade.'],
variaveis:['Participar de jogos com a patrulha ou a tropa, respeitando as regras e seus participantes.','Organizar uma atividade de patrulha em sua casa ou na casa de um membro da patrulha.','Ensinar uma canção escoteira a outros escoteiros.','Ajudar outro membro da UEL a conquistar uma especialidade ou insígnias.','Propor metas para melhorar a convivência na vida na patrulha e na tropa, compreendendo como todos se sentem quanto a isso.','Participar de uma atividade entre diferentes grupos escoteiros ou atividade regional ou nacional.','Acolher os novos integrantes da patrulha.','Assumir tarefas domésticas para melhorar a convivência em casa.','Participar de uma atividade da tropa com a família ou responsáveis.','Convidar um colega da mesma faixa etária para participar de um Fogo de Conselho, integrado a sua patrulha e com o devido "Registro de Visitante".','Especialidade - Equivalente a 1 item variável']},
espiritualidade:{nome:'18. Espiritualidade', metaVar:4,
fixas:[],
variaveis:['Fazer reflexões espirituais rotineiras na tropa ou patrulha, ao ar livre.','Apresentar um pequeno relato à patrulha ou tropa sobre os ensinamentos de sua crença ou religião.','Auxiliar na realização de uma celebração de sua comunidade religiosa.','Celebrar sua crença ou religião regularmente.','Colaborar na organização de um culto interconfessional em uma atividade escoteira.','Participar de um momento de reflexão e conexão com um ambiente natural em que possa apreciar e agradecer a beleza do mundo natural.','Especialidade - Equivalente a 1 item variável']},
};
const BLOCO_IDS = Object.keys(BLOCOS);

  return { EIXOS: EIXOS, BLOCOS: BLOCOS, BLOCO_IDS: BLOCO_IDS };
})();

/* ---------- funções que index.html e tropa-senior.html usavam repetidas ---------- */
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
function urlComAuthFirebase(url) {
  if (typeof firebaseAuthToken === 'undefined' || !firebaseAuthToken) return url;
  return url + (url.indexOf('?') !== -1 ? '&' : '?') + 'auth=' + firebaseAuthToken;
}
async function renovarTokenSessao(refreshToken) {
  let resp;
  try { resp = await fetch('https://securetoken.googleapis.com/v1/token?key=' + window.V2_CONFIG.API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
  }); } catch (e) { return null; } // sem internet: devolve null em vez de dar erro
  const data = await resp.json().catch(() => null);
  if (data && data.id_token) return { idToken: data.id_token, refreshToken: data.refresh_token };
  return null;
}

/* ---------- dados fixos (antes ficavam dentro de index.html e tropa-senior.html) ---------- */
window.V2_DADOS_ESC = (function () {
var JOVENS_BASE = ['miguel','sabrina','pedro','ivan','richard','anita','ashylley','sophiak','felipa','fernando','eduardo','larissa','safira','rafael','thaynara','sophiar','victor','maria','giovanna','sophiad'];
var JNOMES_PADRAO = {miguel:'Miguel Silva',sabrina:'Sabrina Sigmaringa',pedro:'Pedro Andrade',ivan:'Ivan Moraes',richard:'Richard Fonseca',anita:'Anita Gomes',ashylley:'Ashylley Santos',sophiak:'Sophia Khatuanian',felipa:'Felipa Almeida',fernando:'Fernando Santos',eduardo:'Eduardo Dias',larissa:'Larissa Souza',safira:'Safira Fonseca',rafael:'Rafael Cruz',thaynara:'Thaynara Santos',sophiar:'Sophia Rodrigues',victor:'Victor Silva',maria:'Maria Santos',giovanna:'Giovanna Souza',sophiad:'Sophia Diniz'};
  return { JOVENS_BASE: JOVENS_BASE, JNOMES_PADRAO: JNOMES_PADRAO };
})();

window.V2_DADOS_SR = (function () {
var BLOCKS = [
  {id:"criatividade",name:"Criatividade e Inovação",eixo:"hv",focus:true,semester:1,campOnly:false,minVariable:3,fixed:[{id:"f1",name:"Durante um acampamento, planejar e executar pioneirias inovadoras de médio ou grande porte"}],variable:[{id:"v1",name:"Organizar e conduzir Fogo de Conselho ou show de talentos para tropa, UEL ou comunidade"},{id:"v2",name:"Organizar uma noite cultural para a patrulha ou tropa"},{id:"v3",name:"Produzir curta metragem ou vídeo criativo sobre Escotismo"},{id:"v4",name:"Organizar apresentação artística ou cultural voltada à comunidade"},{id:"v5",name:"Planejar e realizar mostra sobre tema de interesse com registros variados para a tropa ou comunidade"},{id:"v6",name:"Participar de concursos culturais, literários ou artísticos locais representando a tropa"},{id:"v7",name:"Construir versão simplificada de horizonte artificial funcional com 2 eixos (arfagem e rolagem)"}],specialties:[{id:"s1",name:"Comunicações"}],insignias:[{id:"g1",name:"Inovadores de Impacto Sênior"}]},
  {id:"inteligencia",name:"Inteligência Emocional",eixo:"hv",focus:false,semester:0,campOnly:false,minVariable:4,fixed:[{id:"f1",name:"Reconhecer situações que comprometam integridade física ou emocional, sabendo como agir e a quem recorrer"},{id:"f2",name:"Praticar feedback construtivo durante atividades, expressando opiniões de forma assertiva e respeitosa"}],variable:[{id:"v1",name:"Identificar mudanças de emoção repentinas, equilibrando decisões e reações de forma respeitosa"},{id:"v2",name:"Envolver-se em atividades aventureiras com segurança, conhecendo limites e enfrentando medos"},{id:"v3",name:"Identificar situações de estresse ou desconforto e ferramentas para solucioná-las, respeitando limites"},{id:"v4",name:"Negociar responsabilidades familiares e pessoais de forma respeitosa e madura"},{id:"v5",name:"Conduzir dinâmicas de confiança e cooperação lidando com frustrações e celebrando conquistas coletivas"}],specialties:[],insignias:[]},
  {id:"aprendizagem",name:"Aprendizagem Contínua e Des. Vocacional",eixo:"hv",focus:false,semester:0,campOnly:false,minVariable:3,fixed:[{id:"f1",name:"Conquistar no Ramo Sênior uma especialidade sobre tema de interesse que seja conhecimento novo"}],variable:[{id:"v1",name:"Explorar áreas profissionais em Feira de Profissões ou entrevistando profissionais de interesse"},{id:"v2",name:"Engajar em voluntariado ou estágio em instituição de interesse para vivência prática e desenvolvimento"},{id:"v3",name:"Participar de palestras, workshops ou vivências de orientação vocacional e planejamento de carreira"},{id:"v4",name:"Organizar atividade para a patrulha ou tropa voltada para escolha vocacional"},{id:"v5",name:"Organizar oficina, curso ou palestra para a tropa sobre tema de interesse"},{id:"v6",name:"Participar de feiras, mostras ou eventos científicos/escolares apresentando trabalhos ou projetos"}],specialties:[{id:"s1",name:"Gastronomia"},{id:"s2",name:"Tecnologia"},{id:"s3",name:"Educação"},{id:"s4",name:"Idiomas"}],insignias:[{id:"g1",name:"Aprender Sênior"},{id:"g2",name:"Aeronauta"},{id:"g3",name:"Naval"}]},
  {id:"autonomia",name:"Autonomia e Liderança",eixo:"hv",focus:false,semester:0,campOnly:false,minVariable:4,fixed:[{id:"f1",name:"Conhecer material individual e de patrulha para diferentes tipos de excursão e saber organizá-lo na mochila"}],variable:[{id:"v1",name:"Participar ativamente do planejamento, execução e avaliação de atividades da patrulha, tropa ou equipe de interesse"},{id:"v2",name:"Desenvolver o planejamento orçamentário de uma atividade de patrulha, equipe de interesse ou tropa"},{id:"v3",name:"Utilizar transporte coletivo urbano para atividade externa de patrulha"},{id:"v4",name:"Implementar estratégia financeira para alcançar meta pessoal, compartilhando com a patrulha"},{id:"v5",name:"Planejar e executar projeto de captação de recursos para atividade escoteira ou projeto pessoal"},{id:"v6",name:"Assumir e desempenhar diferentes encargos na patrulha, sendo bem avaliado pelos companheiros"},{id:"v7",name:"Planejar e conduzir um grande jogo para a tropa com apoio da patrulha ou equipe de interesse"}],specialties:[{id:"s1",name:"Empreendedorismo e Negócios"},{id:"s2",name:"Finanças e Economia"},{id:"s3",name:"Liderança e Gestão"},{id:"s4",name:"Viagens"}],insignias:[]},
  {id:"consumo",name:"Consumo Responsável",eixo:"ma",focus:true,semester:2,campOnly:false,minVariable:4,fixed:[],variable:[{id:"v1",name:"Liderar separação de resíduos recicláveis e orgânicos em festa, comunidade ou eventos regionais/nacionais"},{id:"v2",name:"Visitar estação de tratamento de esgoto, aterro sanitário ou cooperativa de reciclagem e discutir questões ambientais"},{id:"v3",name:"Desenvolver projeto sobre descarte correto de materiais eletrônicos na UEL, comunidade ou escola"},{id:"v4",name:"Organizar oficina, debate ou workshop: Cruelty-free, Vegetarianismo, Upcycling, Obsolescência Programada ou Microplástico"},{id:"v5",name:"Em acampamento, executar receita com cascas, talos ou sobras de alimentos"},{id:"v6",name:"Organizar brechó beneficente ou feira de trocas em sua UEL ou comunidade"},{id:"v7",name:"Participar de visita a cooperativa de reciclagem ou projeto comunitário ligado à economia circular"}],specialties:[{id:"s1",name:"Agricultura Sustentável"}],insignias:[{id:"g1",name:"Reduzir, Reciclar, Reutilizar Sênior"}]},
  {id:"mudancas",name:"Mudanças Climáticas",eixo:"ma",focus:true,semester:1,campOnly:false,minVariable:4,fixed:[],variable:[{id:"v1",name:"Utilizar ferramentas de acompanhamento meteorológico para planejamento de atividades ao ar livre"},{id:"v2",name:"Desenvolver iniciativas ou projetos sobre mudanças climáticas e soluções sustentáveis"},{id:"v3",name:"Organizar com a patrulha atividade ecológica em área urbana, identificando problemas e propondo soluções"},{id:"v4",name:"Participar de clubes ou projetos voltados para sustentabilidade e mudanças climáticas"},{id:"v5",name:"Utilizar e promover transporte coletivo, bicicleta ou caminhada em atividade escoteira e meio de energia renovável"},{id:"v6",name:"Planejar e executar projeto comunitário de reaproveitamento de recursos naturais ou uso de energias renováveis"}],specialties:[{id:"s1",name:"Sustentabilidade"}],insignias:[{id:"g1",name:"Escoteiros pela Energia Solar Sênior"}]},
  {id:"preservacao",name:"Preservação da Biodiversidade",eixo:"ma",focus:true,semester:1,campOnly:false,minVariable:2,fixed:[{id:"f1",name:"Participar de atividade em Área de Proteção Ambiental, reconhecendo fauna, flora e bioma, identificando riscos e propondo soluções de preservação"}],variable:[{id:"v1",name:"Participar de eventos sobre preservação da biodiversidade organizados por ONGs, escolas ou parques naturais"},{id:"v2",name:"Colaborar em projeto ou ação promovido por alguma ONG ambiental"},{id:"v3",name:"Coletar e registrar dados sobre espécies locais, qualidade da água ou vegetação"},{id:"v4",name:"Organizar projeto: abrigos de animais silvestres, enriquecimento ambiental, reintegração ou preservação da fauna"},{id:"v5",name:"Organizar plantio de árvores nativas em parceria com órgãos ambientais ou ONGs"},{id:"v6",name:"Conduzir campanha de conscientização sobre preservação de fauna e flora em praças, escolas ou redes sociais"},{id:"v7",name:"Promover palestras ou oficinas à comunidade sobre redução de impactos ambientais e proteção da biodiversidade"}],specialties:[{id:"s1",name:"Natureza e Ciências Naturais"},{id:"s2",name:"Educação Ambiental"}],insignias:[{id:"g1",name:"Campeões da Natureza Sênior"}]},
  {id:"vida_ar",name:"Vida ao Ar Livre",eixo:"ma",focus:true,semester:1,campOnly:true,minVariable:5,fixed:[{id:"f1",name:"Montar campo de patrulha com pioneirias (mesa, canto do lenhador, pórtico) usando amarras adequadas"},{id:"f2",name:"Aplicar nós: direito, correr, lais de guia, volta do fiel, nó em oito, balso pelo seio, catau, volta do salteador e boca de lobo em acampamento"},{id:"f3",name:"Escolher local correto para a barraca, montar, desmontar e acondicionar — em acampamento de tropa ou patrulha"},{id:"f4",name:"Manusear ferramentas de corte e sapa com segurança, realizando reparos — em acampamento de tropa ou patrulha"},{id:"f5",name:"Preparar e executar ao menos 3 tipos de fogueiras para refeição mateira, zelando pela segurança em acampamento"},{id:"f6",name:"Planejar e realizar ao menos uma excursão de patrulha em ambiente natural"},{id:"f7",name:"Planejar e realizar ao menos um acampamento de patrulha com técnicas de campismo de baixo impacto"},{id:"f8",name:"Em atividade ao ar livre, orientar-se com carta topográfica/náutica e bússola usando métodos naturais e tecnológicos"}],variable:[{id:"v1",name:"Participar de um acampamento volante"},{id:"v2",name:"Selecionar corretamente materiais de campo para acampamento de patrulha"},{id:"v3",name:"Planejar e construir com a patrulha: barraca suspensa, torre de observação ou ponte"},{id:"v4",name:"Demonstrar conhecimento sobre processos de ancoragem e estiramento de cabos"},{id:"v5",name:"Utilizar formas de acondicionamento de alimentos e técnicas de purificação de água em acampamento"},{id:"v6",name:"Durante acampamento de patrulha ou tropa, pernoitar em abrigo natural"},{id:"v7",name:"Durante atividade aventureira, pernoitar em bivaque, abrigo natural ou ao relento"},{id:"v8",name:"Participar de rafting, canoagem, rapel, espeleologia, escalada, trekking ou mountain bike"},{id:"v9",name:"Participar de atividades aquáticas de exploração de corpos d'água naturais respeitando segurança"},{id:"v10",name:"Participar de acampamento de média (3-5 dias) ou longa (6-10 dias) duração organizado pela patrulha ou tropa"}],specialties:[{id:"s1",name:"Esportes de Aventura"},{id:"s2",name:"Ecoturismo"},{id:"s3",name:"Habilidades Escoteiras"}],insignias:[]},
  {id:"comunidade",name:"Comunidade",eixo:"pd",focus:true,semester:1,campOnly:false,minVariable:2,fixed:[{id:"f1",name:"Participar, sozinho ou em patrulha/equipe, de ao menos 10 horas de ação comunitária com instituições locais"},{id:"f2",name:"Capacitar-se em curso de entidade de referência (Defesa Civil, Cruz Vermelha, Bombeiros) para crises humanitárias"}],variable:[{id:"v1",name:"Identificar riscos de desastres naturais na comunidade, conhecer protocolos de segurança e atuar de acordo"},{id:"v2",name:"Planejar atividade comunitária: limpeza de praça, visita a instituição, revitalização de creche ou lar de idosos"},{id:"v3",name:"Criar uma biblioteca comunitária móvel com livros doados"},{id:"v4",name:"Organizar campanha de arrecadação (alimentos, roupas, livros) envolvendo diferentes setores da comunidade"},{id:"v5",name:"Representar a tropa em fóruns, conselhos ou encontros comunitários, contribuindo com ideias e propostas"},{id:"v6",name:"Promover ações de educação ambiental, saúde ou cidadania em parceria com outras instituições"}],specialties:[{id:"s1",name:"Desenvolvimento Comunitário"},{id:"s2",name:"Ações Humanitárias"},{id:"s3",name:"Inclusão e Acessibilidade"}],insignias:[{id:"g1",name:"Insígnia Desafio Comunitário"},{id:"g2",name:"Mensageiros da Paz Sênior"},{id:"g3",name:"Escoteiros do Mundo Sênior"}]},
  {id:"democracia",name:"Democracia",eixo:"pd",focus:true,semester:1,campOnly:false,minVariable:4,fixed:[{id:"f1",name:"Participar ativamente das decisões do Conselho de Patrulha, contribuindo, votando e assumindo responsabilidades"},{id:"f2",name:"Participar ativamente das decisões da Assembleia de Tropa, contribuindo, votando e assumindo responsabilidades"},{id:"f3",name:"Participar da eleição do monitor da patrulha e das decisões dos encargos, respeitando os resultados"}],variable:[{id:"v1",name:"Participar de Audiência Pública ou consultas populares promovidas pelo poder legislativo"},{id:"v2",name:"Emitir título de eleitor e, em ano eleitoral, pesquisar candidatos e propostas compreendendo processos democráticos"},{id:"v3",name:"Planejar e executar campanha para educar jovens sobre voto consciente e direitos do cidadão"},{id:"v4",name:"Participar de ao menos uma Assembleia do Grupo Escoteiro"},{id:"v5",name:"Participar ativamente de um Fórum de Grupo Escoteiro"},{id:"v6",name:"Participar de grêmio estudantil ou conferências de juventude"},{id:"v7",name:"Participar de atividade da seção (debates, estudos de caso ou júri simulado) de forma respeitosa e contributiva"},{id:"v8",name:"Participar de dinâmicas de mediação de conflitos, praticando escuta ativa e construção de consensos"}],specialties:[{id:"s1",name:"Equidade"},{id:"s2",name:"Políticas Públicas"}],insignias:[]},
  {id:"heranca",name:"Herança Cultural",eixo:"pd",focus:true,semester:2,campOnly:false,minVariable:5,fixed:[{id:"f1",name:"Conduzir a cerimônia de abertura de uma atividade de patrulha ou tropa"}],variable:[{id:"v1",name:"Organizar expedição com contato cultural: Povos originários, Comunidades quilombolas, Ribeirinhas ou Caiçaras"},{id:"v2",name:"Organizar recepção de membros do Movimento Escoteiro de outras localidades e apresentar pontos históricos da cidade"},{id:"v3",name:"Fazer tour explorando pontos históricos e culturais: centro cultural, biblioteca, mercado, feiras, museus, marcos históricos"},{id:"v4",name:"Identificar núcleos culturais da região e participar de atividades com eles"},{id:"v5",name:"Apresentar expressão artística da cultura popular brasileira em Fogo de Conselho"},{id:"v6",name:"Promover festival com música, poesia, dança e literatura típicas de uma região para o grupo ou comunidade"},{id:"v7",name:"Produzir com a patrulha peça de uso cotidiano utilizando técnicas de artesanato brasileiro"},{id:"v8",name:"Apresentar a cultura da cidade em evento regional, nacional ou internacional"}],specialties:[{id:"s1",name:"Cultura e Arte"}],insignias:[]},
  {id:"paz",name:"Promoção da Paz",eixo:"pd",focus:true,semester:2,campOnly:false,minVariable:5,fixed:[{id:"f1",name:"Participar de ação colaborativa sobre cultura de paz: Direitos Humanos, Diálogo Inter-religioso, Refugiados, Diversidades ou Inclusão"}],variable:[{id:"v1",name:"Organizar mesa redonda sobre: Idolatria, Torcidas organizadas, Tribos urbanas, Intolerância religiosa ou Xenofobia"},{id:"v2",name:"Participar de atividades que promovam a paz e compreensão entre as pessoas"},{id:"v3",name:"Participar com patrulha de atividade inter-religiosa, conhecendo tradições de fé e refletindo sobre diversidade espiritual"},{id:"v4",name:"Participar de simulação das Nações Unidas debatendo questões globais sobre direitos humanos"},{id:"v5",name:"Organizar e realizar atividade com outra unidade escoteira, refletindo sobre fraternidade mundial escoteira"},{id:"v6",name:"Organizar \"Jantar Internacional\" apresentando culinária, trajes, músicas e Escotismo de diferentes países"},{id:"v7",name:"Participar de atividades e jogos ou ação de solidariedade com jovens da comunidade em local religioso ou espiritual"},{id:"v8",name:"Desenvolver momento inter-religioso na seção, grupo escoteiro ou comunidade"}],specialties:[{id:"s1",name:"Direitos Humanos"},{id:"s2",name:"Diversidades"}],insignias:[{id:"g1",name:"Lusofonia Sênior"},{id:"g2",name:"Cone Sul Sênior"}]},
  {id:"valores",name:"Valores",eixo:"pd",focus:false,semester:0,campOnly:false,minVariable:2,fixed:[{id:"f1",name:"Avaliar com os pares a vivência da Promessa e da Lei Escoteira e realizar o Compromisso Sênior"}],variable:[{id:"v1",name:"Participar da avaliação da sua Progressão Pessoal e dos companheiros em patrulha"},{id:"v2",name:"Explicar o significado da Lei e da Promessa Escoteiras aos novos membros da patrulha"},{id:"v3",name:"Auxiliar um companheiro de patrulha a realizar seu Compromisso Sênior"},{id:"v4",name:"Participar de debate de casos reais ou situações sociais analisando-os à luz dos valores escoteiros"}],specialties:[],insignias:[]},
  {id:"cuidado",name:"Cuidado com o Corpo",eixo:"sb",focus:true,semester:2,campOnly:false,minVariable:3,fixed:[{id:"f1",name:"Capacitar-se em primeiros socorros: cortes, contusões, queimaduras, picadas, hemorragias, fraturas, RCP, AVC, engasgo e emergências"},{id:"f2",name:"Nas atividades da patrulha ou tropa, identificar condutas de risco à saúde física e mental e propor medidas de mitigação"}],variable:[{id:"v1",name:"Experimentar atividades físicas ou modalidades esportivas diversas (coletivas, individuais, adaptadas) e refletir sobre a experiência"},{id:"v2",name:"Pesquisar sobre saúde física e mental na juventude e apresentar propostas à tropa para melhorar hábitos"},{id:"v3",name:"Conduzir oficinas ou jogos inclusivos que valorizem a diversidade de habilidades físicas do grupo"},{id:"v4",name:"Participar de workshop sobre: Perigos de anabolizantes, drogas, álcool, tabaco, cigarro eletrônico ou Distúrbios Alimentares"},{id:"v5",name:"Organizar o material de primeiros socorros da patrulha para diferentes atividades"},{id:"v6",name:"Participar de workshop ou atividade relacionada à prevenção de IST (Infecções Sexualmente Transmissíveis)"}],specialties:[{id:"s1",name:"Saúde"}],insignias:[]},
  {id:"espiritualidade",name:"Espiritualidade",eixo:"sb",focus:true,semester:2,campOnly:false,minVariable:3,fixed:[],variable:[{id:"v1",name:"Conduzir momentos de silêncio, oração ou meditação em atividades da tropa, valorizando diversidade espiritual"},{id:"v2",name:"Participar de projetos e atividades para conhecer, atuar e dialogar com jovens de diferentes crenças e opções de fé"},{id:"v3",name:"Colaborar em celebrações religiosas ou outras expressões de fé e espiritualidade da comunidade"},{id:"v4",name:"Organizar momento de reflexão e conexão com ambiente natural: banho de floresta, dia da gratidão, artes ou culto"}],specialties:[],insignias:[]},
  {id:"habitos",name:"Hábitos Saudáveis",eixo:"sb",focus:true,semester:1,campOnly:false,minVariable:2,fixed:[{id:"f1",name:"Planejar cardápio de acampamento para a patrulha priorizando alimentação sustentável e redução de resíduos, avaliando resultados"},{id:"f2",name:"Praticar atividades físicas regularmente"}],variable:[{id:"v1",name:"Manter o canto da patrulha limpo e organizado, colaborando com a limpeza da sede"},{id:"v2",name:"Planejar e realizar almoço ou jantar equilibrado e saudável para a patrulha, elaborando cardápio e avaliando"},{id:"v3",name:"Praticar meditação, yoga ou técnicas de relaxamento na natureza"},{id:"v4",name:"Elaborar plano pessoal de hábitos saudáveis e avaliar seu cumprimento ao longo do ciclo"},{id:"v5",name:"Demonstrar manter rotina de cuidado com ambiente doméstico, com autonomia e cooperação nas responsabilidades"}],specialties:[{id:"s1",name:"Esportes"},{id:"s2",name:"Educação Alimentar e Nutricional"}],insignias:[]},
  {id:"saude_mental",name:"Saúde Mental",eixo:"sb",focus:false,semester:0,campOnly:false,minVariable:3,fixed:[{id:"f1",name:"Buscar informações sobre Espaços Seguros no Movimento Escoteiro e promover seus conceitos em todas as atividades"},{id:"f2",name:"Reconhecer sinais de estresse, ansiedade ou tristeza em colegas e praticar primeiros socorros em saúde mental"}],variable:[{id:"v1",name:"Realizar com patrulha campanha de saúde mental como Setembro Amarelo ou Janeiro Branco"},{id:"v2",name:"Desenvolver hábitos e atividades para aliviar tensão do dia a dia, proporcionando bem-estar e equilíbrio"},{id:"v3",name:"Convidar profissionais de saúde e saúde mental para falar sobre o assunto na tropa"},{id:"v4",name:"Organizar rotina de atividades mensais equilibrando mundo digital e real, incluindo atividade offline"},{id:"v5",name:"Utilizar técnicas de auto expressão e contato com emoções: Mindfulness, meditação, terapia, teatro ou dança"}],specialties:[{id:"s1",name:"Saúde Mental e Bem-estar Emocional"},{id:"s2",name:"Hobbies e Lazer"}],insignias:[]},
  {id:"vinculos",name:"Vínculos Saudáveis",eixo:"sb",focus:false,semester:0,campOnly:false,minVariable:3,fixed:[{id:"f1",name:"Identificar e discutir com patrulha manifestações de bullying e cyberbullying, elaborando e implementando estratégias de prevenção"}],variable:[{id:"v1",name:"Promover encontro social reunindo jovens de diferentes realidades, criando ambiente de convivência e respeito à diversidade"},{id:"v2",name:"Realizar roda de conversa sobre confiança, respeito e equilíbrio nas relações"},{id:"v3",name:"Engajar em equipe de interesse para planejar e executar projetos, fortalecendo vínculos positivos no grupo"},{id:"v4",name:"Promover reuniões regulares na patrulha com espaços de escuta e apoio, incentivando empatia e soluções conjuntas"},{id:"v5",name:"Assumir responsabilidades no ambiente familiar, contribuindo com tarefas e promovendo diálogo respeitoso"},{id:"v6",name:"Convidar colega da mesma faixa etária para participar de Fogo de Conselho com Registro de Visitante"}],specialties:[{id:"s1",name:"Saúde Sexual e Reprodutiva"}],insignias:[]}
];;

var EIXOS = {
  hv:{label:'Habilidades para a Vida',icon:'⚙',color:'--hv',border:'--hv-b',text:'--hv-t',blockIds:['aprendizagem','autonomia','criatividade','inteligencia']},
  ma:{label:'Meio Ambiente',icon:'🌿',color:'--ma',border:'--ma-b',text:'--ma-t',blockIds:['consumo','mudancas','preservacao','vida_ar']},
  pd:{label:'Paz e Desenvolvimento',icon:'🕊',color:'--pd',border:'--pd-b',text:'--pd-t',blockIds:['comunidade','democracia','heranca','paz','valores']},
  sb:{label:'Saúde e Bem-estar',icon:'💪',color:'--sb',border:'--sb-b',text:'--sb-t',blockIds:['cuidado','espiritualidade','habitos','saude_mental','vinculos']},
};

var CAL_2S26 = [
  {n:1,dia:'01',mes:'AGO',tipo:'planejar',fmt:'T',blocos:'',comp:'',
   txt:'Boas-vindas e abertura do ciclo: apresentação do plano de 1 ano, ratificação dos blocos-foco, distribuição de encargos. Cerimônia de Passagem da Isis <em>(a definir — antes de 06/08)</em>.',special:''},
  {n:2,dia:'08',mes:'AGO',tipo:'normal',fmt:'T',blocos:'Preservação da Biodiversidade',comp:'1º Compromisso Sênior',
   txt:'Bloco Preservação da Biodiversidade: coleta de dados sobre espécies locais e planejamento de visita à APA.',special:''},
  {n:3,dia:'15',mes:'AGO',tipo:'normal',fmt:'T',blocos:'Democracia',comp:'2º Compromisso Sênior',
   txt:'Bloco Democracia: Conselho de Patrulha, Assembleia de Tropa e eleição de encargos (Ações Fixas obrigatórias).',special:''},
  {n:4,dia:'22',mes:'AGO',tipo:'normal',fmt:'T',blocos:'Democracia + Comunidade',comp:'3º Compromisso Sênior',
   txt:'Bloco Democracia: dinâmicas de mediação e debate sobre voto consciente. Início do bloco Comunidade: identificação de necessidades comunitárias.',special:''},
  {n:5,dia:'29–30',mes:'AGO',tipo:'pernoite',fmt:'PN',blocos:'',comp:'4º Compromisso Sênior',
   txt:'ENDURO DISTRITAL SÊNIOR (sáb + dom — 1º pernoite). Atividade de aventura e resistência com outras unidades do distrito.',special:'enduro'},
  {n:6,dia:'05',mes:'SET',tipo:'normal',fmt:'T',blocos:'Comunidade',comp:'5º Compromisso Sênior',
   txt:'Bloco Comunidade: planejamento e início das 10h de ação comunitária. Contato com entidade de referência para capacitação.',special:''},
  {n:7,dia:'12',mes:'SET',tipo:'normal',fmt:'T',blocos:'',comp:'',
   txt:'RADICAL DAY DISTRITAL. Atividade radical e aventureira promovida pelo distrito.',special:'radical'},
  {n:8,dia:'19',mes:'SET',tipo:'normal',fmt:'T',blocos:'Preservação da Biodiversidade',comp:'',
   txt:'Bloco Preservação da Biodiversidade: visita à Área de Proteção Ambiental (Ação Fixa) e atividade com ONG ambiental.',special:''},
  {n:9,dia:'26',mes:'SET',tipo:'normal',fmt:'T',blocos:'Mudanças Climáticas',comp:'',
   txt:'Bloco Mudanças Climáticas: ferramentas meteorológicas, debate sobre impactos e soluções sustentáveis.',special:''},
  {n:10,dia:'03',mes:'OUT',tipo:'normal',fmt:'T',blocos:'Hábitos Saudáveis + Mudanças Climáticas',comp:'',
   txt:'Bloco Hábitos Saudáveis: planejamento de cardápio sustentável (Ação Fixa) + atividades físicas. Bloco Mudanças Climáticas: atividade ecológica urbana.',special:''},
  {n:11,dia:'10',mes:'OUT',tipo:'normal',fmt:'T',blocos:'Hábitos Saudáveis + Criatividade e Inovação',comp:'',
   txt:'Bloco Hábitos Saudáveis: avaliação de hábitos. Início do Bloco Criatividade e Inovação: noite cultural ou mostra de interesse.',special:''},
  {n:12,dia:'17',mes:'OUT',tipo:'normal',fmt:'T',blocos:'Criatividade e Inovação',comp:'',
   txt:'Bloco Criatividade e Inovação: fogo de conselho criativo, show de talentos ou produção de vídeo.',special:''},
  {n:13,dia:'24',mes:'OUT',tipo:'normal',fmt:'T',blocos:'Comunidade + Mudanças Climáticas',comp:'',
   txt:'Bloco Comunidade: conclusão das 10h de ação comunitária + capacitação para crises humanitárias. Bloco Mudanças Climáticas: projeto de reaproveitamento.',special:''},
  {n:'—',dia:'31',mes:'OUT',tipo:'sem',fmt:'',blocos:'',comp:'',
   txt:'Sem atividade — chefia em curso (30/10/2026).',special:'sem'},
  {n:14,dia:'07',mes:'NOV',tipo:'normal',fmt:'T',blocos:'Democracia + Hábitos Saudáveis',comp:'',
   txt:'Bloco Democracia: atividades da seção e assembleia/fórum do grupo. Bloco Hábitos Saudáveis: plano de hábitos pessoais.',special:''},
  {n:15,dia:'14',mes:'NOV',tipo:'normal',fmt:'T',blocos:'',comp:'',
   txt:'Preparação e planejamento final do Acampamento de Grupo. Conselho de Patrulha + revisão de pendências dos blocos.',special:''},
  {n:'⛺',dia:'20–22',mes:'NOV',tipo:'pernoite',fmt:'PN',blocos:'Vida ao Ar Livre',comp:'',
   txt:'ACAMPAMENTO DE GRUPO: Bloco Vida ao Ar Livre concluído integralmente. Todas as 8 Ações Fixas e mínimo de 5 Variáveis realizadas neste acampamento de 3 dias.',special:'camp'},
  {n:16,dia:'28',mes:'NOV',tipo:'avaliar',fmt:'Av',blocos:'',comp:'',
   txt:'Avaliação do 2S2026: o que funcionou, o que melhorar. Celebração das conquistas. Insumos para o 1S2027.',special:''},
];

var CAL_1S27 = [
  {n:1,dia:'06',mes:'FEV',tipo:'planejar',fmt:'T',blocos:'',comp:'',
   txt:'Abertura do 1S2027: revisão das conquistas do semestre anterior, planejamento do ciclo e distribuição de encargos.',special:''},
  {n:2,dia:'13',mes:'FEV',tipo:'normal',fmt:'T',blocos:'Mudanças Climáticas',comp:'',
   txt:'Bloco 8 — Mudanças Climáticas: ferramentas meteorológicas + debate sobre impactos climáticos.',special:''},
  {n:3,dia:'20',mes:'FEV',tipo:'normal',fmt:'T',blocos:'Mudanças Climáticas',comp:'',
   txt:'Bloco 8 — Mudanças Climáticas: atividade ecológica urbana + projeto de reaproveitamento.',special:''},
  {n:4,dia:'27',mes:'FEV',tipo:'normal',fmt:'T',blocos:'Preservação da Biodiversidade',comp:'',
   txt:'Bloco 9 — Preservação da Biodiversidade: colaboração com ONG ambiental + coleta de dados.',special:''},
  {n:5,dia:'06',mes:'MAR',tipo:'normal',fmt:'T',blocos:'Preservação da Biodiversidade',comp:'',
   txt:'Bloco 9 — Preservação da Biodiversidade: visita à APA (Ação Fixa) + plantio de árvores.',special:''},
  {n:6,dia:'13',mes:'MAR',tipo:'normal',fmt:'T',blocos:'Preservação da Biodiversidade',comp:'',
   txt:'Bloco 9 — Preservação da Biodiversidade: campanha de conscientização ou palestra.',special:''},
  {n:7,dia:'20',mes:'MAR',tipo:'normal',fmt:'T',blocos:'Democracia',comp:'',
   txt:'Bloco 10 — Democracia: debate democrático + atividade sobre participação cidadã.',special:''},
  {n:8,dia:'27',mes:'MAR',tipo:'normal',fmt:'T',blocos:'Democracia',comp:'',
   txt:'Bloco 10 — Democracia: campanha educativa + visita a espaço de representação pública.',special:''},
  {n:9,dia:'03',mes:'ABR',tipo:'normal',fmt:'T',blocos:'Hábitos Saudáveis',comp:'',
   txt:'Bloco 11 — Hábitos Saudáveis: Primeiros Socorros + planejamento de cardápio saudável (Ação Fixa).',special:''},
  {n:10,dia:'10',mes:'ABR',tipo:'normal',fmt:'T',blocos:'Hábitos Saudáveis',comp:'',
   txt:'Bloco 11 — Hábitos Saudáveis: circuito físico (Ação Fixa) + meditação e plano de hábitos.',special:''},
  {n:11,dia:'17',mes:'ABR',tipo:'normal',fmt:'T',blocos:'Hábitos Saudáveis',comp:'',
   txt:'Bloco 11 — Hábitos Saudáveis: atividades físicas variadas + higiene em campo.',special:''},
  {n:12,dia:'24',mes:'ABR',tipo:'leve',fmt:'T',blocos:'',comp:'',
   txt:'Atividade leve de patrulha: Conselho de Patrulha + revisão de pendências dos blocos do ciclo.',special:''},
  {n:13,dia:'01',mes:'MAI',tipo:'normal',fmt:'T',blocos:'',comp:'',
   txt:'Semana de finalização de pendências: ações variáveis que faltam para completar blocos de Paulo e Thauany.',special:''},
  {n:14,dia:'08',mes:'MAI',tipo:'normal',fmt:'T',blocos:'',comp:'',
   txt:'Avaliação individual de progressão + autoavaliação de Paulo e Thauany com a Corte de Honra.',special:''},
  {n:15,dia:'15',mes:'MAI',tipo:'normal',fmt:'T',blocos:'',comp:'',
   txt:'Atividade de patrulha + preparação da Cerimônia de Passagem de Paulo e Thauany.',special:''},
  {n:'🏆',dia:'MAI/',mes:'JUN',tipo:'avaliar',fmt:'Esp',blocos:'',comp:'',
   txt:'CERIMÔNIA DE PASSAGEM — Paulo e Thauany: Reconhecimento de Escoteiro da Pátria + passagem para o Ramo Pioneiro. Data exata a definir conforme conclusão dos 18 blocos.',special:'cerimonia'},
  {n:16,dia:'JUN',mes:'2027',tipo:'avaliar',fmt:'Av',blocos:'',comp:'',
   txt:'Avaliação final do 1S2027 + encerramento do ciclo de 1 ano. Planejamento do 2S2027.',special:''},
];

var DEFAULT_YOUTH = [
  {id:'paulo',   name:'Paulo Soares Semedo dos Santos',             born:'2009-07-28', role:'',             archived:false, color:'#6D1026'},
  {id:'isis',    name:'Isis Oliveira Cavalcante do Nascimento',     born:'2008-08-06', role:'Fora do ciclo', archived:false, color:'#888888'},
  {id:'clara',   name:'Clara Garcia Santos',                        born:'2010-02-15', role:'',             archived:false, color:'#2D6E3E'},
  {id:'thauany', name:'Thauany Nascimento',                         born:'2009-05-24', role:'Monitora',      archived:false, color:'#1B3B6F'},
  {id:'matheus', name:'Matheus Gomes dos Reis',                     born:'2010-09-13', role:'Submonitor',    archived:false, color:'#6A1B9A'},
];

var SEMESTRES_SR = [
  { key: '2s26', titulo: '2º Semestre 2026', periodo: '01/08/2026 → 28/11/2026', cor1: '#6D1026', cor2: '#9C1B3A', origem: true,
    especiais: [
      { icone: '⚡', destaque: '22-23/ago:', texto: 'Enduro Distrital Sênior' },
      { icone: '⚠', destaque: '31/out:', texto: 'Sem atividade (chefia em curso 30/10)' },
      { icone: '⛺', destaque: '20-22/nov:', texto: 'Acampamento de Grupo — Bloco 7 (Vida ao Ar Livre) concluído integralmente' }
    ]
  },
  { key: '1s27', titulo: '1º Semestre 2027', periodo: 'fev/2027 → jun/2027', cor1: '#1B3B6F', cor2: '#2A5298', origem: true,
    especiais: [
      { icone: '🏆', destaque: 'Mai/Jun 2027:', texto: 'Cerimônia de Passagem de Paulo e Thauany — Reconhecimento de Escoteiro da Pátria + passagem para o Ramo Pioneiro' }
    ]
  }
];

var METAS_SR = {
  '2s26': [
    { icone: '⭐', texto: 'Paulo: alcança Azimute (blocos 11→12: Consumo + Comunidade)' },
    { icone: '⭐', texto: 'Thauany: alcança Azimute (blocos 12→15)' }
  ],
  '1s27': [
    { icone: '🏆', texto: 'Paulo: 18 blocos — Reconhecimento de Escoteiro da Pátria' },
    { icone: '🏆', texto: 'Thauany: 18 blocos — Reconhecimento de Escoteiro da Pátria' }
  ]
};
  return { BLOCKS: BLOCKS, EIXOS: EIXOS, CAL_2S26: CAL_2S26, CAL_1S27: CAL_1S27, DEFAULT_YOUTH: DEFAULT_YOUTH, SEMESTRES_SR: SEMESTRES_SR, METAS_SR: METAS_SR };
})();

/* ============================================================
   Almoxarifado — módulo único para todas as seções (Escoteira, Sênior e as próximas).
   Uso: V2_ALMOX.montar({ secao:'escoteira', nomeTropa:'Escoteira', outraTropa:'Sênior', container:'pagina-almoxarifado' })
        V2_ALMOX.abrir()   // recarrega do banco e desenha
   Os itens ficam em /almoxarifado (compartilhados entre seções); as categorias em /almoxarifado/_config/categorias.
   ============================================================ */
window.V2_ALMOX = (function () {
  var BASE = (window.V2_CONFIG || {}).DB_URL + '/almoxarifado';
  var PADRAO = {
    camping:     { label: 'Camping',     emoji: '⛺', color: '#2196F3' },
    jogos:       { label: 'Jogos',       emoji: '🎯', color: '#FF9800' },
    escritorio:  { label: 'Escritório',  emoji: '📎', color: '#9C27B0' },
    distintivos: { label: 'Distintivos', emoji: '🏅', color: '#4CAF50' }
  };
  var EMOJIS_SUG = ['⛺','🎯','📎','🏅','🔦','🧭','🪢','🔪','🍳','🎒','📚','🎵','🩹','🧰','🎨','🔥','🪵','⚽','🧵','💧','🚩','🎪'];

  var NOMES = { escoteira: 'Escoteira', senior: 'Sênior', alcateia: 'Alcateia', cla: 'Clã Pioneiro', diretoria: 'Diretoria' };
  var cfg = null, itens = {}, TIPOS = JSON.parse(JSON.stringify(PADRAO)), chipAtivo = '', modo = 'estoque', emojiFoco = null;

  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  var SEC_ALMOX = [['alcateia','🐺','Alcateia'],['escoteira',window.icoRamo('escoteira'),'Escoteira'],['senior',window.icoRamo('senior'),'Sênior'],['cla',window.icoRamo('cla'),'Clã Pioneiro']];
  function donoDe(it) { return (it && it.tropa) || cfg.secao; }
  // seções (além da dona) que enxergam o item. compartilhado===true sem lista = formato antigo: todas.
  function compartilhadoCom(it) {
    var dono = donoDe(it);
    if (Array.isArray(it.compartilhadoCom)) return it.compartilhadoCom.filter(function (s) { return s !== dono; });
    return it.compartilhado === true ? SEC_ALMOX.map(function (s) { return s[0]; }).filter(function (s) { return s !== dono; }) : [];
  }
  function chipsCompartilhar(dono, marcadas, idGrupo) {
    return '<div class="almo-opt-grupo" id="' + idGrupo + '">' + SEC_ALMOX.map(function (s) {
      if (s[0] === dono) return '<button type="button" class="almo-opt ativo" disabled style="opacity:.65;cursor:default;" title="Seção dona do item">' + s[1] + ' ' + s[2] + ' · dona</button>';
      return '<button type="button" class="almo-opt' + (marcadas.indexOf(s[0]) >= 0 ? ' ativo' : '') + '" data-sec="' + s[0] + '" onclick="this.classList.toggle(\'ativo\')">' + s[1] + ' ' + s[2] + '</button>';
    }).join('') + '</div>';
  }
  // só a seção dona do item e a Diretoria editam; as demais apenas veem
  function podeEditar(it) { return !soLeitura() && (cfg.secao === 'diretoria' || donoDe(it) === cfg.secao); }
  function lerChips(idGrupo) {
    return Array.prototype.map.call(document.querySelectorAll('#' + idGrupo + ' .almo-opt.ativo:not([disabled])'), function (b) { return b.dataset.sec; });
  }
  function rotuloComp() { return cfg.rotuloComp ? esc(cfg.rotuloComp) : 'Compartilhado com ' + esc(cfg.outraTropa); }
  function subComp() { return cfg.subComp ? esc(cfg.subComp) : 'Aparece nos dois painéis'; }
  function soLeitura() { return !!(cfg && cfg.somenteLeitura && cfg.somenteLeitura()); }
  function chaveForm() { return 'almoFormAberto' + (cfg.secao === 'escoteira' ? 'Esc' : cfg.secao === 'senior' ? 'Sr' : cfg.secao); }
  function url(sub) { return urlComAuthFirebase(BASE + (sub || '') + '.json'); }

  function injetarCss() {
    if ($('v2AlmoxCss')) return;
    var p = cfg.padX || 14;
    var st = document.createElement('style');
    st.id = 'v2AlmoxCss';
    st.textContent = [
      '.almo-section{padding:12px ' + p + 'px 0;}',
      '.almo-titulo{font-size:16px;font-weight:800;color:var(--vinho);margin-bottom:2px;}',
      '.almo-sub{font-size:11px;color:var(--muted);margin-bottom:0;}',
      '.almo-form-card{background:var(--card);border-radius:var(--r);box-shadow:var(--shadow);padding:14px;}',
      '.almo-form-titulo{font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;}',
      '.almo-campo-label{font-size:10px;font-weight:700;color:var(--muted);margin-bottom:3px;display:block;}',
      '.almo-input{width:100%;box-sizing:border-box;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card);color:var(--text);outline:none;}',
      '.almo-input:focus{border-color:var(--vinho);}',
      '.almo-form-grid{display:grid;grid-template-columns:1fr 90px;gap:8px;margin:8px 0;}',
      '.almo-select{width:100%;box-sizing:border-box;padding:9px 8px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card);color:var(--text);outline:none;-webkit-appearance:none;appearance:none;cursor:pointer;}',
      '.almo-select:focus{border-color:var(--vinho);}',
      '.almo-opt-grupo{display:flex;flex-wrap:wrap;gap:6px;}',
      '.almo-opt{padding:8px 12px;border:1.5px solid var(--border);border-radius:20px;background:var(--card);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;}',
      '.almo-opt.ativo{border-color:var(--vinho);color:var(--vinho);box-shadow:inset 0 0 0 1px var(--vinho);}',
      '.almo-cat-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:14px;}',
      '.almo-cat-box{background:var(--card);color:var(--text);border-radius:14px;padding:16px;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.4);}',
      '.almo-cat-linha{display:flex;align-items:center;gap:6px;margin:8px 0;}',
      '.almo-cat-linha .almo-cat-emoji{width:54px;flex:none;text-align:center;font-size:18px;padding:7px 4px;}',
      '.almo-cat-linha .almo-cat-nome{flex:1;min-width:0;}',
      '.almo-cat-linha input[type=color]{width:42px;height:38px;padding:2px;border:1.5px solid var(--border);border-radius:10px;background:var(--card);cursor:pointer;flex:none;}',
      '.almo-cat-sug{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px;}',
      '.almo-cat-sug button{border:1.5px solid var(--border);background:var(--card);border-radius:8px;font-size:18px;padding:3px 6px;cursor:pointer;}',
      '.almo-cat-acoes{display:flex;gap:8px;margin-top:14px;}',
      '.almo-cat-acoes button{flex:1;padding:11px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid var(--border);background:var(--card);color:var(--text);}',
      '.almo-cat-acoes button.principal{background:var(--vinho);color:#fff;border-color:var(--vinho);}',
      '.almo-select{color-scheme:light;}',
      '.almo-select option{background:#fff !important;color:#222 !important;}',
      '.almo-toggle-row{display:flex;align-items:center;gap:10px;margin:10px 0;}',
      '.almo-toggle-lbl-wrap{flex:1;}',
      '.almo-toggle-lbl{font-size:12px;font-weight:600;color:var(--text);display:block;}',
      '.almo-toggle-sub{font-size:10px;color:var(--muted);}',
      '.almo-toggle{position:relative;width:40px;height:22px;flex-shrink:0;}',
      '.almo-toggle input{opacity:0;width:0;height:0;position:absolute;}',
      '.almo-toggle-slider{position:absolute;inset:0;background:#ccc;border-radius:22px;transition:.3s;cursor:pointer;}',
      '.almo-toggle input:checked+.almo-toggle-slider{background:var(--vinho);}',
      '.almo-toggle-slider:before{content:\'\';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.3s;}',
      '.almo-toggle input:checked+.almo-toggle-slider:before{transform:translateX(18px);}',
      '.almo-btn-add{width:100%;padding:11px;border:none;border-radius:10px;background:var(--vinho);color:#fff;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;}',
      '.almo-chips-wrap{display:flex;gap:6px;overflow-x:auto;padding:8px ' + p + 'px 2px;scrollbar-width:none;}',
      '.almo-chips-wrap::-webkit-scrollbar{display:none;}',
      '.almo-chip{padding:6px 13px;border-radius:22px;border:1.5px solid var(--border);font-size:11px;font-weight:700;background:var(--card);color:var(--muted);cursor:pointer;white-space:nowrap;flex-shrink:0;}',
      '.almo-chip.ativo{border-color:var(--vinho);color:var(--vinho);}',
      '.almo-busca-wrap-a{position:relative;margin:6px ' + p + 'px 6px;}',
      '.almo-busca-input-a{width:100%;box-sizing:border-box;padding:9px 36px 9px 38px;border:1.5px solid var(--border);border-radius:22px;font-size:13px;background:var(--card);color:var(--text);outline:none;}',
      '.almo-busca-input-a:focus{border-color:var(--vinho);}',
      '.almo-busca-icon-a{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none;}',
      '.almo-busca-clear-a{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:15px;cursor:pointer;color:var(--muted);padding:2px;display:none;}',
      '.almo-chart-card{background:var(--card);border-radius:var(--r);box-shadow:var(--shadow);padding:14px;margin:10px ' + p + 'px 0;}',
      '.almo-chart-titulo{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;}',
      '.almo-chart-row{display:flex;align-items:center;gap:8px;margin-bottom:7px;}',
      '.almo-chart-label{font-size:11px;color:var(--text);width:88px;flex-shrink:0;white-space:nowrap;}',
      '.almo-chart-track{flex:1;height:16px;background:var(--border);border-radius:8px;overflow:hidden;}',
      '.almo-chart-bar{height:100%;border-radius:8px;transition:width .5s ease;min-width:4px;}',
      '.almo-chart-val{font-size:11px;font-weight:800;color:var(--muted);width:24px;text-align:right;flex-shrink:0;}',
      '.almo-lista-wrap{padding:10px ' + p + 'px 0;}',
      '.almo-lista-count{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:7px;}',
      '.almo-item{background:var(--card);border-radius:var(--r);box-shadow:var(--shadow);padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:9px;}',
      '.almo-item-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}',
      '.almo-item-body{flex:1;min-width:0;}',
      '.almo-item-nome{font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.almo-item-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;}',
      '.almo-badge{font-size:9px;font-weight:800;padding:2px 7px;border-radius:9px;white-space:nowrap;}',
      '.almo-badge-comp{background:#E8F5E9;color:#2E7D32;}',
      '.almo-badge-ind{background:#FFF8E1;color:#F57F17;}',
      '.almo-qtd-row{display:flex;align-items:center;gap:4px;flex-shrink:0;}',
      '.almo-qtd-btn{width:26px;height:26px;border:1.5px solid var(--border);border-radius:50%;background:var(--card);color:var(--text);font-size:17px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;}',
      '.almo-qtd-val{font-size:14px;font-weight:800;color:var(--text);min-width:26px;text-align:center;}',
      '.almo-del-btn{background:none;border:none;font-size:15px;cursor:pointer;color:var(--muted);padding:4px;flex-shrink:0;opacity:.7;}',
      '.almo-del-btn:active{opacity:1;}',
      '.almo-vazio{text-align:center;padding:32px ' + p + 'px;color:var(--muted);font-size:12px;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function html() {
    var opts = Object.keys(PADRAO).map(function (id, i) {
      var t = PADRAO[id];
      return '<button type="button" class="almo-opt' + (i === 0 ? ' ativo' : '') + '" data-valor="' + id + '" onclick="V2_ALMOX.h.escolherOpcao(this,\'almoTipo\')">' + t.emoji + ' ' + t.label + '</button>';
    }).join('');
    return '' +
      '<div class="almo-section"><div class="almo-titulo">📦 Almoxarifado</div>' +
      '<div class="almo-sub">' + (cfg.subTitulo ? esc(cfg.subTitulo) : 'Materiais da Tropa ' + esc(cfg.nomeTropa) + '. Itens compartilhados aparecem também no painel ' + esc(cfg.outraTropa) + '.') + '</div></div>' +
      '<div class="almo-chips-wrap" id="almoModo">' +
        '<button class="almo-chip ativo" onclick="V2_ALMOX.h.trocarModo(\'estoque\',this)">📦 Estoque</button>' +
        '<button class="almo-chip" onclick="V2_ALMOX.h.trocarModo(\'desejos\',this)">🛒 Lista de desejos<span id="almoDesejosCnt"></span></button>' +
        '<button class="almo-chip" id="almoBtnCats" style="margin-left:auto;" onclick="V2_ALMOX.h.abrirCategorias()">⚙ Categorias</button>' +
      '</div>' +
      '<div class="almo-section" id="almoFormWrap"><div class="almo-form-card" id="almoFormCard">' +
        '<div class="almo-form-titulo" id="almoFormHead" onclick="V2_ALMOX.h.toggleForm()" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;"><span id="almoFormTitulo">➕ Adicionar item</span><span id="almoFormChev" style="margin-left:auto;color:var(--muted);">▾</span></div>' +
        '<div id="almoFormCorpo">' +
          '<label class="almo-campo-label">Nome do item</label>' +
          '<input type="text" id="almoNome" class="almo-input" placeholder="Ex: Barraca Alpine, Jogo da memória…" autocomplete="off">' +
          '<div class="almo-form-grid"><div>' +
            '<label class="almo-campo-label">Tipo</label>' +
            '<select id="almoTipo" class="almo-select" style="display:none;"></select>' +
            '<div class="almo-opt-grupo" id="almoTipoOpts">' + opts + '</div>' +
          '</div><div>' +
            '<label class="almo-campo-label" id="almoQtdLbl">Qtd.</label>' +
            '<input type="number" id="almoQtd" class="almo-input" value="1" min="0" style="text-align:center;">' +
          '</div></div>' +
          '<div id="almoToggleRow" style="margin:10px 0;"><span class="almo-campo-label">Compartilhar com</span>' + chipsCompartilhar(cfg.secao, [], 'almoCompChips') +
          '<div class="almo-toggle-sub" style="margin-top:4px;">Nenhuma marcada = só ' + esc(cfg.nomeTropa) + '. A Diretoria sempre vê tudo.</div></div>' +
          '<button class="almo-btn-add" id="almoBtnAdd" onclick="V2_ALMOX.h.adicionar()">+ Adicionar item</button>' +
        '</div>' +
      '</div></div>' +
      '<div class="almo-busca-wrap-a"><span class="almo-busca-icon-a">🔍</span>' +
        '<input type="search" id="almoBusca" class="almo-busca-input-a" placeholder="Buscar por nome ou tipo…" autocomplete="off" oninput="V2_ALMOX.h.filtrar()" onsearch="V2_ALMOX.h.filtrar()">' +
        '<button class="almo-busca-clear-a" id="almoBuscaClear" onclick="V2_ALMOX.h.limparBusca()">✕</button></div>' +
      '<div class="almo-chips-wrap" id="almoChips"></div>' +
      '<div class="almo-chart-card" id="almoChartCard"><div class="almo-chart-titulo">Quantidade por tipo</div><div id="almoChart"></div></div>' +
      '<div class="almo-lista-wrap"><div class="almo-lista-count" id="almoCount"></div><div id="almoLista"></div></div>';
  }

  function visiveis(desejo) {
    return Object.keys(itens).filter(function (k) {
      var v = itens[k];
      return v && (cfg.verTudo || donoDe(v) === cfg.secao || compartilhadoCom(v).indexOf(cfg.secao) >= 0) && (v.desejo === true) === !!desejo;
    }).sort(function (a, b) { return (itens[a].nome || '').localeCompare(itens[b].nome || '', 'pt'); }).map(function (k) { return [k, itens[k]]; });
  }

  function aplicarCategorias(cats) {
    if (cats && typeof cats === 'object' && !Array.isArray(cats) && Object.keys(cats).length) {
      var lista = Object.keys(cats).filter(function (id) { return cats[id] && cats[id].nome; })
        .sort(function (a, b) { return (cats[a].ordem || 0) - (cats[b].ordem || 0); });
      if (lista.length) {
        TIPOS = {};
        lista.forEach(function (id) { var c = cats[id]; TIPOS[id] = { label: String(c.nome), emoji: String(c.emoji || '📦'), color: /^#[0-9a-fA-F]{6}$/.test(c.cor || '') ? c.cor : '#888888' }; });
      }
    } else {
      TIPOS = JSON.parse(JSON.stringify(PADRAO));
    }
    if (chipAtivo && !TIPOS[chipAtivo]) chipAtivo = '';
    var chips = $('almoChips');
    if (chips) {
      chips.innerHTML = '<button class="almo-chip ' + (chipAtivo ? '' : 'ativo') + '" onclick="V2_ALMOX.h.selecionarChip(this,\'\')">Todos</button>' +
        Object.keys(TIPOS).map(function (id) { var t = TIPOS[id]; return '<button class="almo-chip ' + (chipAtivo === id ? 'ativo' : '') + '" onclick="V2_ALMOX.h.selecionarChip(this,\'' + id + '\')">' + esc(t.emoji) + ' ' + esc(t.label) + '</button>'; }).join('');
    }
    var sel = $('almoTipo'), grupo = $('almoTipoOpts');
    if (sel && grupo) {
      var ids = Object.keys(TIPOS);
      var atual = ids.indexOf(sel.value) >= 0 ? sel.value : ids[0];
      sel.innerHTML = ids.map(function (id) { return '<option value="' + id + '">' + esc(TIPOS[id].emoji) + ' ' + esc(TIPOS[id].label) + '</option>'; }).join('');
      sel.value = atual;
      grupo.innerHTML = ids.map(function (id) { return '<button type="button" class="almo-opt ' + (id === atual ? 'ativo' : '') + '" data-valor="' + id + '" onclick="V2_ALMOX.h.escolherOpcao(this,\'almoTipo\')">' + esc(TIPOS[id].emoji) + ' ' + esc(TIPOS[id].label) + '</button>'; }).join('');
    }
    var g = $('almoBtnCats'); if (g) g.style.display = soLeitura() ? 'none' : '';
  }

  function renderChart() {
    var el = $('almoChart'); if (!el) return;
    var tots = {}; Object.keys(TIPOS).forEach(function (k) { tots[k] = 0; });
    visiveis(false).forEach(function (p) { var v = p[1]; if (tots[v.tipo] !== undefined) tots[v.tipo] += (v.quantidade || 0); });
    var max = Math.max.apply(null, Object.keys(tots).map(function (k) { return tots[k]; }).concat([1]));
    el.innerHTML = Object.keys(TIPOS).map(function (k) {
      var t = TIPOS[k], val = tots[k], pct = Math.round(val / max * 100);
      return '<div class="almo-chart-row"><div class="almo-chart-label">' + esc(t.emoji) + ' ' + esc(t.label) + '</div>' +
        '<div class="almo-chart-track"><div class="almo-chart-bar" style="width:' + pct + '%;background:' + esc(t.color) + '"></div></div>' +
        '<div class="almo-chart-val">' + val + '</div></div>';
    }).join('');
  }

  function renderLista() {
    var el = $('almoLista'), cnt = $('almoCount'); if (!el) return;
    var q = (($('almoBusca') || {}).value || '').trim().toLowerCase();
    var des = modo === 'desejos', ro = soLeitura();
    var lista = visiveis(des);
    if (chipAtivo) lista = lista.filter(function (p) { return p[1].tipo === chipAtivo; });
    if (q) lista = lista.filter(function (p) { var v = p[1], t = TIPOS[v.tipo]; return (v.nome || '').toLowerCase().indexOf(q) >= 0 || (t && t.label.toLowerCase().indexOf(q) >= 0); });
    if (cnt) cnt.textContent = lista.length + ' ' + (lista.length === 1 ? 'item' : 'itens');
    if (!lista.length) { el.innerHTML = '<div class="almo-vazio">' + (des ? 'A lista de desejos está vazia.' : 'Nenhum item encontrado.') + '</div>'; return; }
    el.innerHTML = lista.map(function (p) {
      var id = p[0], v = p[1];
      var t = TIPOS[v.tipo] || { label: 'Sem categoria', emoji: '📦', color: '#888888' };
      var dono = donoDe(v), cm = compartilhadoCom(v), nomeDe = function (s) { return NOMES[s] || s; };
      var todas = cm.length === SEC_ALMOX.length - 1;
      var comp = '';
      if (cfg.verTudo || dono !== cfg.secao) comp += '<span class="almo-badge almo-badge-ind">📍 ' + esc(nomeDe(dono)) + '</span>';
      if (cm.length && (cfg.verTudo || dono === cfg.secao)) comp += '<span class="almo-badge almo-badge-comp">🔗 ' + (todas ? 'Todas as seções' : esc(cm.map(nomeDe).join(', '))) + '</span>';
      else if (!cm.length) comp += '<span class="almo-badge almo-badge-ind">🔒 Só ' + esc(nomeDe(dono)) + '</span>';
      var roi = !podeEditar(v);
      var qtd = roi ? '<div class="almo-qtd-val" style="margin:0 8px">' + (v.quantidade || 0) + '</div>'
        : '<div class="almo-qtd-row"><button class="almo-qtd-btn" onclick="V2_ALMOX.h.atualizarQtd(\'' + esc(id) + '\',-1)">−</button><div class="almo-qtd-val">' + (v.quantidade || 0) + '</div><button class="almo-qtd-btn" onclick="V2_ALMOX.h.atualizarQtd(\'' + esc(id) + '\',1)">+</button></div>';
      var btns = roi ? '' : (des ? '<button class="almo-del-btn" style="opacity:1" onclick="V2_ALMOX.h.marcarComprado(\'' + esc(id) + '\')" title="Marcar como comprado (vai para o estoque)">✅</button>' : '') +
        '<button class="almo-del-btn" style="opacity:1" onclick="V2_ALMOX.h.editar(\'' + esc(id) + '\')" title="Editar">✏️</button>' +
        '<button class="almo-del-btn" onclick="V2_ALMOX.h.deletar(\'' + esc(id) + '\')" title="Remover">🗑</button>';
      return '<div class="almo-item"><div class="almo-item-dot" style="background:' + esc(t.color) + '"></div><div class="almo-item-body">' +
        '<div class="almo-item-nome">' + esc(v.nome || '') + '</div><div class="almo-item-badges">' +
        '<span class="almo-badge" style="background:' + esc(t.color) + '22;color:' + esc(t.color) + ';">' + esc(t.emoji) + ' ' + esc(t.label) + '</span>' + comp + '</div></div>' + qtd + btns + '</div>';
    }).join('');
  }

  function aplicarEstadoForm() {
    var aberto = false; try { aberto = localStorage.getItem(chaveForm()) === '1'; } catch (e) {}
    var corpo = $('almoFormCorpo'), chev = $('almoFormChev'), head = $('almoFormHead');
    if (corpo) corpo.style.display = aberto ? '' : 'none';
    if (chev) chev.textContent = aberto ? '▾' : '▸';
    if (head) head.style.marginBottom = aberto ? '' : '0';
  }

  function render() {
    aplicarEstadoForm();
    var des = modo === 'desejos';
    var w = $('almoFormWrap'); if (w) w.style.display = soLeitura() ? 'none' : '';
    if ($('almoChartCard')) $('almoChartCard').style.display = des ? 'none' : '';
    if ($('almoFormTitulo')) $('almoFormTitulo').textContent = des ? '🛒 Adicionar à lista de desejos' : '➕ Adicionar item';
    if ($('almoQtdLbl')) $('almoQtdLbl').textContent = des ? 'Qtd. desejada' : 'Qtd.';
    if ($('almoBtnAdd')) $('almoBtnAdd').textContent = des ? '+ Adicionar à lista' : '+ Adicionar item';
    var n = visiveis(true).length;
    if ($('almoDesejosCnt')) $('almoDesejosCnt').textContent = n ? ' (' + n + ')' : '';
    renderChart(); renderLista();
  }

  async function carregar() {
    try {
      var r = await fetch(url());
      var d = await r.json();
      itens = (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
      var c = itens._config; delete itens._config;
      aplicarCategorias(c && c.categorias);
    } catch (e) { itens = {}; }
  }

  async function abrir() {
    if (!cfg) return;
    if (Object.keys(itens).length === 0) { var el = $('almoLista'); if (el) el.innerHTML = '<div class="almo-vazio">Carregando…</div>'; }
    await carregar();
    render();
  }

  function montar(opts) {
    cfg = opts;
    var c = typeof opts.container === 'string' ? $(opts.container) : opts.container;
    injetarCss();
    c.innerHTML = html();
    aplicarCategorias(null);
    render();
  }

  /* ---------- ações (chamadas pelos botões) ---------- */
  var h = {
    escolherOpcao: function (btn, selId) {
      var sel = $(selId); if (sel) sel.value = btn.dataset.valor;
      btn.parentNode.querySelectorAll('.almo-opt').forEach(function (b) { b.classList.toggle('ativo', b === btn); });
    },
    trocarModo: function (m, btn) {
      modo = m;
      document.querySelectorAll('#almoModo .almo-chip').forEach(function (c) { c.classList.remove('ativo'); });
      if (btn) btn.classList.add('ativo');
      render();
    },
    toggleForm: function () {
      var aberto = false; try { aberto = localStorage.getItem(chaveForm()) === '1'; } catch (e) {}
      try { localStorage.setItem(chaveForm(), aberto ? '0' : '1'); } catch (e) {}
      aplicarEstadoForm();
      if (!aberto) { var i = $('almoNome'); if (i) i.focus(); }
    },
    selecionarChip: function (btn, tipo) {
      chipAtivo = tipo;
      document.querySelectorAll('#almoChips .almo-chip').forEach(function (c) { c.classList.remove('ativo'); });
      btn.classList.add('ativo');
      renderLista();
    },
    filtrar: function () {
      var q = ($('almoBusca').value || '').trim(), clr = $('almoBuscaClear');
      if (clr) clr.style.display = q ? '' : 'none';
      renderLista();
    },
    limparBusca: function () { var i = $('almoBusca'); if (i) { i.value = ''; i.focus(); } h.filtrar(); },

    adicionar: async function () {
      if (soLeitura()) return;
      var nome = ($('almoNome').value || '').trim();
      var tipo = $('almoTipo').value;
      var qtd = Math.max(0, parseInt($('almoQtd').value) || 0);
      var comp = lerChips('almoCompChips');
      if (!nome) { $('almoNome').focus(); return; }
      var item = { nome: nome, quantidade: qtd, tipo: tipo, compartilhado: comp.length > 0, compartilhadoCom: comp, tropa: cfg.secao, criadoEm: new Date().toISOString() };
      if (modo === 'desejos') item.desejo = true;
      try {
        var r = await fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        var res = await r.json();
        if (!res || !res.name) { alert('Erro ao salvar no Firebase: ' + (res && res.error ? res.error : 'permissão negada. Verifique as regras do banco de dados.')); return; }
        itens[res.name] = item;
        $('almoNome').value = ''; $('almoQtd').value = '1'; Array.prototype.forEach.call(document.querySelectorAll('#almoCompChips .almo-opt'), function (b) { b.classList.remove('ativo'); });
        render();
      } catch (e) { alert('Erro ao salvar. Verifique a conexão.'); }
    },
    atualizarQtd: async function (id, delta) {
      if (!itens[id] || !podeEditar(itens[id])) return;
      var nova = Math.max(0, (itens[id].quantidade || 0) + delta);
      itens[id].quantidade = nova; render();
      try { await fetch(url('/' + id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantidade: nova }) }); } catch (e) {}
    },
    deletar: async function (id) {
      if (!itens[id] || !podeEditar(itens[id])) return;
      if (!confirm(itens[id] && itens[id].desejo ? 'Remover este item da lista de desejos?' : 'Remover este item do almoxarifado?')) return;
      delete itens[id]; render();
      try { await fetch(url('/' + id), { method: 'DELETE' }); } catch (e) {}
    },
    marcarComprado: async function (id) {
      if (!itens[id] || !podeEditar(itens[id])) return;
      var quando = new Date().toISOString();
      itens[id].desejo = false; itens[id].compradoEm = quando; render();
      try { await fetch(url('/' + id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ desejo: false, compradoEm: quando }) }); } catch (e) {}
    },

    editar: function (id) {
      var it = itens[id];
      if (!it || !podeEditar(it) || $('almoEditOv')) return;
      var des = it.desejo === true;
      var ov = document.createElement('div');
      ov.className = 'almo-cat-ov'; ov.id = 'almoEditOv';
      var tipoAtual = TIPOS[it.tipo] ? it.tipo : '';
      ov.innerHTML = '<div class="almo-cat-box">' +
        '<div class="almo-form-titulo">✏️ Editar ' + (des ? 'item da lista de desejos' : 'item do almoxarifado') + '</div>' +
        '<label class="almo-campo-label">Nome do item</label>' +
        '<input type="text" class="almo-input" id="almoEditNome" maxlength="80" value="' + esc(it.nome || '') + '">' +
        '<label class="almo-campo-label" style="margin-top:10px;">Tipo</label>' +
        '<div class="almo-opt-grupo" id="almoEditTipo">' + Object.keys(TIPOS).map(function (k) { return '<button type="button" class="almo-opt ' + (k === tipoAtual ? 'ativo' : '') + '" data-valor="' + k + '">' + esc(TIPOS[k].emoji) + ' ' + esc(TIPOS[k].label) + '</button>'; }).join('') + '</div>' +
        '<label class="almo-campo-label" style="margin-top:10px;">' + (des ? 'Qtd. desejada' : 'Qtd.') + '</label>' +
        '<input type="number" class="almo-input" id="almoEditQtd" min="0" value="' + (Number(it.quantidade) || 0) + '" style="max-width:110px;text-align:center;">' +
        '<div style="margin:10px 0;"><span class="almo-campo-label">Compartilhar com</span>' + chipsCompartilhar(donoDe(it), compartilhadoCom(it), 'almoEditChips') + '<div class="almo-toggle-sub" style="margin-top:4px;">Nenhuma marcada = só ' + esc(NOMES[donoDe(it)] || donoDe(it)) + '. A Diretoria sempre vê tudo.</div></div>' +
        '<div class="almo-cat-acoes"><button type="button" id="almoEditCancelar">Cancelar</button><button type="button" class="principal" id="almoEditSalvar">Salvar</button></div></div>';
      document.body.appendChild(ov);
      var grupo = ov.querySelector('#almoEditTipo');
      grupo.querySelectorAll('.almo-opt').forEach(function (b) { b.onclick = function () { grupo.querySelectorAll('.almo-opt').forEach(function (x) { x.classList.toggle('ativo', x === b); }); }; });
      var fechar = function () { ov.remove(); };
      ov.querySelector('#almoEditCancelar').onclick = fechar;
      ov.addEventListener('click', function (e) { if (e.target === ov) fechar(); });
      ov.querySelector('#almoEditSalvar').onclick = async function () {
        var nome = ov.querySelector('#almoEditNome').value.trim();
        if (!nome) { ov.querySelector('#almoEditNome').focus(); return; }
        var ativo = grupo.querySelector('.almo-opt.ativo');
        var tipo = ativo ? ativo.dataset.valor : (it.tipo || Object.keys(TIPOS)[0]);
        var quantidade = Math.max(0, parseInt(ov.querySelector('#almoEditQtd').value) || 0);
        var comp = lerChips('almoEditChips');
        var antes = { nome: it.nome, tipo: it.tipo, quantidade: it.quantidade, compartilhado: it.compartilhado, compartilhadoCom: it.compartilhadoCom };
        Object.assign(it, { nome: nome, tipo: tipo, quantidade: quantidade, compartilhado: comp.length > 0, compartilhadoCom: comp });
        render(); fechar();
        try {
          var r = await fetch(url('/' + id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome, tipo: tipo, quantidade: quantidade, compartilhado: comp.length > 0, compartilhadoCom: comp }) });
          var res = await r.json();
          if (!r.ok || (res && res.error)) throw new Error('falhou');
        } catch (e) { Object.assign(it, antes); render(); alert('Não consegui salvar a edição. Verifique a conexão e tente de novo.'); }
      };
    },

    abrirCategorias: function () {
      if (soLeitura() || $('almoCatOv')) return;
      var ov = document.createElement('div');
      ov.className = 'almo-cat-ov'; ov.id = 'almoCatOv';
      ov.innerHTML = '<div class="almo-cat-box"><div class="almo-form-titulo">⚙ Categorias do almoxarifado</div>' +
        '<div class="almo-sub" style="margin-bottom:6px;">Valem para todas as seções. Toque no emoji e escolha abaixo, ou digite o seu.</div>' +
        '<div id="almoCatLinhas"></div><button type="button" class="almo-chip" id="almoCatNova">+ Nova categoria</button>' +
        '<div class="almo-cat-sug" id="almoCatSug"></div>' +
        '<div class="almo-cat-acoes"><button type="button" id="almoCatCancelar">Cancelar</button><button type="button" class="principal" id="almoCatSalvar">Salvar</button></div></div>';
      document.body.appendChild(ov);
      var box = ov.querySelector('#almoCatLinhas');
      var linha = function (id, t) {
        var d = document.createElement('div');
        d.className = 'almo-cat-linha'; d.dataset.id = id || '';
        d.innerHTML = '<input class="almo-input almo-cat-emoji" maxlength="8" value="' + esc(t.emoji) + '" title="Emoji">' +
          '<input class="almo-input almo-cat-nome" maxlength="30" value="' + esc(t.label) + '" placeholder="Nome da categoria">' +
          '<input type="color" class="almo-cat-cor" value="' + esc(t.color) + '" title="Cor">' +
          '<button class="almo-del-btn" type="button" title="Excluir categoria">🗑</button>';
        d.querySelector('.almo-cat-emoji').onfocus = function () { emojiFoco = this; };
        d.querySelector('.almo-del-btn').onclick = function () {
          var usados = id ? Object.keys(itens).filter(function (k) { return itens[k] && itens[k].tipo === id; }).length : 0;
          var msg = usados ? usados + ' item(ns) usam esta categoria e ficarão como "Sem categoria". Excluir mesmo assim?' : 'Excluir esta categoria?';
          if (confirm(msg)) d.remove();
        };
        return d;
      };
      Object.keys(TIPOS).forEach(function (id) { box.appendChild(linha(id, TIPOS[id])); });
      ov.querySelector('#almoCatSug').innerHTML = EMOJIS_SUG.map(function (e) { return '<button type="button">' + e + '</button>'; }).join('');
      ov.querySelectorAll('#almoCatSug button').forEach(function (b) {
        b.onclick = function () {
          var alvo = emojiFoco && ov.contains(emojiFoco) ? emojiFoco : box.querySelector('.almo-cat-emoji');
          if (alvo) alvo.value = b.textContent;
        };
      });
      ov.querySelector('#almoCatNova').onclick = function () {
        var l = linha('', { emoji: '📦', label: '', color: '#607D8B' });
        box.appendChild(l); l.querySelector('.almo-cat-nome').focus(); emojiFoco = l.querySelector('.almo-cat-emoji');
      };
      var fechar = function () { ov.remove(); emojiFoco = null; };
      ov.querySelector('#almoCatCancelar').onclick = fechar;
      ov.addEventListener('click', function (e) { if (e.target === ov) fechar(); });
      ov.querySelector('#almoCatSalvar').onclick = async function () {
        var linhas = Array.prototype.slice.call(box.querySelectorAll('.almo-cat-linha'));
        if (!linhas.length) { alert('Mantenha pelo menos uma categoria.'); return; }
        var novas = {}, usados = {};
        for (var i = 0; i < linhas.length; i++) {
          var l = linhas[i], nome = l.querySelector('.almo-cat-nome').value.trim();
          if (!nome) { alert('Toda categoria precisa de um nome.'); l.querySelector('.almo-cat-nome').focus(); return; }
          var id = l.dataset.id;
          if (!id) {
            var base = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'cat';
            id = base; var n = 2;
            while (usados[id] || TIPOS[id] || Object.keys(itens).some(function (k) { return itens[k] && itens[k].tipo === id; })) id = base + '_' + (n++);
          }
          usados[id] = true;
          novas[id] = { nome: nome, emoji: l.querySelector('.almo-cat-emoji').value.trim() || '📦', cor: l.querySelector('.almo-cat-cor').value, ordem: i + 1 };
        }
        try {
          var r = await fetch(url('/_config/categorias'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novas) });
          var res = await r.json();
          if (!r.ok || (res && res.error)) { alert('Erro ao salvar as categorias: ' + ((res && res.error) || r.status)); return; }
        } catch (e) { alert('Erro ao salvar. Verifique a conexão.'); return; }
        aplicarCategorias(novas); fechar(); render();
      };
    }
  };

  return { montar: montar, abrir: abrir, h: h };
})();


/* ============================================================
   importar-paxtu.js — importa a Ficha Individual (120) do Paxtu.
   O PDF é lido só no navegador: o arquivo nunca é enviado nem guardado.
   Só estes campos seguem adiante: registro, nome, nascimento, ramo,
   seção, patrulha, conquistas, especialidades e progressão.
   CPF, endereço, telefones, responsáveis e sanções são ignorados.
   ============================================================ */
(function (root) {
  'use strict';

  var RAMOS = [
    { id: 'filhotes', nome: 'Filhotes', icone: '🐣' },
    { id: 'lobinho', nome: 'Lobinho', icone: '🐺', ativo: true, ficha: 'lobinho', frame: 'iframeAlcateia', secao: 'alcateia' },
    { id: 'escoteira', nome: 'Escoteiro', icone: window.icoRamo('escoteira'), ativo: true, ficha: 'escoteiro', frame: 'iframeEscoteira', secao: 'escoteira' },
    { id: 'senior', nome: 'Sênior', icone: window.icoRamo('senior'), ativo: true, ficha: 'senior', frame: 'iframeSenior', secao: 'senior' },
    { id: 'pioneiro', nome: 'Pioneiro', icone: window.icoRamo('cla'), ativo: true, ficha: 'pioneiro', frame: 'iframeCla', secao: 'cla' },
    { id: 'dirigente', nome: 'Dirigente', icone: window.icoRamo('diretoria') }
  ];
  var BLOCOS = ['Conquistas', 'Especialidades', 'Progressão', 'Condecorações', 'Cursos de formação', 'Atividades', 'Sanções'];
  var RX_FICHA = /^Ficha Individual \(\d+ \/ \d+\)$/;

  /* ---------- leitura da ficha (sem tela, para poder testar) ---------- */
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function dataIso(s) { var m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(String(s || '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }

  function agruparLinhas(itens) {
    var ord = itens.slice().sort(function (a, b) { return a.pg - b.pg || b.y - a.y || a.x - b.x; }), linhas = [], cur = null;
    ord.forEach(function (i) {
      if (!cur || cur.pg !== i.pg || cur.y - i.y > 2.6) { cur = { pg: i.pg, y: i.y, itens: [] }; linhas.push(cur); }
      cur.itens.push(i);
    });
    linhas.forEach(function (l) {
      l.itens.sort(function (a, b) { return a.x - b.x; });
      l.texto = l.itens.map(function (i) { return i.str; }).join(' ').replace(/\s+/g, ' ').trim();
    });
    return linhas;
  }
  function campo(cab, rotulo) {
    for (var n = 0; n < cab.length; n++) {
      var its = cab[n].itens;
      for (var k = 0; k < its.length; k++) {
        if (its[k].str !== rotulo) continue;
        var v = [];
        for (var j = k + 1; j < its.length && !/:$/.test(its[j].str); j++) v.push(its[j].str);
        return { valor: v.join(' ').trim(), linha: n, item: its[k] };
      }
    }
    return { valor: '', linha: -1 };
  }
  function cartoes(linhas) {
    var res = [], porPg = {};
    linhas.forEach(function (l) { (porPg[l.pg] = porPg[l.pg] || []).push.apply(porPg[l.pg], l.itens); });
    Object.keys(porPg).forEach(function (pg) {
      var its = porPg[pg], xs = [];
      its.forEach(function (i) { if (/^Data:/.test(i.str)) xs.push(i.x); });
      xs.sort(function (a, b) { return a - b; });
      var ini = [];
      xs.forEach(function (x) { if (!ini.length || x - ini[ini.length - 1] > 8) ini.push(x); });
      if (!ini.length) return;
      var cols = ini.map(function () { return []; });
      its.forEach(function (i) {
        var c = 0;
        ini.forEach(function (s, n) { if (s - 4 <= i.x) c = n; });
        cols[c].push(i);
      });
      cols.forEach(function (col) {
        var titulo = [], nivel = null;
        agruparLinhas(col).forEach(function (l) {
          var t = l.texto, m;
          if ((m = /^Nível:\s*(.*)$/.exec(t))) nivel = m[1].trim();
          else if ((m = /^Data:\s*(.*)$/.exec(t))) {
            res.push({ nome: titulo.join(' '), nivel: nivel || null, data: dataIso(m[1]) });
            titulo = []; nivel = null;
          } else titulo.push(t);
        });
      });
    });
    return res;
  }
  // recebe itens { str, x, y, pg } de todas as páginas de um PDF e devolve uma entrada por ficha
  function lerFichas(itens) {
    var fichas = [], cur = null, bloco = null;
    agruparLinhas(itens.filter(function (i) { return String(i.str).trim(); }).map(function (i) {
      return { str: String(i.str).trim(), x: i.x, y: i.y, pg: i.pg };
    })).forEach(function (l) {
      if (RX_FICHA.test(l.texto)) { cur = { cab: [], blocos: {} }; fichas.push(cur); bloco = null; return; }
      if (!cur) return;
      if (BLOCOS.indexOf(l.texto) >= 0) { bloco = l.texto; cur.blocos[bloco] = cur.blocos[bloco] || []; return; }
      if (bloco) cur.blocos[bloco].push(l); else cur.cab.push(l);
    });
    return fichas.map(function (f) {
      var nome = campo(f.cab, 'Nome:'), compl = f.cab[nome.linha + 1];
      var extra = compl && compl.itens.filter(function (i) { return nome.item && i.x < 200 && !/:/.test(i.str); }).map(function (i) { return i.str; }).join(' ');
      var regM = /(\d+)-\d/.exec(campo(f.cab, 'Registro na UEB:').valor), reg = regM ? regM[0] : '';
      return {
        registro: reg, registroBase: regM ? regM[1] : '',
        nome: (nome.valor + (extra && compl.y > nome.item.y - 13 ? ' ' + extra : '')).trim(),
        nasc: dataIso(campo(f.cab, 'Nascido em:').valor), ramo: campo(f.cab, 'Ramo:').valor, funcao: campo(f.cab, 'Função:').valor,
        secao: campo(f.cab, 'Seção:').valor, equipe: campo(f.cab, 'Equipe:').valor,
        conquistas: cartoes(f.blocos['Conquistas'] || []), especialidades: cartoes(f.blocos['Especialidades'] || []), progressao: cartoes(f.blocos['Progressão'] || [])
      };
    }).filter(function (f) { return f.registroBase && f.nome; });
  }
  function idade(nasc) {
    if (!nasc) return null;
    var d = new Date(nasc + 'T00:00:00'), h = new Date(), a = h.getFullYear() - d.getFullYear();
    if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) a--;
    return a;
  }
  function ehJovem(f) { var a = idade(f.nasc); return norm(f.funcao) === 'nao se aplica' && (a === null || a < 22); }
  function nomeBonito(n) {
    var minus = ['de', 'da', 'do', 'das', 'dos', 'e'];
    return String(n).toLowerCase().split(/\s+/).map(function (p, i) {
      return i && minus.indexOf(p) >= 0 ? p : p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }
  function acharJovem(f, est, mapaReg) {
    var porReg = mapaReg[f.registroBase];
    if (porReg && est.jovens.some(function (j) { return j.id === porReg; })) return porReg;
    var alvo = norm(f.nome), toks = alvo.split(' ');
    var exato = est.jovens.filter(function (j) { return norm(j.nome) === alvo; });
    if (exato.length === 1) return exato[0].id;
    var parc = est.jovens.filter(function (j) {
      var t = norm(j.nome).split(' ').filter(Boolean);
      return t.length >= 1 && t.every(function (x) { return toks.indexOf(x) >= 0; }) && (t.length >= 2 || (j.nasc && j.nasc === f.nasc));
    });
    return parc.length === 1 ? parc[0].id : null;
  }
  function alertas(f, ramo) {
    var a = [];
    if (norm(f.ramo) !== norm(ramo.nome)) a.push('A ficha indica ramo ' + (f.ramo || 'não informado') + '.');
    var sec = norm(f.secao);
    if (sec && sec.indexOf(ramo.ficha) < 0) a.push('A ficha indica a seção ' + f.secao + '.');
    return a;
  }

  /* ---------- tela ---------- */
  var E = { ramo: null, arquivos: [], medicas: [], linhas: [], ignorados: 0, erros: [], estado: null, ocupado: false };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function dataBr(iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; }

  function abrir() {
    E = { ramo: null, arquivos: [], medicas: [], linhas: [], ignorados: 0, erros: [], estado: null, ocupado: false };
    $('paxtuModalOv').classList.add('open');
    telaInicio();
  }
  function fechar() { if (E.ocupado) return; E.arquivos = []; E.linhas = []; $('paxtuModalOv').classList.remove('open'); }

  function telaInicio() {
    var h = '<p class="paxtu-txt">Envie as Fichas 120 geradas no Paxtu. O arquivo é lido neste navegador e não é guardado. Antes de gravar, você confere tudo.</p>';
    h += '<div class="campo-label">Ramo destas fichas</div><div class="paxtu-ramos" role="radiogroup" aria-label="Ramo">';
    RAMOS.forEach(function (r) {
      h += '<button type="button" role="radio" aria-checked="' + (E.ramo === r.id) + '" class="paxtu-ramo' + (E.ramo === r.id ? ' sel' : '') + '"' + (r.ativo ? ' onclick="ImportarPaxtu.escolher(\'' + r.id + '\')"' : ' disabled') + '><span>' + r.icone + ' ' + r.nome + '</span>' + (r.ativo ? '' : '<small>Em breve</small>') + '</button>';
    });
    h += '</div><div class="campo-label">Fichas em PDF</div>';
    h += '<label class="paxtu-envio"><input type="file" accept="application/pdf,.pdf" multiple onchange="ImportarPaxtu.arquivos(this.files)"><strong>Escolher PDFs</strong><span>Você pode enviar um ou vários arquivos</span></label>';
    if (E.arquivos.length) h += '<ul class="paxtu-arqs">' + E.arquivos.map(function (a) { return '<li>' + esc(a.name) + '</li>'; }).join('') + '</ul>';
    h += '<div class="campo-label" style="margin-top:14px">Fichas médicas (opcional)</div><label class="paxtu-envio"><input type="file" accept="application/pdf,image/*" multiple onchange="ImportarPaxtu.medicas(this.files)"><strong>Anexar fichas médicas</strong><span>PDF ou foto, uma por jovem. O nome do jovem precisa aparecer no arquivo.</span></label>';
    if (E.medicas.length) h += '<ul class="paxtu-arqs">' + E.medicas.map(function (a) { return '<li>🩺 ' + esc(a.name) + '</li>'; }).join('') + '</ul>';
    h += '<div id="paxtuMsg"></div><button type="button" class="btn-primario paxtu-acao" ' + (E.ramo && E.arquivos.length ? '' : 'disabled') + ' onclick="ImportarPaxtu.ler()">Ler fichas</button>';
    $('paxtuModalBody').innerHTML = h;
  }
  function msg(t, erro) { var m = $('paxtuMsg'); if (m) m.innerHTML = t ? '<div class="paxtu-msg' + (erro ? ' erro' : '') + '" role="status">' + esc(t) + '</div>' : ''; }

  var pdfPronto = null;
  function carregarPdf() {
    if (!pdfPronto) pdfPronto = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = 'Apoio/vendor/pdfjs/pdf.min.js';
      s.onload = function () { root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'Apoio/vendor/pdfjs/pdf.worker.min.js'; ok(root.pdfjsLib); };
      s.onerror = function () { pdfPronto = null; falha(new Error('Não consegui carregar o leitor de PDF.')); };
      document.head.appendChild(s);
    });
    return pdfPronto;
  }
  async function itensDoPdf(lib, arquivo) {
    var doc = await lib.getDocument({ data: await arquivo.arrayBuffer(), disableFontFace: true }).promise, itens = [];
    for (var n = 1; n <= doc.numPages; n++) {
      var pg = await doc.getPage(n), c = await pg.getTextContent();
      c.items.forEach(function (i) { if (i.str) itens.push({ str: i.str, x: i.transform[4], y: i.transform[5], pg: n }); });
    }
    await doc.destroy();
    return itens;
  }
  async function estadoDaSecao(ramo) {
    var f = $(ramo.frame);
    if (!f.getAttribute('src')) f.src = root.V2.pagina({ senior: 'tropa-senior', alcateia: 'alcateia', cla: 'cla-pioneiro' }[ramo.secao] || 'escoteira');
    for (var i = 0; i < 80; i++) {
      var w = f.contentWindow;
      try { if (w && w.paxtuPronto && w.paxtuPronto()) return w; } catch (e) {}
      await root.V2.sleep(250);
    }
    throw new Error('A seção demorou para abrir. Tente de novo.');
  }
  async function ler() {
    if (E.ocupado) return;
    E.ocupado = true; E.erros = []; msg('Lendo as fichas…');
    var ramo = RAMOS.filter(function (r) { return r.id === E.ramo; })[0];
    try {
      var lib = await carregarPdf(), fichas = {};
      for (var i = 0; i < E.arquivos.length; i++) {
        var lidas = [];
        try { lidas = lerFichas(await itensDoPdf(lib, E.arquivos[i])); } catch (e) { console.error(e); }
        if (!lidas.length) E.erros.push(E.arquivos[i].name);
        lidas.forEach(function (f) { fichas[f.registroBase] = f; });
      }
      var todas = Object.keys(fichas).map(function (k) { return fichas[k]; });
      var jovens = todas.filter(ehJovem);
      E.ignorados = todas.length - jovens.length;
      if (!jovens.length) throw new Error(E.erros.length ? 'Não encontrei fichas 120 nesses arquivos.' : 'Não encontrei jovens nessas fichas.');
      var w = await estadoDaSecao(ramo), est = w.paxtuEstado(), reg = await root.V2.paxtuLer(ramo.id, true), mapaReg = {};
      Object.keys(reg).forEach(function (id) { if (reg[id] && reg[id].registro) mapaReg[reg[id].registro] = id; });
      E.estado = est; E.janela = w;
      var usados = {};
      E.linhas = jovens.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }).map(function (f) {
        var id = acharJovem(f, est, mapaReg);
        if (id && usados[id]) id = null;
        if (id) usados[id] = 1;
        var av = alertas(f, ramo), pat = est.patrulhas.filter(function (p) { return norm(p.nome) === norm(f.equipe); })[0];
        return { f: f, id: id, marcado: !(norm(f.ramo) !== norm(ramo.nome) && f.secao && norm(f.secao).indexOf(ramo.ficha) < 0), alertas: av, patrulhaId: pat ? pat.id : null };
      });
      E.ocupado = false;
      telaPrevia();
    } catch (e) { E.ocupado = false; msg(e.message || 'Não foi possível ler os arquivos.', true); }
  }
  function mudancas(l) {
    var novo = !l.id, j = novo ? null : E.estado.jovens.filter(function (x) { return x.id === l.id; })[0], m = [];
    if (novo) m.push('Novo jovem');
    else {
      if (l.f.nasc && j.nasc !== l.f.nasc) m.push('Nascimento: ' + dataBr(j.nasc) + ' → ' + dataBr(l.f.nasc));
      if (l.patrulhaId && j.patrulhaId !== l.patrulhaId) m.push('Patrulha: ' + l.f.equipe);
    }
    if (l.f.equipe && !l.patrulhaId) m.push('Patrulha "' + l.f.equipe + '" não existe no sistema e será ignorada');
    m.push(l.f.especialidades.length + ' especialidades · ' + l.f.conquistas.length + ' conquistas · ' + l.f.progressao.length + ' etapas');
    return m;
  }
  function telaPrevia() {
    var n = E.linhas.filter(function (l) { return l.marcado; }).length, h = '<p class="paxtu-txt"><strong>' + E.linhas.length + ' jovens encontrados.</strong> ' + (E.ignorados ? E.ignorados + ' adultos ignorados. ' : '') + 'Confira antes de gravar.</p>';
    if (E.erros.length) h += '<div class="paxtu-msg erro">Não consegui ler: ' + esc(E.erros.join(', ')) + '</div>';
    h += '<div class="paxtu-lista">';
    E.linhas.forEach(function (l, i) {
      var op = '<option value="">➕ Criar como novo jovem</option>' + E.estado.jovens.map(function (j) {
        var usado = E.linhas.some(function (o, k) { return k !== i && o.id === j.id; });
        return '<option value="' + esc(j.id) + '"' + (l.id === j.id ? ' selected' : '') + (usado ? ' disabled' : '') + '>' + esc(j.nome) + (j.arquivado ? ' (arquivado)' : '') + '</option>';
      }).join('');
      h += '<div class="paxtu-item' + (l.marcado ? '' : ' off') + '"><label class="paxtu-nome"><input type="checkbox" ' + (l.marcado ? 'checked' : '') + ' onchange="ImportarPaxtu.marcar(' + i + ',this.checked)"><span><strong>' + esc(nomeBonito(l.f.nome)) + '</strong><small>Nascimento ' + dataBr(l.f.nasc) + (l.f.equipe ? ' · ' + esc(l.f.equipe) : '') + '</small></span></label>';
      h += '<label class="campo-label" for="paxtuVinc' + i + '">Vincular a</label><select class="campo-input paxtu-sel" id="paxtuVinc' + i + '" onchange="ImportarPaxtu.vincular(' + i + ',this.value)">' + op + '</select>';
      h += '<ul class="paxtu-mud">' + mudancas(l).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      if (l.alertas.length) h += '<div class="paxtu-aviso">⚠️ ' + esc(l.alertas.join(' ')) + '</div>';
      h += '</div>';
    });
    h += '</div><div id="paxtuMsg"></div><div class="paxtu-botoes"><button type="button" class="btn-secundario" onclick="ImportarPaxtu.voltar()">Voltar</button><button type="button" class="btn-primario" id="paxtuGravar" ' + (n ? '' : 'disabled') + ' onclick="ImportarPaxtu.gravar()">Importar ' + n + (n === 1 ? ' jovem' : ' jovens') + '</button></div>';
    $('paxtuModalBody').innerHTML = h;
    var b = $('paxtuModalBody').closest('.lis-modal-box'); if (b) b.scrollTop = 0;
  }
  function registroParaGravar(f) {
    return { registro: f.registroBase, ramo: f.ramo, secao: f.secao, equipe: f.equipe, conquistas: f.conquistas, especialidades: f.especialidades, progressao: f.progressao, importadoEm: new Date().toISOString() };
  }
  async function gravar() {
    if (E.ocupado) return;
    var sel = E.linhas.filter(function (l) { return l.marcado; }), ramo = RAMOS.filter(function (r) { return r.id === E.ramo; })[0];
    if (!sel.length) return;
    E.ocupado = true; var btn = $('paxtuGravar'); if (btn) btn.disabled = true; msg('Gravando…');
    try {
      await root.V2.paxtuTestar(ramo.id); // confere a permissão antes de mexer na seção
      var ids = await E.janela.paxtuAplicar(sel.map(function (l) {
        return { id: l.id, nome: nomeBonito(l.f.nome), nasc: l.f.nasc, patrulhaId: l.patrulhaId };
      }));
      var mapa = {};
      sel.forEach(function (l, i) { if (ids[i]) mapa[ids[i]] = registroParaGravar(l.f); });
      await root.V2.paxtuGravar(ramo.id, mapa);
      if (E.janela.paxtuAtualizar) E.janela.paxtuAtualizar();
      E.ocupado = false; E.arquivos = []; E.linhas = [];
      $('paxtuModalBody').innerHTML = '<div class="paxtu-ok"><div>✓</div><strong>' + sel.length + (sel.length === 1 ? ' jovem importado' : ' jovens importados') + ' em ' + esc(ramo.nome) + '</strong><p>A progressão marcada no sistema não foi alterada.</p><button type="button" class="btn-primario" onclick="ImportarPaxtu.fechar()">Concluir</button></div>';
      if (root.mudarRamo) root.mudarRamo(ramo.secao);
      if (E.medicas.length && root.V2_FICHAMED) { var med = E.medicas; E.medicas = []; var caixa = document.createElement('div'); $('paxtuModalBody').appendChild(caixa); try { root.V2_FICHAMED.lote(med, ramo.secao, (E.janela.paxtuEstado().jovens || []).map(function (j) { return { id: j.id, nome: j.nome }; }), caixa); } catch (e2) { caixa.textContent = 'Não foi possível ler as fichas médicas: ' + e2.message; } }
    } catch (e) {
      console.error(e); E.ocupado = false; if (btn) btn.disabled = false;
      msg(/HTTP (401|403)/.test(String(e.message)) ? 'O banco recusou a gravação. A importação foi cancelada: é preciso liberar a área de dados do Paxtu nas regras do Firebase.' : (e.message || 'Não foi possível gravar.'), true);
    }
  }
  var api = {
    abrir: abrir, fechar: fechar, ler: ler, gravar: gravar, voltar: function () { E.linhas = []; telaInicio(); },
    escolher: function (r) { E.ramo = r; telaInicio(); },
    arquivos: function (l) { E.arquivos = Array.prototype.slice.call(l || []); telaInicio(); },
    medicas: function (l) { E.medicas = Array.prototype.slice.call(l || []); telaInicio(); },
    marcar: function (i, v) { E.linhas[i].marcado = v; telaPrevia(); },
    vincular: function (i, v) { E.linhas[i].id = v || null; telaPrevia(); },
    lerFichas: lerFichas, ehJovem: ehJovem, nomeBonito: nomeBonito, acharJovem: acharJovem, RAMOS: RAMOS
  };
  root.ImportarPaxtu = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   Financeiro — fluxo de caixa básico por seção + caixa do grupo (Diretoria).
   Dados em /financeiro/<secao>: config {saldoInicial}, lanc/<id> (entrada|saida; fixa|variavel), fixas/<id> (modelo mensal), prev/<id> (gasto previsto).
   Uso: V2_FIN.montar({ secao:'escoteira', container:'pagina-financeiro' }); V2_FIN.abrir();
        V2_FIN.montarDiretoria({ container:'fin-box' }); V2_FIN.abrirDiretoria();
   ============================================================ */
(function (root) {
  if (typeof document === 'undefined') return; // no service worker não há tela
  var NOMES = { alcateia: '🐺 Alcateia', escoteira: '⚜️ Escoteira', senior: '🧭 Sênior', cla: '🦉 Clã Pioneiro', grupo: '🏕️ Caixa do grupo' };
  var cfg = null, dir = null, mes = null, dados = {}, formAberto = null;
  var CORES = { ent: '#1b6e3a', sai: '#b3261e', prev: '#a86a00', neutro: '#1B3B6F' };

  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  function url(sub) { return urlComAuthFirebase(window.V2_CONFIG.DB_URL + '/financeiro' + (sub || '') + '.json'); }
  function brl(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function num(t) { t = String(t == null ? '' : t).trim().replace(/[R$\s]/g, ''); if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.'); var n = parseFloat(t); return isFinite(n) ? Math.round(n * 100) / 100 : NaN; }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function mesDe(d) { return String(d || '').slice(0, 7); }
  function nomeMes(m) { var p = m.split('-'), n = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][+p[1] - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' de ' + p[0]; }
  function somaMes(m, n) { var p = m.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function dataBR(d) { var p = String(d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function lista(o) { return Object.keys(o || {}).map(function (k) { var x = o[k]; x.id = k; return x; }); }
  function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---- cálculo de um caixa ----
  function resumo(c, m) {
    var lanc = lista(c && c.lanc), r = { saldoIni: Number(c && c.config && c.config.saldoInicial) || 0, ent: 0, sai: 0, fixas: 0, vars: 0, saldo: 0, prevPend: 0, mesLanc: [] };
    var tot = r.saldoIni;
    lanc.forEach(function (l) {
      var v = Number(l.valor) || 0; tot += l.tipo === 'entrada' ? v : -v;
      if (mesDe(l.data) === m) {
        r.mesLanc.push(l);
        if (l.tipo === 'entrada') r.ent += v; else { r.sai += v; if (l.natureza === 'fixa') r.fixas += v; else r.vars += v; }
      }
    });
    r.saldo = tot;
    lista(c && c.prev).forEach(function (p) { if (!p.pago) r.prevPend += Number(p.valor) || 0; });
    r.projetado = r.saldo - r.prevPend;
    r.mesLanc.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    return r;
  }

  function injetarCss() {
    if ($('v2FinCss')) return;
    var st = document.createElement('style'); st.id = 'v2FinCss';
    st.textContent = '.fin{padding:12px 14px 80px}.fin-mes{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px}.fin-mes b{min-width:150px;text-align:center;font-size:15px}'
      + '.fin-btn{border:1px solid var(--border,#ddd);background:var(--card,#fff);color:inherit;border-radius:10px;padding:8px 12px;font-weight:700;font-size:13px;cursor:pointer}.fin-btn.p{background:#1b6e3a;color:#fff;border-color:#1b6e3a}.fin-btn.r{color:#b3261e}.fin-btn.s{padding:4px 8px;font-size:12px}'
      + '.fin-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px}.fin-card{background:var(--card,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:10px 12px;box-shadow:var(--shadow,none)}.fin-card small{display:block;font-size:11px;color:var(--muted,#666);font-weight:700;text-transform:uppercase;letter-spacing:.3px}.fin-card b{font-size:18px}'
      + '.fin-box{background:var(--card,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:12px;margin-bottom:12px}.fin-box h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}'
      + '.fin-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border,#eee);flex-wrap:wrap}.fin-row:first-of-type{border-top:0}.fin-row .d{flex:1;min-width:140px}.fin-row .d small{display:block;color:var(--muted,#666);font-size:11px}.fin-row .v{font-weight:800;white-space:nowrap}'
      + '.fin-vazio{color:var(--muted,#666);font-size:13px;padding:6px 0}.fin-tag{font-size:10px;font-weight:800;border-radius:8px;padding:1px 6px;background:rgba(27,59,111,.12);margin-left:4px}'
      + '.fin-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100002;display:flex;align-items:center;justify-content:center;padding:16px}.fin-md{background:#fff;color:#1a1a1a;border-radius:14px;padding:18px;width:100%;max-width:360px;box-shadow:0 10px 40px rgba(0,0,0,.35)}.fin-md h4{margin:0 0 10px;font-size:16px}.fin-md input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #bbb;border-radius:8px;font-size:15px;margin-bottom:8px;background:#fff;color:#1a1a1a}.fin-md .ch{display:flex;gap:6px;margin-bottom:8px}.fin-md .ch button{flex:1;padding:9px;border-radius:8px;border:1px solid #bbb;background:#f3f3f3;color:#1a1a1a;font-weight:700;cursor:pointer}.fin-md .ch button.on{background:#1b6e3a;color:#fff;border-color:#1b6e3a}.fin-md .er{color:#b3261e;font-size:12.5px;margin-bottom:8px;display:none}'
      + '.fin-sec summary{cursor:pointer;font-weight:800;list-style:none}.fin-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;margin-top:8px}';
    document.head.appendChild(st);
  }
  function podeEditar(sec) { return !(cfg && cfg.somenteLeitura && cfg.somenteLeitura()) && !(sec !== (cfg && cfg.secao) && !(dir && sec === 'grupo')); }

  // ---- desenho de um caixa ----
  function cartoes(r) {
    function c(t, v, cor) { return '<div class="fin-card"><small>' + t + '</small><b style="color:' + cor + '">' + brl(v) + '</b></div>'; }
    return '<div class="fin-cards">' + c('Saldo atual', r.saldo, r.saldo < 0 ? CORES.sai : CORES.neutro) + c('Entradas do mês', r.ent, CORES.ent) + c('Saídas do mês', r.sai, CORES.sai)
      + c('Contas fixas (mês)', r.fixas, CORES.sai) + c('Contas variáveis (mês)', r.vars, CORES.sai) + c('Gastos previstos', r.prevPend, CORES.prev) + c('Saldo projetado', r.projetado, r.projetado < 0 ? CORES.sai : CORES.neutro) + '</div>';
  }
  function desenharCaixa(sec, c, edit, ctx) {
    var r = resumo(c, mes), h = cartoes(r), a = "V2_FIN._a('" + sec + "',";
    h += '<div class="fin-box"><h3>Lançamentos de ' + esc(nomeMes(mes)) + (edit ? '<span><button class="fin-btn p s" onclick="' + a + "'entrada')\">➕ Entrada</button> <button class=\"fin-btn s\" onclick=\"" + a + "'saida')\">➖ Saída</button></span>" : '') + '</h3>';
    h += r.mesLanc.length ? r.mesLanc.map(function (l) {
      var ent = l.tipo === 'entrada';
      return '<div class="fin-row"><div class="d">' + esc(l.desc) + (ent ? '' : '<span class="fin-tag">' + (l.natureza === 'fixa' ? 'fixa' : 'variável') + '</span>') + '<small>' + dataBR(l.data) + '</small></div><span class="v" style="color:' + (ent ? CORES.ent : CORES.sai) + '">' + (ent ? '+' : '−') + ' ' + brl(l.valor) + '</span>'
        + (edit ? '<button class="fin-btn s" onclick="' + a + "'" + l.tipo + "','" + l.id + '\')">✏️</button><button class="fin-btn s r" onclick="' + a + "'del','" + l.id + '\')">🗑</button>' : '') + '</div>';
    }).join('') : '<div class="fin-vazio">Nenhum lançamento neste mês.</div>';
    h += '</div>';
    var fx = lista(c && c.fixas);
    h += '<div class="fin-box"><h3>Contas fixas (todo mês)' + (edit ? '<span><button class="fin-btn s" onclick="' + a + "'lancarfixas')\">📥 Lançar no mês</button> <button class=\"fin-btn p s\" onclick=\"" + a + "'fixa')\">➕ Nova</button></span>" : '') + '</h3>';
    h += fx.length ? fx.map(function (f) {
      var lancada = !!(c.lanc && c.lanc['fx_' + f.id + '_' + mes]);
      return '<div class="fin-row"><div class="d">' + esc(f.desc) + '<small>' + (f.dia ? 'vence dia ' + f.dia + ' · ' : '') + (lancada ? '✓ lançada neste mês' : 'ainda não lançada') + '</small></div><span class="v">' + brl(f.valor) + '</span>'
        + (edit ? '<button class="fin-btn s" onclick="' + a + "'fixa','" + f.id + '\')">✏️</button><button class="fin-btn s r" onclick="' + a + "'delfixa','" + f.id + '\')">🗑</button>' : '') + '</div>';
    }).join('') : '<div class="fin-vazio">Nenhuma conta fixa cadastrada (mensalidade, aluguel, taxa…).</div>';
    h += '</div>';
    var pv = lista(c && c.prev).sort(function (x, y) { return String(x.data).localeCompare(String(y.data)); });
    h += '<div class="fin-box"><h3>Gastos previstos' + (edit ? '<button class="fin-btn p s" onclick="' + a + "'prev')\">➕ Novo</button>" : '') + '</h3>';
    h += pv.length ? pv.map(function (p) {
      return '<div class="fin-row" style="' + (p.pago ? 'opacity:.55' : '') + '"><div class="d">' + esc(p.desc) + '<small>' + (p.data ? 'previsto para ' + dataBR(p.data) : 'sem data') + (p.pago ? ' · ✓ pago' : '') + '</small></div><span class="v" style="color:' + CORES.prev + '">' + brl(p.valor) + '</span>'
        + (edit ? (p.pago ? '' : '<button class="fin-btn s" onclick="' + a + "'pagar','" + p.id + '\')">✓ Pago</button>') + '<button class="fin-btn s" onclick="' + a + "'prev','" + p.id + '\')">✏️</button><button class="fin-btn s r" onclick="' + a + "'delprev','" + p.id + '\')">🗑</button>' : '') + '</div>';
    }).join('') : '<div class="fin-vazio">Nenhum gasto previsto.</div>';
    h += '</div>';
    if (edit) h += '<div style="text-align:center"><button class="fin-btn s" onclick="' + a + "'saldo')\">Saldo inicial: " + brl(r.saldoIni) + ' — alterar</button></div>';
    return h;
  }
  function seletorMes() {
    return '<div class="fin-mes"><button class="fin-btn" onclick="V2_FIN._m(-1)">‹</button><b>' + esc(nomeMes(mes)) + '</b><button class="fin-btn" onclick="V2_FIN._m(1)">›</button></div>';
  }

  // ---- seção ----
  function desenhar() {
    var box = $(cfg.container); if (!box) return;
    box.innerHTML = '<div class="fin">' + seletorMes() + desenharCaixa(cfg.secao, dados[cfg.secao] || {}, podeEditar(cfg.secao)) + '</div>';
  }
  async function carregar(secs) {
    try {
      await Promise.all(secs.map(async function (s) {
        var r = await fetch(url('/' + s)); if (!r.ok) throw new Error('HTTP ' + r.status); dados[s] = (await r.json()) || {};
      }));
      return true;
    } catch (e) { return false; }
  }
  function erroBox(id) { var b = $(id); if (b) b.innerHTML = '<div class="fin"><div class="fin-box fin-vazio">Não foi possível carregar o financeiro. Confira a conexão e se as regras do banco já foram atualizadas.</div></div>'; }

  // ---- diretoria ----
  var TODAS = ['alcateia', 'escoteira', 'senior', 'cla'];
  function desenharDir() {
    var box = $(dir.container); if (!box) return;
    var totSaldo = 0, totEnt = 0, totSai = 0, totPrev = 0, totProj = 0;
    var ls = TODAS.concat(['grupo']).map(function (s) {
      var r = resumo(dados[s] || {}, mes); totSaldo += r.saldo; totEnt += r.ent; totSai += r.sai; totPrev += r.prevPend; totProj += r.projetado; return { s: s, r: r };
    });
    var h = '<div class="fin">' + seletorMes() + '<div class="fin-box"><h3>🏕️ Grupo como um todo <small style="font-weight:600;color:var(--muted,#666)">(seções + caixa do grupo)</small></h3>'
      + '<div class="fin-cards" style="margin:0"><div class="fin-card"><small>Saldo total</small><b style="color:' + (totSaldo < 0 ? CORES.sai : CORES.neutro) + '">' + brl(totSaldo) + '</b></div><div class="fin-card"><small>Entradas do mês</small><b style="color:' + CORES.ent + '">' + brl(totEnt) + '</b></div><div class="fin-card"><small>Saídas do mês</small><b style="color:' + CORES.sai + '">' + brl(totSai) + '</b></div><div class="fin-card"><small>Gastos previstos</small><b style="color:' + CORES.prev + '">' + brl(totPrev) + '</b></div><div class="fin-card"><small>Saldo projetado</small><b style="color:' + (totProj < 0 ? CORES.sai : CORES.neutro) + '">' + brl(totProj) + '</b></div></div></div>';
    h += '<div class="fin-box"><h3>Por seção</h3>' + ls.map(function (x) {
      return '<div class="fin-row"><div class="d"><b>' + NOMES[x.s] + '</b><small>entradas ' + brl(x.r.ent) + ' · saídas ' + brl(x.r.sai) + ' · previstos ' + brl(x.r.prevPend) + '</small></div><span class="v" style="color:' + (x.r.saldo < 0 ? CORES.sai : CORES.neutro) + '">' + brl(x.r.saldo) + '</span></div>';
    }).join('') + '</div>';
    h += '<div class="fin-box fin-sec"><details open><summary>' + NOMES.grupo + ' — controle do grupo</summary><div style="margin-top:10px">' + desenharCaixa('grupo', dados.grupo || {}, true) + '</div></details></div>';
    h += TODAS.map(function (s) { return '<div class="fin-box fin-sec"><details data-s="' + s + '"><summary>' + NOMES[s] + ' — detalhes (somente leitura)</summary><div style="margin-top:10px">' + desenharCaixa(s, dados[s] || {}, false) + '</div></details></div>'; }).join('');
    box.innerHTML = h + '</div>';
  }

  // ---- formulário ----
  function abrirForm(tipo, o) {
    var f = $('finOv'); if (f) f.remove();
    var tit = { entrada: 'Entrada', saida: 'Saída', fixa: 'Conta fixa', prev: 'Gasto previsto', saldo: 'Saldo inicial' }[tipo];
    var ov = document.createElement('div'); ov.id = 'finOv'; ov.className = 'fin-ov';
    var h = '<div class="fin-md"><h4>' + (o ? 'Editar ' : 'Nova ') + tit.toLowerCase() + '</h4>';
    if (tipo !== 'saldo') h += '<input id="finDesc" placeholder="Descrição" value="' + esc(o && o.desc) + '">';
    h += '<input id="finVal" inputmode="decimal" placeholder="Valor (R$)" value="' + (o ? String(tipo === 'saldo' ? o.valor : o.valor).replace('.', ',') : '') + '">';
    if (tipo === 'entrada' || tipo === 'saida' || tipo === 'prev') h += '<input id="finData" type="date" value="' + esc((o && o.data) || hoje()) + '">';
    if (tipo === 'fixa') h += '<input id="finDia" inputmode="numeric" placeholder="Dia do vencimento (opcional)" value="' + esc(o && o.dia) + '">';
    if (tipo === 'saida') h += '<div class="ch"><button type="button" data-n="variavel" class="' + (!o || o.natureza !== 'fixa' ? 'on' : '') + '">Conta variável</button><button type="button" data-n="fixa" class="' + (o && o.natureza === 'fixa' ? 'on' : '') + '">Conta fixa</button></div>';
    h += '<div class="er" id="finEr"></div><div style="display:flex;gap:8px"><button class="fin-btn" style="flex:1" id="finNao">Cancelar</button><button class="fin-btn p" style="flex:1" id="finOk">Salvar</button></div></div>';
    ov.innerHTML = h; document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    $('finNao').onclick = function () { ov.remove(); };
    Array.prototype.forEach.call(ov.querySelectorAll('.ch button'), function (b) { b.onclick = function () { Array.prototype.forEach.call(ov.querySelectorAll('.ch button'), function (x) { x.classList.toggle('on', x === b); }); }; });
    setTimeout(function () { var i = $('finDesc') || $('finVal'); if (i) i.focus(); }, 50);
    return ov;
  }
  function erro(t) { var e = $('finEr'); if (e) { e.textContent = t; e.style.display = 'block'; } }
  async function gravar(sec, caminho, valor) {
    var r = await fetch(url('/' + sec + caminho), { method: valor === null ? 'DELETE' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: valor === null ? undefined : JSON.stringify(valor) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var p = caminho.split('/').filter(Boolean), c = (dados[sec] = dados[sec] || {});
    for (var i = 0; i < p.length - 1; i++) c = (c[p[i]] = c[p[i]] || {});
    if (valor === null) delete c[p[p.length - 1]]; else c[p[p.length - 1]] = valor;
  }
  function redesenhar() { if (dir) { var abertos = Array.prototype.map.call(document.querySelectorAll('#' + dir.container + ' details[data-s][open]'), function (d) { return d.dataset.s; }); desenharDir(); abertos.forEach(function (s) { var d = document.querySelector('#' + dir.container + ' details[data-s="' + s + '"]'); if (d) d.open = true; }); } else desenhar(); }

  async function acao(sec, tipo, id) {
    var c = dados[sec] || {}, sec_ = sec;
    try {
      if (tipo === 'del') { if (!confirm('Excluir este lançamento?')) return; await gravar(sec, '/lanc/' + id, null); return redesenhar(); }
      if (tipo === 'delfixa') { if (!confirm('Excluir esta conta fixa? Os lançamentos já feitos continuam.')) return; await gravar(sec, '/fixas/' + id, null); return redesenhar(); }
      if (tipo === 'delprev') { if (!confirm('Excluir este gasto previsto?')) return; await gravar(sec, '/prev/' + id, null); return redesenhar(); }
      if (tipo === 'pagar') {
        var p = c.prev[id]; if (!confirm('Marcar como pago e lançar ' + brl(p.valor) + ' como saída?')) return;
        var nid = novoId(); await gravar(sec, '/lanc/' + nid, { tipo: 'saida', natureza: 'variavel', desc: p.desc, valor: p.valor, data: hoje(), deprev: id });
        p.pago = true; await gravar(sec, '/prev/' + id, { desc: p.desc, valor: p.valor, data: p.data || '', pago: true }); return redesenhar();
      }
      if (tipo === 'lancarfixas') {
        var fx = lista(c.fixas).filter(function (f) { return !(c.lanc && c.lanc['fx_' + f.id + '_' + mes]); });
        if (!fx.length) return alert('Todas as contas fixas já foram lançadas neste mês (ou não há contas fixas).');
        if (!confirm('Lançar ' + fx.length + ' conta(s) fixa(s) em ' + nomeMes(mes) + '?')) return;
        for (var i = 0; i < fx.length; i++) { var f = fx[i], dia = ('0' + Math.min(28, parseInt(f.dia, 10) || 1)).slice(-2); await gravar(sec, '/lanc/fx_' + f.id + '_' + mes, { tipo: 'saida', natureza: 'fixa', desc: f.desc, valor: f.valor, data: mes + '-' + dia }); }
        return redesenhar();
      }
      var item = id ? (tipo === 'fixa' ? (c.fixas || {})[id] : tipo === 'prev' ? (c.prev || {})[id] : (c.lanc || {})[id]) : null;
      if (tipo === 'saldo') item = { valor: Number(c.config && c.config.saldoInicial) || 0 };
      var ov = abrirForm(tipo, item);
      $('finOk').onclick = async function () {
        var desc = $('finDesc') ? $('finDesc').value.trim() : '', val = num($('finVal').value);
        if (tipo !== 'saldo' && !desc) return erro('Escreva uma descrição.');
        if (isNaN(val) || (tipo !== 'saldo' && val <= 0)) return erro('Informe um valor válido.');
        var btn = $('finOk'); btn.disabled = true;
        try {
          if (tipo === 'saldo') await gravar(sec, '/config/saldoInicial', val);
          else if (tipo === 'fixa') { var dia = parseInt($('finDia').value, 10); await gravar(sec, '/fixas/' + (id || novoId()), { desc: desc, valor: val, dia: dia > 0 && dia <= 31 ? dia : '' }); }
          else if (tipo === 'prev') await gravar(sec, '/prev/' + (id || novoId()), { desc: desc, valor: val, data: $('finData').value || '', pago: !!(item && item.pago) });
          else {
            var nat = tipo === 'saida' ? (ov.querySelector('.ch button.on') || {}).dataset.n || 'variavel' : null, o = { tipo: tipo, desc: desc, valor: val, data: $('finData').value || hoje() };
            if (nat) o.natureza = nat; await gravar(sec, '/lanc/' + (id || novoId()), o);
          }
          ov.remove(); redesenhar();
        } catch (e) { btn.disabled = false; erro('Não foi possível salvar (sem permissão ou sem conexão).'); }
      };
    } catch (e) { alert('Não foi possível concluir. Verifique a conexão e as permissões.'); }
  }

  root.V2_FIN = {
    montar: function (o) { cfg = o; dir = null; injetarCss(); mes = mes || mesDe(hoje()); },
    abrir: async function () { if (!cfg) return; var b = $(cfg.container); if (b && !b.innerHTML) b.innerHTML = '<div class="fin"><div class="fin-vazio">Carregando…</div></div>'; if (await carregar([cfg.secao])) desenhar(); else erroBox(cfg.container); },
    montarDiretoria: function (o) { dir = o; cfg = null; injetarCss(); mes = mes || mesDe(hoje()); },
    abrirDiretoria: async function () { if (!dir) return; var b = $(dir.container); if (b && !b.innerHTML) b.innerHTML = '<div class="fin"><div class="fin-vazio">Carregando…</div></div>'; if (await carregar(TODAS.concat(['grupo']))) desenharDir(); else erroBox(dir.container); },
    _m: function (n) { mes = somaMes(mes, n); redesenhar(); },
    _a: function (sec, tipo, id) { acao(sec, tipo, id); }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   Funções comuns às seções (Alcateia, Escoteira, Sênior, Clã) — antes repetidas em cada página.
   ============================================================ */
function nomeCurto(n){ const p = String(n || '').trim().split(/\s+/); return p.slice(0,2).join(' '); }
function syncJovens(){
  const ativos = YOUTH_DATA.filter(y => y && !y.archived);
  ativos.forEach((y,i) => { if (!y.color) y.color = COLOR_PALETTE[i % COLOR_PALETTE.length]; });
  JOVENS = ativos.map(y => y.id);
  JNOMES = ativos.map(y => nomeCurto(y.name));
  JCORES = ativos.map(y => y.color);
}
function actJ(){ return JOVENS.map((yid,i) => ({yid:yid,i:i})); }
function renderAllTabs(){ renderAll(); renderCal(); renderCiclo(); renderJovens(); renderBP(); }
async function renovarSessaoV2() {
  if (!firebaseRefreshToken) return;
  const r = await renovarTokenSessao(firebaseRefreshToken);
  if (r) { firebaseAuthToken = r.idToken; firebaseRefreshToken = r.refreshToken; salvarSessao(); }
}
function mostrarModoLeitura(motivo) {
  if ($('bannerLeitura')) return;
  const d = document.createElement('div');
  d.id = 'bannerLeitura';
  d.style.cssText = 'position:sticky;top:0;z-index:9999;background:#E8EEF7;border-bottom:2px solid #1B3B6F;color:#1B3B6F;padding:8px 12px;font-size:12px;text-align:center;';
  d.textContent = '📴 Sem conexão — você pode continuar usando e marcando. As alterações ficam guardadas neste aparelho e são enviadas sozinhas quando o sinal voltar (não feche o app antes disso, nem saia da conta).';
  document.body.insertBefore(d, document.body.firstChild);
}
function sincronizadoOffline(res, recarregar) {
  if (res && res.n) {
    V2.registrarHistorico(V2_NODE, registroLogado, '', 'Enviou ' + res.n + ' alteração(ões) feitas sem internet', res.n);
    alert('✓ ' + res.n + ' alteração(ões) feitas sem internet foram enviadas.');
  }
  if (recarregar) location.reload();
}
function preservarScroll(fn){ const y = window.scrollY; fn(); window.scrollTo(0, y); }
function toggleEixo(id){ eixosAbertos[id] = !(eixosAbertos[id] ?? true); persistir('eixosAbertos', eixosAbertos); aplicarEstadoEixo(id); }
function aplicarEstadoEixo(id){
  const aberto = eixosAbertos[id] ?? true;
  $('bl-' + id).style.display = aberto ? '' : 'none';
  $('chev-' + id).style.transform = aberto ? '' : 'rotate(-90deg)';
}
function getBlock(id){ return BLOCKS.find(b => b.id === id); }
function garantirBloco(id, ...chaves){
  if (!S[id] || typeof S[id] !== 'object') S[id] = {};
  chaves.forEach(k => { if (!S[id][k] || Array.isArray(S[id][k])) S[id][k] = {}; });
  return S[id];
}
function marcarConcluido(bid, yid){
  const novo = concluidoCalc(bid, yid), atual = isConcluido(bid, yid);
  if (novo === atual) return;
  garantirBloco(bid, 'concluded').concluded[yid] = novo ? 1 : 0;
}
function variaveisDe(bl){
  const cust = S[bl.id]?.custom || {};
  return bl.variable.concat(Object.keys(cust).map(cid => ({id:cid, name:cust[cid].name, custom:true})));
}
function isConcluido(bid, yid){ return S[bid]?.concluded?.[yid] === 1; }
function addCustom(bid){
  const inp = $('cust-' + bid); const nome = (inp.value || '').trim();
  if (!nome) return;
  const bl = garantirBloco(bid, 'custom');
  bl.custom['c' + Date.now().toString(36)] = { name: nome };
  inp.value = '';
  saveState(); preservarScroll(renderAll);
}
function removerCustom(bid, cid){
  if (!confirm('Remover esta ação personalizada? As marcações feitas nela também deixam de contar.')) return;
  const bl = garantirBloco(bid, 'custom', 'v');
  delete bl.custom[cid]; delete bl.v[cid];
  YOUTH_DATA.forEach(y => marcarConcluido(bid, y.id));
  saveState(); preservarScroll(renderAll);
}
function tabelaCabecalho(rotulo){
  return `<thead><tr><th class="act-col">${rotulo}</th>${actJ().map(({i}) => `<th>${esc(JNOMES[i].split(' ')[0])}</th>`).join('')}</tr></thead>`;
}
function secaoAcoes(bid, tipo, lista, rotulo, rotuloClasse, estilo){
  if (!lista.length) return '';
  const rows = lista.map(a => {
    const cells = actJ().map(({yid}) => {
      const ok = feito(bid, tipo, a.id, yid);
      const st = estilo ? (ok ? estilo.on : estilo.off) : '';
      return `<td><div class="cb ${ok?'done':'pending'}" ${st?`style="${st}"`:''} onclick="toggle('${bid}','${tipo}','${a.id}','${yid}')">${ok ? (estilo ? '★' : '✓') : '·'}</div></td>`;
    }).join('');
    const icone = tipo === 'f' ? '📌 ' : tipo === 's' ? '🎖 ' : tipo === 'g' ? '🏅 ' : '';
    const x = a.custom ? `<button class="custom-x" title="Remover ação personalizada" onclick="removerCustom('${bid}','${a.id}')">✕</button>` : '';
    return `<tr class="${tipo==='f'?'fixed-row':''}"><td class="act-col">${icone}${esc(a.name)}${a.custom?' <em style="color:#999;font-size:9px;">(personalizada)</em>':''}${x}</td>${cells}</tr>`;
  }).join('');
  return `<div class="actions-section">${rotuloClasse}<div class="actions-table-wrap"><table class="actions-table">${tabelaCabecalho(rotulo)}<tbody>${rows}</tbody></table></div></div>`;
}
function irParaBloco(bid){
  mudarVista('eixo');
  const b = getBlock(bid); eixosAbertos[b.eixo] = true; aplicarEstadoEixo(b.eixo);
  const el = document.querySelector(`details[data-block-id="${bid}"]`);
  if (el) { el.open = true; blocosAbertos[bid] = true; persistir('blocosAbertos', blocosAbertos); el.scrollIntoView({behavior:'smooth', block:'start'}); }
}
function eventosOrdenados(){ return Object.values(eventos).filter(Boolean).sort((a,b) => String(a.dataISO).localeCompare(String(b.dataISO)) || String(a.nome).localeCompare(String(b.nome))); }
function cicloPadrao() {
  return [
    { key: '2s26', titulo: '2º Semestre 2026', ini: '2026-08-01', fim: '2026-11-28', cor1: '#6D1026', cor2: '#9C1B3A', origem: true, semeado: true, blocos: cicloSementes(0), metas: [] },
    { key: '1s27', titulo: '1º Semestre 2027', ini: '2027-02-01', fim: '2027-06-30', cor1: '#1B3B6F', cor2: '#2A5298', origem: true, semeado: true, blocos: cicloSementes(1), metas: [] }
  ];
}
function normalizarCiclo(v) {
  const lista = Array.isArray(v) ? v : Object.values(v || {});
  if (!lista.length) return cicloPadrao();
  return lista.filter(Boolean).map(s => {
    const o = Object.assign({}, s, { blocos: Object.values(s.blocos || {}), metas: Object.values(s.metas || {}).filter(Boolean) });
    if (!o.semeado) { o.semeado = true; const k = ['2s26', '1s27'].indexOf(o.key); if (k >= 0 && !o.blocos.filter(Boolean).length) o.blocos = cicloSementes(k); }
    return o;
  });
}
function cicloSem(key) { return CICLO_SEM.find(s => s.key === key); }
function cicloTogglePicker(k, j) { const key = k + '_' + j; cicloPickerAberto = cicloPickerAberto === key ? null : key; renderCiclo(); }
function cicloSelectBloco(sem, j) {
  const sel = sem.blocos[j] || '', def = sel ? BLOCKS.find(b => b.id === sel) : null, key = sem.key + '_' + j, aberto = cicloPickerAberto === key;
  const cor = def ? (EIXOS[def.eixo] || {}).cor : '';
  const estiloBtn = def ? 'background:' + cor + ';color:#fff;border-color:' + cor + ';' : '';
  let painel = '';
  if (aberto) {
    painel = '<div class="itens-picker-scroll-sr" style="display:block;">' + Object.keys(EIXOS).map(k => {
      const blocos = BLOCKS.filter(b => b.eixo === k).map(b => '<div class="picker-bloco-sr" style="' + (b.id === sel ? 'border-color:' + EIXOS[k].cor + ';' : '') + '"><div class="picker-bloco-head-sr" onclick="cicloTrocarBloco(\'' + sem.key + '\',' + j + ',\'' + b.id + '\')"><span>' + esc(b.name) + '</span>' + (b.id === sel ? '<span class="picker-bloco-count-sr">✓ selecionado</span>' : '') + '</div></div>').join('');
      return '<div class="eixo-picker-header-sr" style="background:' + EIXOS[k].cor + '">' + esc(EIXOS[k].label) + '</div>' + blocos;
    }).join('') + '<div class="picker-bloco-sr" style="cursor:pointer;"><div class="picker-bloco-head-sr" onclick="cicloTrocarBloco(\'' + sem.key + '\',' + j + ',\'\')"><span>— Limpar seleção</span></div></div></div>';
  }
  return '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;"><div style="flex:1;min-width:0;"><button type="button" class="btn-picker-toggle-sr" style="' + estiloBtn + '" onclick="cicloTogglePicker(\'' + sem.key + '\',' + j + ')"><span>' + (def ? esc(def.name) : 'Selecionar bloco') + '</span><span class="chev" style="transform:rotate(' + (aberto ? 180 : 0) + 'deg);' + (def ? 'color:#fff;' : '') + '">▾</span></button>' + painel +
    (def && !aberto ? '<div style="font-size:10px;color:var(--muted);margin:3px 0 0 4px;">' + JOVENS.filter(y => isConcluido(sel, y)).length + ' de ' + JOVENS.length + ' concluíram</div>' : '') + '</div>' +
    '<button class="btn-ic" style="color:#E74C3C;flex-shrink:0;" onclick="cicloRemoverBloco(\'' + sem.key + '\',' + j + ')" title="Remover este bloco">✕</button></div>';
}
function cicloTrocarBloco(k, j, v) { cicloSem(k).blocos[j] = v; cicloPickerAberto = null; saveState(); renderCiclo(); }
function cicloAddBloco(k) { cicloSem(k).blocos.push(''); saveState(); renderCiclo(); }
function cicloRemoverBloco(k, j) { cicloPickerAberto = null; cicloSem(k).blocos.splice(j, 1); saveState(); renderCiclo(); }
function cicloAddMeta(k) {
  const t = document.getElementById('cicloMetaTxt_' + k), ic = document.getElementById('cicloMetaIc_' + k);
  if (!t || !t.value.trim()) return;
  cicloSem(k).metas.push({ icone: ic.value, texto: t.value.trim() }); saveState(); renderCiclo();
}
function cicloRemoverMeta(k, i) { cicloSem(k).metas.splice(i, 1); saveState(); renderCiclo(); }
function cicloToggle(k) { cicloAbertos[k] = !cicloAbertos[k]; renderCiclo(); }
function cicloEditar(k) { cicloEditando = k; cicloAbertos[k] = true; renderCiclo(); }
function cicloCancelar() { cicloEditando = null; renderCiclo(); }
function cicloSalvar(k) {
  const s = cicloSem(k), t = document.getElementById('cicloTit_' + k).value.trim();
  if (!t) { alert('Dê um título ao semestre.'); return; }
  s.titulo = t; s.ini = document.getElementById('cicloIni_' + k).value; s.fim = document.getElementById('cicloFim_' + k).value;
  s.cor1 = document.getElementById('cicloC1_' + k).value; s.cor2 = document.getElementById('cicloC2_' + k).value;
  cicloEditando = null; saveState(); renderCiclo();
}
function cicloNovo() {
  const key = 'sem' + Date.now();
  CICLO_SEM.push({ key, titulo: 'Novo semestre', ini: '', fim: '', cor1: '#1B3B6F', cor2: '#2A5298', origem: false, blocos: [], metas: [] });
  cicloAbertos[key] = true; cicloEditando = key; saveState(); renderCiclo();
}
function cicloRemover(k) {
  if (!confirm('Remover este semestre? Os blocos-foco e metas dele também serão apagados.')) return;
  CICLO_SEM = CICLO_SEM.filter(s => s.key !== k); delete cicloAbertos[k]; saveState(); renderCiclo();
}
function cicloAtualResumo() {
  const hoje = new Date().toISOString().slice(0, 10);
  const s = CICLO_SEM.find(x => x.ini && x.fim && hoje >= x.ini && hoje <= x.fim) || CICLO_SEM.find(x => x.blocos.filter(Boolean).length) || CICLO_SEM[0];
  if (!s) return null;
  return { titulo: s.titulo, periodo: fmtPeriodoCiclo(s), blocos: s.blocos.filter(Boolean).map(id => { const b = BLOCKS.find(x => x.id === id); return b ? { nome: b.name, cor: (EIXOS[b.eixo] || {}).cor || '#666', feitos: JOVENS.filter(y => isConcluido(id, y)).length, total: JOVENS.length } : null; }).filter(Boolean) };
}
function cicloCard(s) {
  if (MODO_VIEW) return cicloCardView(s);
  const aberto = !!cicloAbertos[s.key], ed = cicloEditando === s.key;
  const grad = 'background:linear-gradient(135deg,' + s.cor1 + ',' + s.cor2 + ');';
  let h = '<div class="sem-section" style="margin-top:14px;">';
  if (ed) {
    h += '<div class="sem-header" style="' + grad + 'border-radius:var(--r);"><div style="display:flex;flex-direction:column;gap:8px;">' +
      '<input type="text" class="f-input" id="cicloTit_' + s.key + '" value="' + esc(s.titulo) + '" placeholder="Título do semestre">' +
      '<div style="display:flex;gap:8px;"><input type="date" class="f-input" id="cicloIni_' + s.key + '" value="' + esc(s.ini || '') + '"><input type="date" class="f-input" id="cicloFim_' + s.key + '" value="' + esc(s.fim || '') + '"></div>' +
      '<div style="display:flex;gap:10px;align-items:center;"><label style="font-size:11px;color:#fff;font-weight:700;">Cores do cabeçalho</label><input type="color" id="cicloC1_' + s.key + '" value="' + s.cor1 + '"><input type="color" id="cicloC2_' + s.key + '" value="' + s.cor2 + '"></div>' +
      '<div style="display:flex;gap:8px;"><button class="btn-prim" style="flex:1;padding:8px;font-size:12px;" onclick="cicloSalvar(\'' + s.key + '\')">💾 Salvar</button><button class="btn-sec" style="flex:1;padding:8px;font-size:12px;" onclick="cicloCancelar()">Cancelar</button></div></div></div>';
  } else {
    h += '<div class="sem-header" style="' + grad + 'border-radius:' + (aberto ? 'var(--r) var(--r) 0 0' : 'var(--r)') + ';cursor:pointer;position:relative;" onclick="cicloToggle(\'' + s.key + '\')"><h3 style="padding-right:90px;">📅 ' + esc(s.titulo) + '</h3><div class="period">' + fmtPeriodoCiclo(s) + '</div>' +
      '<button class="btn-ic" style="position:absolute;top:10px;right:' + (s.origem ? '38px' : '66px') + ';background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.35);color:#fff;padding:3px 7px;" onclick="event.stopPropagation();cicloEditar(\'' + s.key + '\')">✏️</button>' +
      (s.origem ? '' : '<button class="btn-ic" style="position:absolute;top:10px;right:38px;background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.35);color:#fff;padding:3px 7px;" onclick="event.stopPropagation();cicloRemover(\'' + s.key + '\')">🗑️</button>') +
      '<span style="position:absolute;top:11px;right:12px;color:#fff;font-size:13px;transform:rotate(' + (aberto ? 180 : 0) + 'deg);">▾</span></div>';
  }
  if (aberto && !ed) {
    const ext = eventosOrdenados().filter(e => e.externa && (!s.ini || e.dataISO >= s.ini) && (!s.fim || e.dataISO <= s.fim));
    const ids = s.blocos.filter(Boolean);
    h += '<div class="sem-body"><div class="section-label" style="margin-bottom:7px;">Blocos-foco do semestre</div><div class="sem-blocks">' +
      s.blocos.map((b, j) => cicloSelectBloco(s, j)).join('') + (s.blocos.length ? '' : '<div style="font-size:11px;color:var(--muted);">Nenhum bloco selecionado ainda.</div>') +
      '<button class="btn-ic" style="width:100%;margin-top:4px;text-align:center;" onclick="cicloAddBloco(\'' + s.key + '\')">+ Adicionar bloco</button></div>' +
      '<div class="sem-special"><div class="section-label" style="margin-bottom:7px;">📍 Atividades externas no calendário</div>' +
      (ext.length ? ext.map(e => '<div class="sem-special-item"><span class="sem-special-icon">📍</span><div><strong>' + new Date(e.dataISO + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ':</strong> ' + esc(e.nome) + '</div></div>').join('') : '<div style="font-size:11px;color:var(--muted);">Nenhuma atividade externa marcada neste período.</div>') + '</div>' +
      '<div class="milestone-box"><div class="section-label" style="margin-bottom:7px;">Metas — ' + esc(s.titulo) + '</div>' +
      s.metas.map((m, i) => '<div class="milestone-item"><span class="milestone-star">' + esc(m.icone) + '</span><div style="flex:1;">' + esc(m.texto) + '</div><button class="btn-ic" style="color:#E74C3C;" onclick="cicloRemoverMeta(\'' + s.key + '\',' + i + ')">🗑️</button></div>').join('') +
      '<div style="display:flex;gap:6px;margin-top:6px;"><select class="f-input" id="cicloMetaIc_' + s.key + '" style="width:64px;"><option>⭐</option><option>🏆</option><option>🎯</option><option>📌</option></select><input type="text" class="f-input" id="cicloMetaTxt_' + s.key + '" placeholder="Nova meta…" style="flex:1;"><button class="btn-prim" style="width:auto;flex:0 0 auto;padding:8px 14px;font-size:12px;" onclick="cicloAddMeta(\'' + s.key + '\')">+</button></div></div>' +
      '<div class="prog-overview"><div class="prog-overview-title">Previsão de blocos ao final de ' + esc(s.titulo) + '</div>' +
      actJ().map(({ yid, i }) => {
        const n = statsJovem(yid).n, ganho = ids.filter(b => !isConcluido(b, yid)).length, exp = Math.min(TOTAL_BLOCOS, n + ganho), et = etapaAtual(exp);
        return '<div class="prog-mini-row"><span class="prog-mini-name">' + esc(JNOMES[i]) + '</span><div class="prog-mini-track"><div class="prog-mini-bar" style="width:' + Math.round(exp / TOTAL_BLOCOS * 100) + '%;background:' + JCORES[i] + ';"></div></div><span class="prog-mini-label" style="color:' + et.c + '">' + exp + '/' + TOTAL_BLOCOS + '</span></div>';
      }).join('') + '</div></div>';
  }
  return h + '</div>';
}
function renderCiclo() {
  const c = document.getElementById('ciclo-content'); if (!c) return;
  c.innerHTML = CICLO_SEM.map(cicloCard).join('') + (MODO_VIEW ? '' : '<button class="btn-sec" style="display:block;width:calc(100% - 24px);margin:16px 12px 24px;padding:12px;font-size:13px;font-weight:700;text-align:center;" onclick="cicloNovo()">+ Adicionar novo semestre</button>');
}
async function iniciarVisualizacao() {
  document.body.classList.add('modo-view');
  let dados = null, falhou = false;
  try { dados = await V2.lerCamposPublicos(V2_NODE, CAMPOS_PUBLICOS_VIEW); } catch (e) { console.error('Visualização: falha ao carregar:', e); falhou = true; }
  YOUTH_DATA = []; syncJovens();
  aplicarDados(dados || {});
  __store = { salvar: () => Promise.reject(new Error('Visualização somente leitura.')), offline: false };
  renderCalView(); renderCiclo();
  if (falhou) { const l = $('cal-lista'); if (l) l.innerHTML = '<div class="cla-vazio">Não foi possível carregar os dados agora. Tente atualizar a página em instantes.</div>'; }
  const btn = document.querySelector('.tab-btn[data-tab="cal"]'); showTab('cal', btn);
}
function renderCalView() {
  const list = $('cal-lista'); if (!list) return; list.innerHTML = '';
  const evs = eventosOrdenados();
  if (!evs.length) { list.innerHTML = '<div class="cla-vazio"><span class="ico">📅</span>Nenhuma atividade cadastrada ainda.</div>'; return; }
  let mesAtual = '';
  evs.forEach(ev => {
    const d = new Date((ev.dataISO || '') + 'T12:00:00'), valida = !isNaN(d), mes = valida ? ev.dataISO.slice(0, 7) : 'sem-data';
    if (mes !== mesAtual) { mesAtual = mes; const h = document.createElement('div'); h.className = 'cal-section-hdr'; h.style.marginTop = list.children.length ? '20px' : ''; h.textContent = '📅 ' + (valida ? d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Sem data'); list.appendChild(h); }
    const fmt = ev.fmt || 'C', itens = Array.isArray(ev.itens) ? ev.itens : Object.values(ev.itens || {});
    const tags = itens.map(b => getBlock(b)).filter(Boolean).map(b => '<span class="bloco-tag">📌 ' + esc(b.name) + '</span>').join('');
    const ex = (CAL_EXTRAS && CAL_EXTRAS[ev.id]) || {}, lk = linkSeguro(ex.link);
    const card = document.createElement('div'); card.className = 'cal-card'; card.style.cssText = 'flex-direction:column;margin:0 12px 8px';
    card.innerHTML = '<div style="display:flex;"><div class="cal-strip strip-normal"><div class="strip-day" style="font-size:18px">' + (valida ? String(d.getDate()).padStart(2, '0') : '--') + '</div><div class="strip-mon">' + (valida ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() : '') + '</div></div>' +
      '<div class="cal-body" style="flex:1;"><div style="font-size:12px;font-weight:800;color:var(--vinho);margin-bottom:3px;">' + (ev.externa ? '<span class="externa-badge-sr">🌍 Externa</span>' : '') + esc(ev.nome) + '</div>' +
      (ev.local ? '<div style="font-size:10px;color:var(--muted);margin-bottom:2px;">📍 ' + esc(ev.local) + '</div>' : '') +
      (ev.responsavel ? '<div style="font-size:10px;color:var(--muted);margin-bottom:4px;">👤 ' + esc(ev.responsavel) + '</div>' : '') +
      '<div class="cal-meta"><span class="fmt-badge fmt-' + (FMT_CLASSE[fmt] || 'T') + '" title="' + esc(FMT_NOME[fmt] || '') + '">' + esc(fmt) + '</span>' + tags + '</div>' +
      (ev.txt ? '<div class="cal-text">' + esc(ev.txt) + '</div>' : '') +
      (lk ? '<a class="evento-link-sr" href="' + esc(lk) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;">🔗 Abrir link</a>' : '') +
      (ex.resposta ? '<div class="cal-text" style="margin-top:6px;border-left:3px solid var(--vinho);padding-left:8px;">💬 ' + esc(ex.resposta) + '</div>' : '') + '</div></div>';
    list.appendChild(card);
  });
}
function cicloCardView(s) {
  const aberto = !!cicloAbertos[s.key];
  let h = '<div class="sem-section" style="margin-top:14px;"><div class="sem-header" style="background:linear-gradient(135deg,' + s.cor1 + ',' + s.cor2 + ');border-radius:' + (aberto ? 'var(--r) var(--r) 0 0' : 'var(--r)') + ';cursor:pointer;position:relative;" onclick="cicloToggle(\'' + s.key + '\')"><h3 style="padding-right:30px;">📅 ' + esc(s.titulo) + '</h3><div class="period">' + fmtPeriodoCiclo(s) + '</div><span style="position:absolute;top:11px;right:12px;color:#fff;font-size:13px;transform:rotate(' + (aberto ? 180 : 0) + 'deg);">▾</span></div>';
  if (aberto) {
    const ext = eventosOrdenados().filter(e => e.externa && (!s.ini || e.dataISO >= s.ini) && (!s.fim || e.dataISO <= s.fim));
    h += '<div class="sem-body"><div class="section-label" style="margin-bottom:7px;">Blocos-foco do semestre</div><div class="sem-blocks">' +
      (s.blocos.filter(Boolean).map(id => { const b = BLOCKS.find(x => x.id === id); if (!b) return ''; const cor = (EIXOS[b.eixo] || {}).cor || '#666'; return '<div class="sem-block-row" style="background:' + cor + '16;border-left:4px solid ' + cor + ';"><span class="sem-block-name">' + esc(b.name) + '</span></div>'; }).join('') || '<div style="font-size:11px;color:var(--muted);">Nenhum bloco definido ainda.</div>') + '</div>' +
      '<div class="sem-special"><div class="section-label" style="margin-bottom:7px;">📍 Atividades externas</div>' +
      (ext.length ? ext.map(e => '<div class="sem-special-item"><span class="sem-special-icon">📍</span><div><strong>' + new Date(e.dataISO + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ':</strong> ' + esc(e.nome) + '</div></div>').join('') : '<div style="font-size:11px;color:var(--muted);">Nenhuma atividade externa marcada neste período.</div>') + '</div>' +
      (s.metas.length ? '<div class="milestone-box"><div class="section-label" style="margin-bottom:7px;">Metas</div>' + s.metas.map(m => '<div class="milestone-item"><span class="milestone-star">' + esc(m.icone) + '</span><div style="flex:1;">' + esc(m.texto) + '</div></div>').join('') + '</div>' : '') + '</div>';
  }
  return h + '</div>';
}
function getExtra(eid){ if (!CAL_EXTRAS[eid]) CAL_EXTRAS[eid] = {link:'', resposta:''}; return CAL_EXTRAS[eid]; }
function salvarLinkEvento(eid, v){ getExtra(eid).link = v; saveState(); }
function salvarRespostaEvento(eid, v){ getExtra(eid).resposta = v; saveState(); }
function toggleAddEvento(forcar){
  const body = $('addEventoBody'); const abrir = forcar === undefined ? body.style.display === 'none' : !!forcar;
  body.style.display = abrir ? 'flex' : 'none';
  $('chevAddEvento').style.transform = abrir ? 'rotate(180deg)' : '';
  if (abrir) renderItensPicker();
}
function toggleItensPicker(){ const p = $('eventoItensPicker'); const abrir = p.style.display === 'none'; p.style.display = abrir ? 'block' : 'none'; $('chevItensPicker').style.transform = abrir ? 'rotate(180deg)' : ''; if (abrir) renderItensPicker(); }
function atualizarResumoItens(){
  $('resumoItensPicker').textContent = itensSelecionados.length ? itensSelecionados.length + ' bloco(s) selecionado(s)' : 'Nenhum bloco selecionado';
}
function renderItensPicker(){
  const p = $('eventoItensPicker');
  p.innerHTML = Object.keys(EIXOS).map(k => `<div class="eixo-picker-header-sr" style="background:${EIXOS[k].cor};color:#fff;">${esc(EIXOS[k].label)}</div>` +
    EIXOS[k].blockIds.map(bid => { const sel = itensSelecionados.includes(bid); return `<div class="item-row-sr" onclick="toggleItemEvento('${bid}')"><div class="item-check-sr ${sel?'sel':''}">${sel?'✓':''}</div><div class="item-text-sr">${esc(getBlock(bid).name)}</div></div>`; }).join('')).join('');
  atualizarResumoItens();
}
function toggleItemEvento(bid){ const i = itensSelecionados.indexOf(bid); if (i >= 0) itensSelecionados.splice(i,1); else itensSelecionados.push(bid); renderItensPicker(); }
function limparFormEvento(){
  ['eventoData','eventoNome','eventoLocal','eventoResp','eventoTxt'].forEach(id => $(id).value = '');
  $('eventoFmt').value = 'C'; $('eventoExterna').checked = false; itensSelecionados = []; eventoEditandoId = null;
  $('btnSalvarEvento').textContent = '+ Adicionar atividade'; $('tituloFormEvento').textContent = '+ Adicionar atividade'; $('btnCancelarEvento').style.display = 'none';
  atualizarResumoItens();
}
function salvarEvento(){
  const dataISO = $('eventoData').value, nome = $('eventoNome').value.trim();
  if (!dataISO || !nome) { alert('Informe a data e o nome da atividade.'); return; }
  const id = eventoEditandoId || ('ev_' + Date.now());
  eventos[id] = { id, dataISO, nome, local: $('eventoLocal').value.trim(), fmt: $('eventoFmt').value, externa: $('eventoExterna').checked,
    itens: itensSelecionados.slice(), responsavel: $('eventoResp').value.trim(), txt: $('eventoTxt').value.trim() };
  limparFormEvento(); toggleAddEvento(false);
  saveState(); renderCal();
}
function editarEvento(id){
  const ev = eventos[id]; if (!ev) return;
  eventoMenuAbertoId = null; eventoEditandoId = id;
  $('eventoData').value = ev.dataISO || ''; $('eventoNome').value = ev.nome || ''; $('eventoLocal').value = ev.local || '';
  $('eventoFmt').value = ev.fmt || 'C'; $('eventoExterna').checked = !!ev.externa; $('eventoResp').value = ev.responsavel || ''; $('eventoTxt').value = ev.txt || '';
  itensSelecionados = Array.isArray(ev.itens) ? ev.itens.slice() : Object.values(ev.itens || {});
  $('btnSalvarEvento').textContent = '💾 Salvar alterações'; $('tituloFormEvento').textContent = '✏️ Editando atividade'; $('btnCancelarEvento').style.display = 'block';
  toggleAddEvento(true); renderCal(); $('cabecalhoAddEvento').scrollIntoView({behavior:'smooth', block:'start'});
}
function cancelarEdicaoEvento(){ limparFormEvento(); toggleAddEvento(false); renderCal(); }
function removerEvento(id){
  const ev = eventos[id]; if (!ev) return;
  if (!confirm('Excluir a atividade "' + ev.nome + '"? A lista de presença dela também será apagada.')) return;
  delete eventos[id]; delete PRESENCA[id]; delete CAL_EXTRAS[id]; eventoMenuAbertoId = null;
  saveState(); renderCal();
}
function toggleEventoMenu(id){ eventoMenuAbertoId = eventoMenuAbertoId === id ? null : id; renderCal(); }
function togglePresenca(eid, yid){
  if (!PRESENCA[eid]) PRESENCA[eid] = {};
  const cur = PRESENCA[eid][yid];
  if (cur === undefined || cur === null) PRESENCA[eid][yid] = 1;
  else if (cur === 1) PRESENCA[eid][yid] = 0;
  else delete PRESENCA[eid][yid];
  saveState(); fillPresencaGrid(eid); renderPresencaSummary();
}
function marcarTodosPresentes(eid, presente){
  if (!PRESENCA[eid]) PRESENCA[eid] = {};
  actJ().forEach(({yid}) => { if (presente) PRESENCA[eid][yid] = 1; else delete PRESENCA[eid][yid]; });
  saveState(); fillPresencaGrid(eid); renderPresencaSummary();
}
function toggleJustificativa(eid, yid){
  let l = JUSTIFICATIVAS_SR[yid]; if (!Array.isArray(l)) l = l ? Object.values(l) : [];
  const i = l.indexOf(eid); if (i >= 0) l.splice(i,1); else l.push(eid);
  JUSTIFICATIVAS_SR[yid] = l; saveState(); fillPresencaGrid(eid); renderPresencaSummary();
}
function justificadas(yid){ const l = JUSTIFICATIVAS_SR[yid]; return Array.isArray(l) ? l : (l ? Object.values(l) : []); }
function toggleResumoPresencas(){ resumoAberto = !resumoAberto; persistir('resumoPresencasAberto', resumoAberto); renderPresencaSummary(); }
function renderCal(){
  const list = $('cal-lista'); list.innerHTML = '';
  const evs = eventosOrdenados();
  if (!evs.length) { list.innerHTML = '<div class="cla-vazio"><span class="ico">📅</span>Nenhuma atividade cadastrada ainda.<br>Use <strong>+ Adicionar atividade</strong> acima.</div>'; renderPresencaSummary(); return; }
  let mesAtual = '', n = 0;
  evs.forEach(ev => {
    n++;
    const d = new Date((ev.dataISO || '') + 'T12:00:00'); const valida = !isNaN(d);
    const mes = valida ? ev.dataISO.slice(0,7) : 'sem-data';
    if (mes !== mesAtual) {
      mesAtual = mes;
      const h = document.createElement('div'); h.className = 'cal-section-hdr'; h.style.marginTop = list.children.length ? '20px' : '';
      h.textContent = '📅 ' + (valida ? d.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}) : 'Sem data');
      list.appendChild(h);
    }
    const eid = ev.id, fmt = ev.fmt || 'C';
    const itens = Array.isArray(ev.itens) ? ev.itens : Object.values(ev.itens || {});
    const card = document.createElement('div'); card.className = 'cal-card'; card.style.flexDirection = 'column'; card.style.margin = '0 12px 8px';
    const tags = itens.map(b => getBlock(b)).filter(Boolean).map(b => `<span class="bloco-tag">📌 ${esc(b.name)}</span>`).join('');
    const menu = eventoMenuAbertoId === eid;
    const main = document.createElement('div'); main.style.cssText = 'display:flex;';
    main.innerHTML = `<div class="cal-strip strip-normal"><div class="strip-idx">${n}</div><div class="strip-day" style="font-size:18px">${valida ? String(d.getDate()).padStart(2,'0') : '--'}</div><div class="strip-mon">${valida ? MESES[d.getMonth()] : ''}</div></div>
      <div class="cal-body" style="flex:1;position:relative;">
        <button class="evento-menu-btn-sr" style="position:absolute;top:0;right:0;" onclick="event.stopPropagation();toggleEventoMenu('${eid}')">⋮</button>
        <div style="padding-right:20px;">
          <div style="font-size:12px;font-weight:800;color:var(--vinho);margin-bottom:3px;">${ev.externa ? '<span class="externa-badge-sr">🌍 Externa</span>' : ''}${esc(ev.nome)}</div>
          ${ev.local ? `<div style="font-size:10px;color:var(--muted);margin-bottom:2px;">📍 ${esc(ev.local)}</div>` : ''}
          ${ev.responsavel ? `<div style="font-size:10px;color:var(--muted);margin-bottom:4px;">👤 ${esc(ev.responsavel)}</div>` : ''}
          <div class="cal-meta"><span class="fmt-badge fmt-${FMT_CLASSE[fmt] || 'T'}" title="${esc(FMT_NOME[fmt] || '')}">${esc(fmt)}</span>${tags}</div>
          ${ev.txt ? `<div class="cal-text">${esc(ev.txt)}</div>` : ''}
        </div>
        ${menu ? `<div class="evento-dropdown-sr" onclick="event.stopPropagation()"><button onclick="editarEvento('${eid}')">✏️ Editar</button><button class="remover" onclick="removerEvento('${eid}')">🗑️ Excluir</button></div>` : ''}
      </div>`;
    card.appendChild(main);
    const det = document.createElement('details'); det.style.cssText = 'border-top:1px solid #F0EDE8;';
    det.innerHTML = `<summary style="cursor:pointer;padding:7px 11px;font-size:10px;font-weight:700;color:var(--muted);list-style:none;display:flex;align-items:center;gap:6px;user-select:none;"><span>📋 Lista de Presença</span><span id="pb-${eid}" style="margin-left:auto;"></span><span style="font-size:9px;">▼</span></summary><div style="padding:6px 11px 10px;"><div style="display:flex;flex-direction:column;gap:2px;" id="pg-${eid}"></div></div>`;
    card.appendChild(det);
    const ex = getExtra(eid), lk = linkSeguro(ex.link);
    const det2 = document.createElement('details'); det2.style.cssText = 'border-top:1px solid #F0EDE8;';
    det2.innerHTML = `<summary style="cursor:pointer;padding:7px 11px;font-size:10px;font-weight:700;color:var(--muted);list-style:none;display:flex;align-items:center;gap:6px;user-select:none;"><span>📎 Link e relato</span><span style="font-size:9px;margin-left:auto;">▼</span></summary>
      <div style="padding:6px 11px 12px;display:flex;flex-direction:column;gap:8px;">
        <div><div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px;">Link (Google Drive, fotos, documento etc.)</div>
          <input type="url" class="extra-link-input" placeholder="https://drive.google.com/..." value="${esc(ex.link || '')}" onchange="salvarLinkEvento('${eid}',this.value)">
          ${lk ? `<a class="evento-link-sr" href="${esc(lk)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:4px;">🔗 Abrir link</a>` : ''}</div>
        <div><div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px;">Como foi a atividade? Relato e observações</div>
          <textarea class="extra-resposta-input" rows="3" placeholder="Escreva aqui..." onchange="salvarRespostaEvento('${eid}',this.value)">${esc(ex.resposta || '')}</textarea></div>
      </div>`;
    card.appendChild(det2);
    list.appendChild(card);
    fillPresencaGrid(eid);
  });
  renderPresencaSummary();
}
function calcAge(bornStr, today){
  const b = new Date(bornStr + 'T12:00:00');
  let y = today.getFullYear() - b.getFullYear(), m = today.getMonth() - b.getMonth(), d = today.getDate() - b.getDate();
  if (d < 0) m--; if (m < 0) { y--; m += 12; }
  return {years:y, months:m};
}
function dataEm(bornStr, anos){ const b = new Date(bornStr + 'T12:00:00'); return new Date(b.getFullYear() + anos, b.getMonth(), b.getDate(), 12); }
function diasAte(d, today){ return Math.ceil((d - today) / 86400000); }
function fmtDate(d){ return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'}); }
function timeStr(days){
  if (days <= 0) return 'Prazo encerrado';
  const tm = Math.floor(days / 30.44), y = Math.floor(tm / 12), m = tm % 12;
  if (y > 0 && m > 0) return `${y} ano${y>1?'s':''} e ${m} mês${m!==1?'es':''}`;
  if (y > 0) return `${y} ano${y>1?'s':''}`;
  if (m > 0) return `${m} mês${m!==1?'es':''}`;
  return `${days} dia${days!==1?'s':''}`;
}
function timeColor(days, maxDays){
  if (days <= 0) return {fg:'#95A5A6', bg:'#F5F5F5', border:'#CCCCCC'};
  const hue = Math.round(Math.min(1, Math.max(0, days / maxDays)) * 120);
  return {fg:`hsl(${hue},65%,38%)`, bg:`hsl(${hue},60%,95%)`, border:`hsl(${hue},55%,60%)`};
}
function hideModal(){ $('youth-modal').classList.remove('open'); }
function verObservacao(yid){
  const y = YOUTH_DATA.find(v => v.id === yid); if (!y) return;
  $('obsModalTitulo').textContent = '📋 ' + y.name; $('obsModalTexto').textContent = y.observacoes || 'Nenhuma observação registrada.';
  $('obsModalOv').classList.add('open');
}
function fecharObservacao(){ $('obsModalOv').classList.remove('open'); }
function archiveYouth(yid){
  const y = YOUTH_DATA.find(v => v.id === yid); if (!y) return;
  if (!confirm('Arquivar ' + y.name + '? O histórico é mantido e dá para restaurar depois.')) return;
  y.archived = true; syncJovens(); saveState(); renderAllTabs();
}
function unarchiveYouth(yid){ const y = YOUTH_DATA.find(v => v.id === yid); if (!y) return; y.archived = false; syncJovens(); saveState(); renderAllTabs(); }
function setMarcoData(yid, k, v){
  if (!INSIGNIA_BP[yid]) INSIGNIA_BP[yid] = {};
  if (v) INSIGNIA_BP[yid][k] = v; else delete INSIGNIA_BP[yid][k];
  saveState(); preservarScroll(renderBP);
}
function toggleMarco(yid, k){
  const atual = INSIGNIA_BP[yid]?.[k];
  setMarcoData(yid, k, atual ? '' : new Date().toISOString().slice(0,10));
}
function salvarNotaExpedicao(yid, v){ if (!INSIGNIA_BP[yid]) INSIGNIA_BP[yid] = {}; INSIGNIA_BP[yid].notaExpedicao = v; saveState(); }
function relatorioTropaSecao() { V2.abrirRelatorioTropa(dadosRelatorioTropa()); }
function onDataSaved(){
  clearTimeout(_savedTimer);
  const el = $('save-status'); if (el) el.textContent = '● Salvando…';
  _savedTimer = setTimeout(() => { const t = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', second:'2-digit'}); if (el) el.textContent = '✓ Salvo automaticamente às ' + t; }, 350);
}
async function saveAll(){
  clearTimeout(_savedTimer); await saveState();
  const t = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const el = $('save-status'); if (el) el.textContent = '✓ Dados salvos às ' + t;
  const btn = $('save-main-btn');
  if (btn) { const o = btn.textContent; btn.textContent = '✓ Salvo!'; btn.style.background = '#27AE60'; btn.style.color = '#fff'; setTimeout(() => { btn.textContent = o; btn.style.background = ''; btn.style.color = ''; }, 2000); }
}
function showTab(id, btn){
  document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === id));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
  persistir('aba', id); window.scrollTo(0, 0);
}
function restaurarUltimaAba(){
  const id = restaurar('aba', 'prog');
  const btn = document.querySelector('.tab-btn[data-tab="' + id + '"]') || document.querySelector('.tab-btn');
  showTab(btn.dataset.tab, btn);
  if (btn.dataset.tab === 'alm') V2_ALMOX.abrir();
  if (btn.dataset.tab === 'fin') V2_FIN.abrir();
}

/* ============================================================
   Navegação em dois níveis das seções: grupos (Seção, Calendário, Gestão) e, abaixo, as abas de cada grupo.
   Não altera a lógica das abas: só mostra/esconde os botões já existentes e acompanha qual está ativo.
   Uso: V2_NAVG({ nav:'nav.tabs', embrulhar:true, grupos:[{ rotulo:'👥 Seção', botoes:['seletor1','seletor2'] }, ...] })
   ============================================================ */
(function (root) {
  if (typeof document === 'undefined') return; // no service worker não há tela
  function css() {
    if (document.getElementById('v2NavgCss')) return;
    var st = document.createElement('style'); st.id = 'v2NavgCss';
    st.textContent = '.grp-wrap{position:sticky;top:0;z-index:200;background:var(--bg,#f0ede8)}.grp-wrap>.tabs{position:static}'
      + '.grp-bar{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:8px;padding:10px 12px 8px;background:var(--bg,#f0ede8)}'
      + '.grp-btn{min-width:0;padding:10px 4px;border-radius:12px;border:1.5px solid var(--border,#ddd);background:var(--card,#fff);color:var(--text,#1a1a1a);font-weight:800;font-size:clamp(11px,3.3vw,13px);line-height:1.15;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;text-align:center;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:background .2s,color .2s,padding .2s}'
      + '.grp-btn.on{background:var(--vinho,#1b6e3a);color:#fff;border-color:var(--vinho,#1b6e3a);box-shadow:0 3px 8px rgba(0,0,0,.2)}'
      + '.grp-oculto{display:none !important}'
      + '.grp-wrap:has(.compacto) .grp-btn,.cabecalho-fixo:has(.compacto) .grp-btn{padding:6px 6px;font-size:12px}.grp-wrap:has(.compacto) .grp-bar,.cabecalho-fixo:has(.compacto) .grp-bar{padding:6px 12px 4px}';
    document.head.appendChild(st);
  }
  root.V2_NAVG = function (o) {
    var nav = typeof o.nav === 'string' ? document.querySelector(o.nav) : o.nav;
    if (!nav || nav.dataset.navg) return;
    nav.dataset.navg = '1'; css();
    var gs = o.grupos.map(function (g) {
      return { rotulo: g.rotulo, botoes: g.botoes.map(function (s) { return typeof s === 'string' ? document.querySelector(s) : s; }).filter(Boolean), ultimo: null, el: null };
    }).filter(function (g) { return g.botoes.length; });
    if (gs.length < 2) return;
    gs.forEach(function (g) { g.botoes.forEach(function (b) { nav.appendChild(b); }); }); // deixa as abas na ordem dos grupos
    var bar = document.createElement('div'); bar.className = 'grp-bar';
    gs.forEach(function (g, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'grp-btn'; g.el = b; var pr = g.rotulo.split(' '); b.innerHTML = '<span style="flex:none">' + pr.shift() + '</span><span style="min-width:0;overflow-wrap:anywhere">' + pr.join(' ').replace('/', '/&#8203;') + '</span>';
      b.onclick = function () {
        var alvo = g.ultimo && g.botoes.indexOf(g.ultimo) >= 0 ? g.ultimo : null;
        if (!alvo) { sem(); alvo = g.botoes.filter(visivel)[0]; com(); }
        if (alvo) alvo.click();
        atualizar();
      };
      bar.appendChild(b);
    });
    var pai = nav.parentNode;
    if (o.embrulhar) { var w = document.createElement('div'); w.className = 'grp-wrap'; pai.insertBefore(w, nav); w.appendChild(bar); w.appendChild(nav); }
    else pai.insertBefore(bar, nav);
    function visivel(b) { return getComputedStyle(b).display !== 'none'; }
    function sem() { gs.forEach(function (g) { g.botoes.forEach(function (b) { b.classList.remove('grp-oculto'); }); }); }
    var ativoG = null;
    function com() { gs.forEach(function (g) { g.botoes.forEach(function (b) { b.classList.toggle('grp-oculto', g !== ativoG); }); }); }
    function atualizar() {
      sem();
      var vis = gs.filter(function (g) { return g.botoes.some(visivel); });
      if (vis.length < 2) { bar.style.display = 'none'; return; }   // ex.: visão dos pais, só calendário e ciclo
      bar.style.display = ''; bar.style.setProperty('--n', vis.length);
      var ativo = null;
      gs.forEach(function (g) { g.botoes.forEach(function (b) { if (b.classList.contains('active')) { ativo = g; g.ultimo = b; } }); });
      ativoG = ativo && vis.indexOf(ativo) >= 0 ? ativo : vis[0];
      gs.forEach(function (g) { g.el.classList.toggle('on', g === ativoG); g.el.style.display = vis.indexOf(g) >= 0 ? '' : 'none'; });
      com();
    }
    var ult = null;
    var mo = new MutationObserver(function () {
      var a = null; gs.forEach(function (g) { g.botoes.forEach(function (b) { if (b.classList.contains('active')) a = b; }); });
      if (a !== ult) { ult = a; atualizar(); }
    });
    gs.forEach(function (g) { g.botoes.forEach(function (b) { mo.observe(b, { attributes: true, attributeFilter: ['class'] }); }); });
    atualizar(); setTimeout(atualizar, 400); setTimeout(atualizar, 1500); window.addEventListener('load', atualizar);
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Ícones dos eixos: o mesmo desenho da Tropa Escoteira em qualquer seção ([data-eixo-ico="hv|ma|pd|sb"]). */
(function (root) {
  if (typeof document === 'undefined') return; // no service worker não há tela
  function preencher() {
    if (!root.V2_BLOCOS || !root.V2_BLOCOS.EIXOS) return;
    if (!document.getElementById('v2EixoIcoCss')) { var st = document.createElement('style'); st.id = 'v2EixoIcoCss'; st.textContent = '.eixo-icone-mini{width:24px;height:24px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}.eixo-icone-mini svg{width:62%;height:62%}'; document.head.appendChild(st); }
    Array.prototype.forEach.call(document.querySelectorAll('[data-eixo-ico]'), function (el) {
      var e = root.V2_BLOCOS.EIXOS.filter(function (x) { return x.id === el.getAttribute('data-eixo-ico'); })[0];
      if (e && !el.firstChild) { el.style.background = e.cor; el.innerHTML = e.icone; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preencher); else preencher();
  window.addEventListener('load', preencher);
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   Fichas de pessoas — nome social, data de promessa, contato de emergência (jovens e chefes) + avisos de aniversário/promessa.
   Dados em /pessoas/<secao>/<idJovem> e /pessoas/chefes/<uid>. Uso por seção:
     V2_PESSOAS.montar({ secao:'escoteira', container:'pagina-fichas', jovens:()=>paxtuEstado().jovens, aplicarNome:(id,nome)=>{...} }); V2_PESSOAS.abrir();
   Diretoria: V2_PESSOAS.montarDiretoria({ container:'fichas-box' }); V2_PESSOAS.abrirDiretoria();
   ============================================================ */
(function (root) {
  if (typeof document === 'undefined') return;
  var NOMES_SEC = { alcateia: '🐺 Alcateia', escoteira: '⚜️ Tropa Escoteira', senior: '🧭 Tropa Sênior', cla: '🦉 Clã Pioneiro', diretoria: '🏛️ Diretoria' };
  var SECS = ['alcateia', 'escoteira', 'senior', 'cla'];
  var cfg = null, dir = null, dados = {}, chefesEq = {}, filtro = '';

  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  function url(sub) { return urlComAuthFirebase(root.V2_CONFIG.DB_URL + '/pessoas' + (sub || '') + '.json'); }
  function dataBR(d) { var p = String(d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function sessao() { try { return JSON.parse(localStorage.getItem('chefeSessao') || 'null') || {}; } catch (e) { return {}; } }
  function ehDir() { var s = sessao(); return s.admin === true || s.tropa === 'diretoria' || s.tropa2 === 'diretoria'; }
  function nomeTela(p, nome) { return (p && p.nomeSocial) || nome || ''; }
  function temSobrenome(n) { return String(n || '').trim().split(/\s+/).filter(Boolean).length >= 2; }

  // ---- datas ----
  function pad(n) { return ('0' + n).slice(-2); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // a atividade é sempre no sábado: a semana vai de domingo a sábado e o aviso vale até o sábado
  function semanaAtual(ref) { var r = ref || new Date(), d = new Date(r.getFullYear(), r.getMonth(), r.getDate()), ini = new Date(d); ini.setDate(d.getDate() - d.getDay()); var fim = new Date(ini); fim.setDate(ini.getDate() + 6); return { ini: ini, fim: fim }; }
  function ocorrencia(dataIso, ano) { var p = String(dataIso || '').split('-'); if (p.length !== 3) return null; var m = +p[1] - 1, dia = +p[2]; if (m === 1 && dia === 29 && !(ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0))) dia = 28; return new Date(ano, m, dia); }
  function anosEntre(dataIso, ano) { return ano - +String(dataIso).split('-')[0]; }
  function emSemana(dataIso, sem) {
    if (!dataIso) return null;
    var a = sem.ini.getFullYear(), cand = [ocorrencia(dataIso, a), ocorrencia(dataIso, a + 1)];
    for (var i = 0; i < cand.length; i++) if (cand[i] && cand[i] >= sem.ini && cand[i] <= sem.fim) return cand[i];
    return null;
  }
  function tempoDesde(dataIso) {
    if (!dataIso) return '';
    var p = dataIso.split('-'), h = new Date(), m = (h.getFullYear() - +p[0]) * 12 + (h.getMonth() - (+p[1] - 1)) - (h.getDate() < +p[2] ? 1 : 0);
    if (m < 0) return '';
    var a = Math.floor(m / 12), mm = m % 12; return (a ? a + (a === 1 ? ' ano' : ' anos') : '') + (a && mm ? ' e ' : '') + (mm || !a ? mm + (mm === 1 ? ' mês' : ' meses') : '');
  }
  // lista de avisos da semana para um conjunto de pessoas [{nome, nasc, promessa, tipo}]
  function avisos(pessoas, ref) {
    var sem = semanaAtual(ref), out = [];
    pessoas.forEach(function (p) {
      var d = emSemana(p.nasc, sem);
      if (d) out.push({ quando: d, tipo: 'aniv', nome: p.nome, texto: '🎂 ' + p.nome + ' faz ' + anosEntre(p.nasc, d.getFullYear()) + ' anos' });
      var pr = emSemana(p.promessa, sem);
      if (pr) { var a = anosEntre(p.promessa, pr.getFullYear()); if (a > 0) out.push({ quando: pr, tipo: 'prom', nome: p.nome, texto: '⭐ ' + p.nome + ': ' + a + (a === 1 ? ' ano' : ' anos') + ' de promessa — entregar a estrela' }); }
    });
    out.sort(function (x, y) { return x.quando - y.quando; });
    return out;
  }
  function cardAvisos(lista, tit) {
    if (!lista.length) return '<div class="v2p-aviso vazio">' + tit + ': nenhum aniversário ou estrela de promessa nesta semana.</div>';
    var dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    return '<div class="v2p-aviso"><b>' + tit + '</b> <span class="mini">(avise até sábado)</span>' + lista.map(function (a) { return '<div>' + esc(a.texto) + ' <span class="mini">· ' + dias[a.quando.getDay()] + ' ' + pad(a.quando.getDate()) + '/' + pad(a.quando.getMonth() + 1) + '</span></div>'; }).join('') + '</div>';
  }

  function injetarCss() {
    if ($('v2pCss')) return;
    var st = document.createElement('style'); st.id = 'v2pCss';
    st.textContent = '.v2p{padding:12px 14px 80px}.v2p .mini{font-size:11px;opacity:.7}.v2p-aviso{background:rgba(255,193,7,.15);border:1px solid rgba(255,193,7,.5);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.6}.v2p-aviso.vazio{background:transparent;border-color:var(--border,#ddd);opacity:.8}'
      + '.v2p-busca{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border,#ddd);border-radius:10px;font-size:14px;margin-bottom:10px;background:var(--card,#fff);color:inherit}'
      + '.v2p-row{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--card,#fff);border:1px solid var(--border,#ddd);border-radius:12px;margin-bottom:6px;cursor:pointer}.v2p-row b{flex:1;min-width:0}.v2p-tag{font-size:11px;border-radius:8px;padding:2px 7px;background:rgba(128,128,128,.18);white-space:nowrap}.v2p-tag.ok{background:rgba(27,110,58,.2)}.v2p-tag.falta{background:rgba(179,38,30,.18)}'
      + '.v2p-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100030;display:flex;align-items:center;justify-content:center;padding:14px}.v2p-box{background:var(--card,#fff);color:var(--text,#1a1a1a);border-radius:14px;padding:18px 16px;width:100%;max-width:460px;max-height:92vh;overflow:auto}'
      + '.v2p-box label{display:block;font-size:11px;font-weight:700;margin:10px 0 3px;opacity:.75;text-transform:uppercase}.v2p-box input,.v2p-box textarea,.v2p-box select{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border,#ccc);border-radius:9px;font-size:15px;background:transparent;color:inherit}'
      + '.v2p-bt{border:1px solid var(--border,#ddd);background:var(--card,#fff);color:inherit;border-radius:10px;padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer}.v2p-bt.p{background:#1b6e3a;color:#fff;border-color:#1b6e3a}'
      + '.v2p-sec{margin:14px 0 6px;font-weight:800;font-size:14px}.v2p-tb{width:100%;border-collapse:collapse;font-size:12.5px}.v2p-tb td,.v2p-tb th{padding:6px 4px;border-bottom:1px solid var(--border,#ddd);text-align:left;vertical-align:top}';
    document.head.appendChild(st);
  }

  async function carregarSecao(sec) { try { var r = await fetch(url('/' + sec)); var d = await r.json(); dados[sec] = d && !d.error ? d : {}; } catch (e) { dados[sec] = dados[sec] || {}; } return dados[sec]; }
  async function gravar(sec, id, obj) {
    var r = await fetch(url('/' + sec + '/' + id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, obj, { atualizadoEm: new Date().toISOString() })) });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Sem permissão para gravar. Peça ao admin para atualizar as regras do banco.' : 'Falha ao gravar (' + r.status + ').');
    dados[sec] = dados[sec] || {}; dados[sec][id] = Object.assign(dados[sec][id] || {}, obj);
  }

  // ---- formulário (jovem ou chefe) ----
  function formulario(o) {
    // o: { sec, id, nome, nasc, p, chefe, podeNasc, aplicarNome, aoSalvar }
    var p = o.p || {}, ov = document.createElement('div'); ov.className = 'v2p-ov';
    var med = !o.chefe && root.V2_FICHAMED ? '<div class="v2p-sec">🩺 Ficha médica</div><div id="v2pMed"></div>' : '';
    ov.innerHTML = '<div class="v2p-box"><div style="font-size:16px;font-weight:800">' + (o.chefe ? '👤 ' : '🧒 ') + esc(nomeTela(p, o.nome)) + '</div>'
      + (p.nomeSocial ? '<div class="mini" style="font-size:11px;opacity:.7">Nome: ' + esc(p.nomeCompleto || o.nome) + '</div>' : '')
      + '<label>Nome social (opcional — se preenchido, é o nome que aparece no sistema)</label><input id="v2pSocial" value="' + esc(p.nomeSocial || '') + '" autocomplete="off">'
      + '<label>Data de nascimento</label><input id="v2pNasc" type="date" value="' + esc(o.nasc || p.nasc || '') + '"' + (o.podeNasc === false ? ' disabled' : '') + '>'
      + '<label>Data de promessa</label><input id="v2pProm" type="date" value="' + esc(p.promessa || '') + '"><div class="mini" id="v2pTempo">' + (p.promessa ? 'Tempo de promessa: ' + tempoDesde(p.promessa) : '') + '</div>'
      + '<div class="v2p-sec">🚑 Contato de emergência</div><label>Nome</label><input id="v2pEN" value="' + esc(p.emergNome || '') + '" autocomplete="off"><label>Telefone</label><input id="v2pET" inputmode="tel" value="' + esc(p.emergTel || '') + '"><label>Parentesco</label><input id="v2pER" value="' + esc(p.emergRel || '') + '" autocomplete="off">'
      + med + '<div id="v2pErro" style="display:none;color:#b3261e;font-size:12.5px;margin-top:8px"></div><div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="v2p-bt" id="v2pNao" style="flex:1">Cancelar</button><button type="button" class="v2p-bt p" id="v2pSim" style="flex:1">Salvar</button></div></div>';
    document.body.appendChild(ov);
    $('v2pProm').addEventListener('input', function () { $('v2pTempo').textContent = this.value ? 'Tempo de promessa: ' + tempoDesde(this.value) : ''; });
    $('v2pNao').onclick = function () { ov.remove(); };
    if (med && root.V2_FICHAMED) root.V2_FICHAMED.montar($('v2pMed'), { sec: o.sec, id: o.id, nome: o.nome, p: p, recarregar: o.aoSalvar });
    $('v2pSim').onclick = async function () {
      var b = this, er = $('v2pErro'); er.style.display = 'none';
      var social = $('v2pSocial').value.trim(), obj = { nomeSocial: social || null, promessa: $('v2pProm').value || null, emergNome: $('v2pEN').value.trim() || null, emergTel: $('v2pET').value.trim() || null, emergRel: $('v2pER').value.trim() || null };
      if (o.podeNasc !== false) obj.nasc = $('v2pNasc').value || null;
      if (social && !p.nomeCompleto) obj.nomeCompleto = o.nome;
      obj.nome = social ? (p.nomeCompleto || o.nome) : (p.nomeCompleto || o.nome);
      b.disabled = true;
      try {
        await gravar(o.sec, o.id, obj);
        if (o.aplicarNome) { var novo = social || p.nomeCompleto || o.nome; if (novo !== o.nome) await o.aplicarNome(o.id, novo); }
        ov.remove(); if (o.aoSalvar) o.aoSalvar();
      } catch (e) { er.textContent = e.message; er.style.display = 'block'; b.disabled = false; }
    };
  }

  // ---- painel da seção ----
  function listaJovens() { try { return (cfg.jovens() || []).filter(function (j) { return !j.arquivado; }); } catch (e) { return []; } }
  function desenhar() {
    var b = $(cfg.container); if (!b) return;
    var js = listaJovens(), d = dados[cfg.secao] || {};
    var pess = js.map(function (j) { var p = d[j.id] || {}; return { nome: nomeTela(p, j.nome), nasc: j.nasc || p.nasc, promessa: p.promessa }; });
    var f = filtro.toLowerCase();
    var linhas = js.filter(function (j) { return !f || nomeTela(d[j.id], j.nome).toLowerCase().indexOf(f) >= 0; }).sort(function (a, c) { return nomeTela(d[a.id], a.nome).localeCompare(nomeTela(d[c.id], c.nome), 'pt'); }).map(function (j) {
      var p = d[j.id] || {}, nasc = j.nasc || p.nasc;
      return '<div class="v2p-row" onclick="V2_PESSOAS._ed(\'' + esc(j.id).replace(/'/g, '') + '\')"><b>' + esc(nomeTela(p, j.nome)) + (p.nomeSocial ? ' <span class="mini">(' + esc(p.nomeCompleto || j.nome) + ')</span>' : '') + '</b>'
        + (nasc ? '<span class="v2p-tag">🎂 ' + dataBR(nasc).slice(0, 5) + '</span>' : '') + (p.promessa ? '<span class="v2p-tag">⭐ ' + tempoDesde(p.promessa) + '</span>' : '')
        + '<span class="v2p-tag ' + (p.emergTel ? 'ok' : 'falta') + '">🚑 ' + (p.emergTel ? 'ok' : 'falta') + '</span>' + (root.V2_FICHAMED ? '<span class="v2p-tag ' + (p.med && p.med.em ? 'ok' : '') + '">🩺 ' + (p.med && p.med.em ? 'ok' : '—') + '</span>' : '') + '</div>';
    }).join('');
    b.innerHTML = '<div class="v2p">' + cardAvisos(avisos(pess), 'Esta semana') + '<input class="v2p-busca" placeholder="Buscar pelo nome…" value="' + esc(filtro) + '" oninput="V2_PESSOAS._f(this.value)">' + (linhas || '<div class="mini">Nenhum jovem encontrado.</div>') + '</div>';
  }
  async function sincronizarNomes() {
    // mantém nome e nascimento de cada jovem em /pessoas (a Diretoria lê as listas daqui)
    var d = dados[cfg.secao] || {}, mapa = {}, mudou = false;
    listaJovens().forEach(function (j) {
      var p = d[j.id] || {};
      var nomeReal = p.nomeSocial ? (p.nomeCompleto || j.nome) : j.nome;
      if (p.nome !== nomeReal || (j.nasc && p.nasc !== j.nasc) || p.tela !== (p.nomeSocial || j.nome)) { mapa[j.id + '/nome'] = nomeReal; mapa[j.id + '/tela'] = p.nomeSocial || j.nome; if (j.nasc) mapa[j.id + '/nasc'] = j.nasc; mudou = true; }
    });
    if (!mudou) return;
    try { await fetch(url('/' + cfg.secao), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mapa) }); await carregarSecao(cfg.secao); } catch (e) {}
  }

  // ---- painel da Diretoria ----
  async function carregarDir() {
    await Promise.all(SECS.map(carregarSecao));
    try { var r = await fetch(url('/chefes')); var c = await r.json(); dados.chefes = c && !c.error ? c : {}; } catch (e) { dados.chefes = dados.chefes || {}; }
    try { var r2 = await fetch(urlComAuthFirebase(root.V2_CONFIG.DB_URL + '/equipe.json')); var e = await r2.json(); chefesEq = e && !e.error ? e : {}; } catch (e2) {}
  }
  function desenharDir() {
    var b = $(dir.container); if (!b) return;
    var todos = [], chefes = [];
    SECS.forEach(function (s) { Object.keys(dados[s] || {}).forEach(function (id) { var p = dados[s][id]; if (p && (p.nome || p.tela)) todos.push({ sec: s, id: id, p: p, nome: p.tela || p.nome }); }); });
    Object.keys(chefesEq).forEach(function (uid) { var u = chefesEq[uid], p = (dados.chefes || {})[uid] || {}; if (u && (u.registro || u.nome)) chefes.push({ uid: uid, u: u, p: p, nome: p.nomeSocial || u.nome || ('Registro ' + u.registro) }); });
    var sem = avisos(todos.map(function (t) { return { nome: t.nome + ' (' + (NOMES_SEC[t.sec] || t.sec).replace(/^\S+\s/, '') + ')', nasc: t.p.nasc, promessa: t.p.promessa }; }));
    var semCh = avisos(chefes.map(function (c) { return { nome: c.nome, nasc: c.p.nasc, promessa: c.p.promessa }; }));
    var h = '<div class="v2p">' + cardAvisos(semCh, 'Chefes — esta semana') + cardAvisos(sem, 'Jovens — esta semana');
    h += '<div class="v2p-sec">👤 Chefes e assistentes</div><table class="v2p-tb"><tr><th>Nome</th><th>Nasc.</th><th>Promessa</th><th>Emergência</th></tr>' + chefes.sort(function (a, c) { return a.nome.localeCompare(c.nome, 'pt'); }).map(function (c) {
      return '<tr onclick="V2_PESSOAS._edChefe(\'' + c.uid + '\')" style="cursor:pointer"><td><b>' + esc(c.nome) + '</b><br><span class="mini">' + esc(NOMES_SEC[c.u.tropa] || '') + '</span></td><td>' + esc(dataBR(c.p.nasc)) + '</td><td>' + esc(dataBR(c.p.promessa)) + (c.p.promessa ? '<br><span class="mini">' + tempoDesde(c.p.promessa) + '</span>' : '') + '</td><td>' + (c.p.emergTel ? esc((c.p.emergNome || '') + ' ' + c.p.emergTel) : '<span class="v2p-tag falta">falta</span>') + '</td></tr>';
    }).join('') + '</table>';
    SECS.forEach(function (s) {
      var l = todos.filter(function (t) { return t.sec === s; }).sort(function (a, c) { return a.nome.localeCompare(c.nome, 'pt'); });
      h += '<div class="v2p-sec">' + NOMES_SEC[s] + ' <span class="mini">(' + l.length + ')</span></div>' + (l.length ? '<table class="v2p-tb"><tr><th>Jovem</th><th>Nasc.</th><th>Promessa</th><th>Emergência</th></tr>' + l.map(function (t) {
        return '<tr><td><b>' + esc(t.nome) + '</b></td><td>' + esc(dataBR(t.p.nasc)) + '</td><td>' + esc(dataBR(t.p.promessa)) + '</td><td>' + (t.p.emergTel ? esc((t.p.emergNome || '') + (t.p.emergRel ? ' (' + t.p.emergRel + ')' : '') + ' ' + t.p.emergTel) : '<span class="v2p-tag falta">falta</span>') + '</td></tr>';
      }).join('') + '</table>' : '<div class="mini">Ainda sem dados. A lista é preenchida quando a seção abre a aba Fichas.</div>');
    });
    b.innerHTML = h + '</div>';
  }

  root.V2_PESSOAS = {
    montar: function (o) { cfg = o; dir = null; injetarCss(); },
    abrir: async function () { if (!cfg) return; var b = $(cfg.container); if (b && !b.innerHTML) b.innerHTML = '<div class="v2p"><div class="mini">Carregando…</div></div>'; await carregarSecao(cfg.secao); desenhar(); await sincronizarNomes(); desenhar(); },
    montarDiretoria: function (o) { dir = o; cfg = null; injetarCss(); },
    abrirDiretoria: async function () { if (!dir) return; var b = $(dir.container); if (b && !b.innerHTML) b.innerHTML = '<div class="v2p"><div class="mini">Carregando…</div></div>'; await carregarDir(); desenharDir(); },
    _f: function (v) { filtro = v; desenhar(); var i = document.querySelector('.v2p-busca'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } },
    _ed: function (id) {
      var j = listaJovens().filter(function (x) { return x.id === id; })[0]; if (!j) return;
      formulario({ sec: cfg.secao, id: id, nome: j.nome, nasc: j.nasc, p: (dados[cfg.secao] || {})[id], aplicarNome: cfg.aplicarNome, aoSalvar: function () { desenhar(); }, podeNasc: !j.nasc });
    },
    _edChefe: function (uid) {
      var u = chefesEq[uid]; if (!u) return;
      formulario({ sec: 'chefes', id: uid, nome: u.nome || ('Registro ' + u.registro), p: (dados.chefes || {})[uid], chefe: true, aoSalvar: function () { desenharDir(); } });
    },
    avisos: avisos, cardAvisos: cardAvisos, tempoDesde: tempoDesde, temSobrenome: temSobrenome, semanaAtual: semanaAtual,
    // para o calendário: datas do ano de um conjunto de pessoas [{nome,nasc,promessa}]
    eventosDoAno: function (pessoas, ano) {
      var out = [];
      pessoas.forEach(function (p) {
        var d = ocorrencia(p.nasc, ano); if (d) out.push({ data: iso(d), tipo: 'aniv', titulo: '🎂 ' + p.nome });
        var pr = ocorrencia(p.promessa, ano); if (pr && anosEntre(p.promessa, ano) > 0) out.push({ data: iso(pr), tipo: 'prom', titulo: '⭐ ' + p.nome + ' (' + anosEntre(p.promessa, ano) + ' a. de promessa)' });
      });
      return out;
    },
    carregar: carregarSecao, dados: function () { return dados; }, url: url, gravar: gravar
  };
})(typeof window !== 'undefined' ? window : globalThis);

window.ehDiretoriaSessao = function () { try { var o = JSON.parse(localStorage.getItem('chefeSessao') || 'null') || {}; return o.admin === true || o.tropa === 'diretoria' || o.tropa2 === 'diretoria'; } catch (e) { return false; } };

/* ============================================================
   Ficha médica — envio (PDF ou foto), leitura do texto, comparação com a versão anterior e download.
   Texto e dados em /pessoas/<secao>/<id>/med (leve); o arquivo em /fichasMed/<secao>/<id> (regras: chefes da seção + Diretoria + admin).
   O arquivo fica no próprio banco gratuito (sem Storage pago): fotos são reduzidas e PDFs têm limite de tamanho.
   ============================================================ */
(function (root) {
  if (typeof document === 'undefined') return;
  var LIM_PDF = 900 * 1024;
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  function urlArq(sec, id) { return urlComAuthFirebase(root.V2_CONFIG.DB_URL + '/fichasMed/' + sec + (id ? '/' + id : '') + '.json'); }
  function sessao() { try { return JSON.parse(localStorage.getItem('chefeSessao') || 'null') || {}; } catch (e) { return {}; } }
  function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function lerComoDataUrl(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsDataURL(f); }); }
  function carregarScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('Não consegui carregar ' + src)); }; document.head.appendChild(s); }); }

  async function textoDoPdf(arq) {
    if (!root.pdfjsLib) { await carregarScript('Apoio/vendor/pdfjs/pdf.min.js'); root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'Apoio/vendor/pdfjs/pdf.worker.min.js'; }
    var doc = await root.pdfjsLib.getDocument({ data: await arq.arrayBuffer(), disableFontFace: true }).promise, linhas = [];
    for (var n = 1; n <= doc.numPages; n++) {
      var c = await (await doc.getPage(n)).getTextContent(), por = {};
      c.items.forEach(function (i) { if (i.str && i.str.trim()) { var y = Math.round(i.transform[5] / 3); (por[y] = por[y] || []).push({ x: i.transform[4], s: i.str }); } });
      Object.keys(por).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) { linhas.push(por[y].sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.s; }).join(' ').replace(/\s+/g, ' ').trim()); });
    }
    await doc.destroy();
    return linhas.filter(Boolean).join('\n');
  }
  // foto ou PDF escaneado: leitura de imagem (OCR) carregada só quando preciso
  async function ocr(imgOuUrl, aoProgresso) {
    if (!root.Tesseract) await carregarScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
    var r = await root.Tesseract.recognize(imgOuUrl, 'por', { logger: function (m) { if (aoProgresso && m.status === 'recognizing text') aoProgresso(Math.round(m.progress * 100)); } });
    return (r.data.text || '').split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join('\n');
  }
  async function reduzirImagem(arq) {
    var url = await lerComoDataUrl(arq);
    return new Promise(function (ok, no) {
      var im = new Image(); im.onload = function () {
        var m = 1600, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.72));
      }; im.onerror = function () { no(new Error('Imagem inválida.')); }; im.src = url;
    });
  }
  // lê o arquivo: devolve { texto, dataUrl, tipo, nomeArq }
  async function lerFicha(arq, aoStatus) {
    var st = aoStatus || function () {}, ehPdf = /pdf/i.test(arq.type) || /\.pdf$/i.test(arq.name);
    if (ehPdf) {
      if (arq.size > LIM_PDF) throw new Error('PDF grande demais (' + Math.round(arq.size / 1024) + ' KB). O limite é ' + Math.round(LIM_PDF / 1024) + ' KB: salve o PDF em qualidade menor ou envie uma foto.');
      st('Lendo o PDF…');
      var texto = ''; try { texto = await textoDoPdf(arq); } catch (e) { texto = ''; }
      if (texto.replace(/\s/g, '').length < 40) { st('PDF sem texto (escaneado): o arquivo será guardado sem leitura do texto. Para ler o texto, envie uma foto da ficha.'); texto = ''; }
      return { texto: texto, dataUrl: await lerComoDataUrl(arq), tipo: 'application/pdf', nomeArq: arq.name, semTexto: !texto };
    }
    st('Reduzindo a imagem…'); var du = await reduzirImagem(arq), texto2 = '';
    try { st('Lendo o texto da imagem (pode levar um minuto)…'); texto2 = await ocr(du, function (p) { st('Lendo o texto da imagem… ' + p + '%'); }); } catch (e) { texto2 = ''; }
    return { texto: texto2, dataUrl: du, tipo: 'image/jpeg', nomeArq: arq.name, semTexto: !texto2 };
  }
  function campos(texto) {
    var out = [], visto = {}; String(texto || '').split('\n').forEach(function (l) { var m = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \/()]{2,40}?)\s*[:\-–]\s*(\S.*)$/.exec(l); if (m && !visto[m[1]]) { visto[m[1]] = 1; out.push([m[1].trim(), m[2].trim()]); } });
    return out;
  }
  // diferenças linha a linha entre a ficha anterior e a nova
  function comparar(antes, depois) {
    var A = String(antes || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean), B = String(depois || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var sa = {}, sb = {}; A.forEach(function (l) { sa[norm(l)] = l; }); B.forEach(function (l) { sb[norm(l)] = l; });
    return { removidas: A.filter(function (l) { return !sb[norm(l)]; }), novas: B.filter(function (l) { return !sa[norm(l)]; }) };
  }
  async function gravarFicha(sec, id, nome, f) {
    var s = sessao(), agora = new Date().toISOString();
    var r1 = await fetch(urlArq(sec, id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: f.dataUrl, tipo: f.tipo, nomeArq: f.nomeArq, em: agora }) });
    if (!r1.ok) throw new Error(r1.status === 401 || r1.status === 403 ? 'Sem permissão para gravar a ficha médica. Peça ao admin para atualizar as regras do banco.' : 'Falha ao gravar o arquivo (' + r1.status + ').');
    var med = { texto: f.texto || '', nomeArq: f.nomeArq, tipo: f.tipo, em: agora, por: String(s.registro || ''), nomePor: s.nome || '', semTexto: !!f.semTexto };
    await root.V2_PESSOAS.gravar(sec, id, { med: med });
    return med;
  }
  async function baixar(sec, id, nomeBase) {
    var r = await fetch(urlArq(sec, id)); var d = await r.json();
    if (!d || !d.dataUrl) { alert('Arquivo não encontrado.'); return; }
    var a = document.createElement('a'); a.href = d.dataUrl; a.download = d.nomeArq || (nomeBase + (d.tipo === 'application/pdf' ? '.pdf' : '.jpg')); document.body.appendChild(a); a.click(); a.remove();
  }
  function htmlDiff(df) {
    if (!df.novas.length && !df.removidas.length) return '<div class="mini">Nenhuma diferença no texto.</div>';
    return df.novas.map(function (l) { return '<div style="color:#1b6e3a">+ ' + esc(l) + '</div>'; }).join('') + df.removidas.map(function (l) { return '<div style="color:#b3261e;text-decoration:line-through">− ' + esc(l) + '</div>'; }).join('');
  }

  // painel dentro da ficha do jovem
  function montar(host, o) {
    var med = (o.p && o.p.med) || null, pend = null;
    function desenhar(msg) {
      var h = '';
      if (med) {
        h += '<div style="font-size:13px;margin-bottom:6px">Ficha de <b>' + new Date(med.em).toLocaleDateString('pt-BR') + '</b> · enviada por ' + esc(med.nomePor || ('Registro ' + med.por)) + '</div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button type="button" class="v2p-bt" id="v2mBaixar">⬇ Baixar arquivo</button>' + (med.texto ? '<button type="button" class="v2p-bt" id="v2mTexto">📄 Ver texto</button>' : '') + '</div><div id="v2mTxt" style="display:none;max-height:220px;overflow:auto;font-size:12px;white-space:pre-wrap;border:1px solid var(--border,#ddd);border-radius:8px;padding:8px;margin-bottom:6px"></div>';
        if (med.semTexto) h += '<div class="mini">O texto desta ficha não pôde ser lido automaticamente; o arquivo está guardado.</div>';
      } else h += '<div class="mini" style="margin-bottom:6px">Nenhuma ficha médica enviada.</div>';
      if (pend) {
        var df = comparar(med && med.texto, pend.f.texto);
        h += '<div class="v2p-aviso"><b>Nova ficha: ' + esc(pend.f.nomeArq) + '</b>' + (med ? '<div style="margin:6px 0">O que mudou em relação à ficha atual:</div>' + htmlDiff(df) : '<div class="mini">Primeira ficha deste jovem.</div>') + (pend.f.semTexto ? '<div class="mini">Não consegui ler o texto; só o arquivo será guardado, sem comparação.</div>' : '')
          + '<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="v2p-bt" id="v2mDesc">Descartar</button><button type="button" class="v2p-bt p" id="v2mEf">Efetivar</button></div></div>';
      } else h += '<label>' + (med ? 'Enviar ficha atualizada' : 'Enviar ficha') + ' (PDF ou foto)</label><input type="file" id="v2mArq" accept="application/pdf,image/*">';
      h += '<div id="v2mMsg" class="mini" style="margin-top:6px">' + esc(msg || '') + '</div>';
      host.innerHTML = h;
      var b = $('v2mBaixar'); if (b) b.onclick = function () { baixar(o.sec, o.id, o.nome); };
      var t = $('v2mTexto'); if (t) t.onclick = function () { var x = $('v2mTxt'); x.style.display = x.style.display === 'none' ? '' : 'none'; x.textContent = med.texto; };
      var inp = $('v2mArq'); if (inp) inp.onchange = async function () {
        if (!inp.files[0]) return;
        try { var f = await lerFicha(inp.files[0], function (s) { var m = $('v2mMsg'); if (m) m.textContent = s; }); pend = { f: f }; desenhar(); } catch (e) { desenhar(e.message); }
      };
      var ef = $('v2mEf'); if (ef) ef.onclick = async function () {
        ef.disabled = true; try { med = await gravarFicha(o.sec, o.id, o.nome, pend.f); pend = null; if (o.recarregar) o.recarregar(); desenhar('Ficha gravada.'); } catch (e) { ef.disabled = false; $('v2mMsg').textContent = e.message; }
      };
      var dc = $('v2mDesc'); if (dc) dc.onclick = function () { pend = null; desenhar(); };
    }
    desenhar();
  }

  // envio em lote (tela "Fichas 120"): cada arquivo é ligado a um jovem pelo nome (no arquivo ou no texto)
  async function lote(arquivos, sec, jovens, host) {
    var itens = [];
    host.innerHTML = '<div class="mini">Lendo as fichas médicas…</div>';
    var dadosSec = await root.V2_PESSOAS.carregar(sec);
    for (var i = 0; i < arquivos.length; i++) {
      var a = arquivos[i], it = { arq: a, nome: a.name, ok: false };
      try {
        it.f = await lerFicha(a, function (s) { host.innerHTML = '<div class="mini">' + esc(a.name) + ': ' + esc(s) + '</div>'; });
        var alvo = norm(a.name + ' ' + it.f.texto.slice(0, 1500)), melhor = null, pts = 0;
        jovens.forEach(function (j) { var tk = norm(j.nome).split(' ').filter(function (x) { return x.length > 2; }); if (tk.length < 2) return; var c = tk.filter(function (x) { return alvo.indexOf(x) >= 0; }).length; if (c === tk.length && c > pts) { pts = c; melhor = j; } });
        if (melhor) { it.jovem = melhor; var ant = dadosSec[melhor.id] && dadosSec[melhor.id].med; it.df = ant ? comparar(ant.texto, it.f.texto) : null; it.novo = !ant; it.ok = true; }
      } catch (e) { it.erro = e.message; }
      itens.push(it);
    }
    function pintar() {
      host.innerHTML = '<div class="v2p"><div class="v2p-sec">🩺 Fichas médicas lidas</div>' + itens.map(function (it, k) {
        if (it.feito) return '<div class="v2p-aviso">✓ ' + esc(it.jovem.nome) + ' — ficha gravada.</div>';
        if (it.erro) return '<div class="v2p-aviso" style="border-color:#b3261e">' + esc(it.nome) + ': ' + esc(it.erro) + '</div>';
        if (!it.ok) return '<div class="v2p-aviso">' + esc(it.nome) + ': não encontrei o jovem desta ficha (o nome completo precisa aparecer no arquivo ou no texto). Envie esta ficha pela aba Fichas do jovem.</div>';
        return '<div class="v2p-aviso"><b>' + esc(it.jovem.nome) + '</b> <span class="mini">(' + esc(it.nome) + ')</span>' + (it.novo ? '<div class="mini">Primeira ficha médica.</div>' : htmlDiff(it.df)) + '<button type="button" class="v2p-bt p" style="margin-top:6px" onclick="V2_FICHAMED._ef(' + k + ')">Efetivar</button></div>';
      }).join('') + '</div>';
    }
    lote._it = itens; lote._pintar = pintar; lote._sec = sec; pintar();
  }
  root.V2_FICHAMED = {
    montar: montar, lerFicha: lerFicha, comparar: comparar, campos: campos, lote: lote,
    _ef: async function (k) { var it = lote._it[k]; try { await gravarFicha(lote._sec, it.jovem.id, it.jovem.nome, it.f); it.feito = true; } catch (e) { it.erro = e.message; } lote._pintar(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   Calendário do grupo — atividades do grupo, do distrito, da região e nacionais, com janelas de execução (MUTECO, MUTCOM…).
   Dados em /grupoCal/<id> {nome, ini, fim, local, secoes:[...], origem, janela, criadoTropa, por}.
   Importação de Excel/CSV/PDF: o arquivo é lido no aparelho, vira uma lista para conferir e NÃO é guardado.
   ============================================================ */
(function (root) {
  if (typeof document === 'undefined') return;
  var NOMES = { alcateia: '🐺 Alcateia', escoteira: '⚜️ Tropa Escoteira', senior: '🧭 Tropa Sênior', cla: '🔥 Clã Pioneiro' };
  var SECS = ['alcateia', 'escoteira', 'senior', 'cla'];
  var ORIG = { grupo: ['Grupo', '#1b6e3a'], distrito: ['Distrito', '#1565c0'], regiao: ['Região', '#7b1fa2'], nacional: ['Nacional', '#e65100'], secao: ['Calendário da seção', '#00796b'] };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var cfg = null, eventos = {}, marcas = [], mes = null, equipe = {};
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dBR(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function sessao() { try { return JSON.parse(localStorage.getItem('chefeSessao') || 'null') || {}; } catch (e) { return {}; } }
  function url(p) { return root.urlComAuthFirebase(root.V2_CONFIG.DB_URL + p + '.json'); }
  function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function ehDir() { return !!(root.ehDiretoriaSessao && root.ehDiretoriaSessao()); }
  function escolheSecoes() { return ehDir() && !(cfg && cfg.secao); }
  function minhaSecao() { return cfg && cfg.secao; }
  function injetarCss() {
    if ($('v2cCss')) return;
    var st = document.createElement('style'); st.id = 'v2cCss';
    st.textContent = '.v2c{padding:12px 14px}.v2c-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.v2c-top h3{flex:1;margin:0;font-size:16px;text-align:center;min-width:130px}'
      + '.v2c-bt{border:1px solid var(--border,#ddd);background:var(--card,#fff);color:inherit;border-radius:10px;padding:9px 13px;font-weight:700;font-size:13px;cursor:pointer}.v2c-bt.p{background:#1b6e3a;color:#fff;border-color:#1b6e3a}'
      + '.v2c-g{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.v2c-h{font-size:10px;font-weight:800;text-align:center;opacity:.6}'
      + '.v2c-d{min-height:50px;border:1px solid var(--border,#ddd);border-radius:8px;padding:3px;font-size:11px;background:var(--card,#fff);cursor:pointer;overflow:hidden}.v2c-d.fora{opacity:.35}.v2c-d.hoje{outline:2px solid #1b6e3a}.v2c-d.sab{background:rgba(27,110,58,.07)}'
      + '.v2c-dots{display:flex;flex-wrap:wrap;gap:2px;margin-top:3px}.v2c-dot{width:9px;height:9px;border-radius:50%}.v2c-dot.j{border-radius:2px;opacity:.55}.v2c-em{font-size:11px;line-height:1}'
      + '.v2c-leg{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;margin:10px 0}.v2c-leg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle}'
      + '.v2c-it{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border:1px solid var(--border,#ddd);border-left:5px solid #888;border-radius:10px;margin-bottom:6px;background:var(--card,#fff);font-size:13px}.v2c-it .q{flex:1;min-width:0}.v2c-it small{opacity:.7;display:block}'
      + '.v2c-jn{margin:8px 0;font-size:12px}.v2c-jb{position:relative;height:20px;background:rgba(0,0,0,.06);border-radius:6px;margin-top:3px;overflow:hidden}.v2c-jb span{position:absolute;top:0;bottom:0;border-radius:6px;opacity:.85;color:#fff;font-size:10px;line-height:20px;padding:0 5px;white-space:nowrap;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.25) 0 6px,transparent 6px 12px)}'
      + '.v2c-sec{margin:14px 0 6px;font-weight:800;font-size:14px}.v2c-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100040;display:flex;align-items:center;justify-content:center;padding:12px}.v2c-box{background:var(--card,#fff);color:var(--text,#1a1a1a);border-radius:14px;padding:16px;width:100%;max-width:560px;max-height:90vh;overflow:auto;box-sizing:border-box}'
      + '.v2c-box label{display:block;font-size:11px;font-weight:700;margin:10px 0 3px;opacity:.75;text-transform:uppercase}.v2c-box input[type=text],.v2c-box input[type=date],.v2c-box select{width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border,#ccc);border-radius:8px;font-size:14px;background:var(--card,#fff);color:inherit}'
      + '.v2c-ck{display:flex;gap:6px;align-items:center;font-size:13px;margin:4px 0;text-transform:none!important;font-weight:600!important;opacity:1!important}.v2c-imp{border:1px solid var(--border,#ddd);border-radius:10px;padding:8px;margin-bottom:6px;font-size:12px}.v2c-imp input[type=text],.v2c-imp input[type=date]{padding:6px!important;font-size:12px!important}.v2c-imp .l{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px}';
    document.head.appendChild(st);
  }
  function ano() { return mes ? mes.getFullYear() : new Date().getFullYear(); }
  function visiveis() {
    return Object.keys(eventos).map(function (k) { var e = eventos[k]; e.id = k; return e; }).filter(function (e) {
      if (!e || !e.ini) return false;
      var s = e.secoes ? (Array.isArray(e.secoes) ? e.secoes : Object.keys(e.secoes).map(function (k2) { return e.secoes[k2]; })) : [];
      e._s = s;
      return !cfg.secao || s.indexOf(cfg.secao) >= 0;
    }).concat(antigos());
  }
  // atividades lançadas no calendário antigo de cada seção (cada página expõe window.calSecaoEventos)
  function antigos() {
    if (!cfg.secao || typeof root.calSecaoEventos !== 'function') return [];
    var out = [];
    try { root.calSecaoEventos().forEach(function (e, i) { if (e && e.ini && /^\d{4}-\d{2}-\d{2}/.test(e.ini)) out.push({ id: 'old' + i, nome: e.nome || 'Atividade', ini: e.ini.slice(0, 10), fim: null, local: e.local || null, origem: 'secao', janela: false, _s: [cfg.secao], _old: true }); }); } catch (x) {}
    return out;
  }
  function noDia(e, d) { return e.ini <= d && (e.fim || e.ini) >= d; }
  function cor(e) { return (ORIG[e.origem] || ORIG.grupo)[1]; }
  function podeMexer(e) {
    if (e._old) return false;
    if (ehDir() && !cfg.secao) return true;
    return e.criadoTropa && e.criadoTropa === minhaSecao() && e._s.length === 1;
  }
  async function carregar() {
    try { var r = await fetch(url('/grupoCal')); var d = await r.json(); eventos = d && !d.error ? d : {}; } catch (e) { eventos = eventos || {}; }
    try { var r2 = await fetch(url('/equipe')); var q = await r2.json(); equipe = q && !q.error ? q : {}; } catch (e2) {}
    marcas = [];
    try {
      if (cfg.secao && root.V2_PESSOAS) {
        var ds = await root.V2_PESSOAS.carregar(cfg.secao);
        Object.keys(ds || {}).forEach(function (id) { var p = ds[id]; if (p && typeof p === 'object' && (p.nasc || p.promessa)) marcas.push({ nome: p.nomeSocial || p.tela || p.nome || 'Jovem', nasc: p.nasc, promessa: p.promessa }); });
      } else if (!cfg.secao && root.V2_PESSOAS && ehDir()) {
        var ch = await root.V2_PESSOAS.carregar('chefes');
        Object.keys(ch || {}).forEach(function (uid) { var p = ch[uid]; if (p && typeof p === 'object' && (p.nasc || p.promessa)) marcas.push({ nome: p.nomeSocial || (equipe[uid] && equipe[uid].nome) || 'Chefe', nasc: p.nasc, promessa: p.promessa }); });
      }
    } catch (e3) {}
  }
  function desenhar() {
    var box = $(cfg.container); if (!box) return;
    var evs = visiveis(), y = mes.getFullYear(), m = mes.getMonth(), hojeIso = iso(new Date());
    var prim = new Date(y, m, 1), ult = new Date(y, m + 1, 0), ini = new Date(prim); ini.setDate(1 - prim.getDay());
    var marc = root.V2_PESSOAS ? root.V2_PESSOAS.eventosDoAno(marcas, y) : [];
    var h = '<div class="v2c"><div class="v2c-top"><button class="v2c-bt" onclick="V2_CAL._m(-1)">‹</button><h3>' + MESES[m] + ' de ' + y + '</h3><button class="v2c-bt" onclick="V2_CAL._m(1)">›</button></div>';
    h += '<div class="v2c-top">' + (ehDir() && !cfg.secao ? '<button class="v2c-bt p" onclick="V2_CAL._novo()">➕ Atividade do grupo</button>' : '') + (cfg.podeImportar !== false ? '<button class="v2c-bt" onclick="V2_CAL._imp()">📥 Importar calendário</button>' : '') + '<button class="v2c-bt" onclick="V2_CAL._m(0)">Hoje</button></div>';
    h += '<div class="v2c-g">' + ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function (x) { return '<div class="v2c-h">' + x + '</div>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = new Date(ini); d.setDate(ini.getDate() + i); var di = iso(d);
      if (i >= 35 && d.getMonth() !== m) break;
      var es = evs.filter(function (e) { return noDia(e, di); }), ms = marc.filter(function (x) { return x.data === di; });
      h += '<div class="v2c-d' + (d.getMonth() !== m ? ' fora' : '') + (di === hojeIso ? ' hoje' : '') + (d.getDay() === 6 ? ' sab' : '') + '" onclick="V2_CAL._dia(\'' + di + '\')"><b>' + d.getDate() + '</b><div class="v2c-dots">'
        + es.slice(0, 5).map(function (e) { return '<span class="v2c-dot' + (e.janela ? ' j' : '') + '" style="background:' + cor(e) + '"></span>'; }).join('') + (es.length > 5 ? '+' : '')
        + ms.slice(0, 3).map(function (x) { return '<span class="v2c-em">' + (x.tipo === 'aniv' ? '🎂' : '⭐') + '</span>'; }).join('') + '</div></div>';
    }
    h += '</div><div class="v2c-leg">' + Object.keys(ORIG).filter(function (k) { return k !== 'secao' || cfg.secao; }).map(function (k) { return '<span><i style="background:' + ORIG[k][1] + '"></i>' + ORIG[k][0] + '</span>'; }).join('') + '<span>▬ janela de execução</span><span>🎂 aniversário</span><span>⭐ estrela de promessa</span></div>';
    var p0 = iso(prim), p1 = iso(ult);
    var jan = evs.filter(function (e) { return e.janela && e.ini <= p1 && (e.fim || e.ini) >= p0; });
    if (jan.length) {
      h += '<div class="v2c-sec">Janelas de execução neste mês</div>';
      var dias = ult.getDate();
      jan.forEach(function (e) {
        var a = e.ini < p0 ? 1 : +e.ini.slice(8), b = (e.fim || e.ini) > p1 ? dias : +(e.fim || e.ini).slice(8);
        h += '<div class="v2c-jn"><b>' + esc(e.nome) + '</b> <small>' + dBR(e.ini) + ' a ' + dBR(e.fim || e.ini) + '</small><div class="v2c-jb"><span style="left:' + ((a - 1) / dias * 100) + '%;width:' + ((b - a + 1) / dias * 100) + '%;background:' + cor(e) + '">' + a + '–' + b + '</span></div></div>';
      });
    }
    var doMes = evs.filter(function (e) { return !e.janela && e.ini <= p1 && (e.fim || e.ini) >= p0; }).sort(function (a, b) { return a.ini < b.ini ? -1 : 1; });
    h += '<div class="v2c-sec">Atividades do mês</div>' + (doMes.length ? doMes.map(item).join('') : '<div style="opacity:.7;font-size:13px">Nenhuma atividade do grupo neste mês.</div>');
    var mm = marc.filter(function (x) { return x.data >= p0 && x.data <= p1; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (mm.length) h += '<div class="v2c-sec">Datas de pessoas</div>' + mm.map(function (x) { return '<div class="v2c-it" style="border-left-color:#f9a825"><div class="q">' + esc(x.titulo) + '<small>' + dBR(x.data) + '</small></div></div>'; }).join('');
    h += '<div id="v2cDia"></div></div>';
    box.innerHTML = h;
  }
  function item(e) {
    var o = ORIG[e.origem] || ORIG.grupo;
    return '<div class="v2c-it" style="border-left-color:' + o[1] + '"><div class="q"><b>' + esc(e.nome) + '</b><small>' + dBR(e.ini) + (e.fim && e.fim !== e.ini ? ' a ' + dBR(e.fim) : '') + (e.local ? ' · ' + esc(e.local) : '') + '</small><small>' + o[0] + ' · ' + e._s.map(function (s) { return NOMES[s] || s; }).join(', ') + '</small></div>'
      + (podeMexer(e) ? '<button class="v2c-bt" onclick="V2_CAL._ed(\'' + e.id + '\')">Editar</button>' : '') + '</div>';
  }
  function fechar() { var o = $('v2cOv'); if (o) o.remove(); }
  function overlay(html) { fechar(); var o = document.createElement('div'); o.className = 'v2c-ov'; o.id = 'v2cOv'; o.innerHTML = '<div class="v2c-box">' + html + '</div>'; o.addEventListener('click', function (e) { if (e.target === o) fechar(); }); document.body.appendChild(o); }
  function checksSecoes(sel, prefixo) {
    if (!escolheSecoes()) return '<div style="font-size:13px">Seção: <b>' + (NOMES[minhaSecao()] || '') + '</b></div>';
    return SECS.map(function (s) { return '<label class="v2c-ck"><input type="checkbox" class="' + prefixo + '" value="' + s + '"' + (sel.indexOf(s) >= 0 ? ' checked' : '') + '> ' + NOMES[s] + '</label>'; }).join('');
  }
  function lerChecks(prefixo) {
    if (!escolheSecoes()) return [minhaSecao()];
    return Array.prototype.map.call(document.querySelectorAll('.' + prefixo + ':checked'), function (c) { return c.value; });
  }
  function formulario(e) {
    var novo = !e; e = e || { nome: '', ini: '', fim: '', local: '', origem: 'grupo', janela: false, _s: SECS.slice() };
    overlay('<h3 style="margin:0 0 6px">' + (novo ? 'Nova atividade' : 'Editar atividade') + '</h3><label>Nome</label><input type="text" id="v2cN" value="' + esc(e.nome) + '"><label>Início</label><input type="date" id="v2cI" value="' + esc(e.ini) + '"><label>Fim (se durar mais de um dia)</label><input type="date" id="v2cF" value="' + esc(e.fim || '') + '"><label>Local</label><input type="text" id="v2cL" value="' + esc(e.local || '') + '">'
      + (escolheSecoes() ? '<label>Origem</label><select id="v2cO">' + Object.keys(ORIG).filter(function (k) { return k !== 'secao'; }).map(function (k) { return '<option value="' + k + '"' + (k === e.origem ? ' selected' : '') + '>' + ORIG[k][0] + '</option>'; }).join('') + '</select>' : '')
      + '<label class="v2c-ck"><input type="checkbox" id="v2cJ"' + (e.janela ? ' checked' : '') + '> Janela de execução (a seção escolhe o dia dentro do intervalo, como MUTECO e MUTCOM)</label><label>Seções participantes</label>' + checksSecoes(e._s, 'v2cS')
      + '<div id="v2cErro" style="color:#c0392b;font-size:12px;margin-top:6px"></div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="v2c-bt p" id="v2cOk">Salvar</button><button class="v2c-bt" onclick="V2_CAL._fechar()">Cancelar</button>' + (novo ? '' : '<button class="v2c-bt" style="margin-left:auto;color:#c0392b" id="v2cDel">Excluir</button>') + '</div>');
    $('v2cOk').onclick = async function () {
      var n = $('v2cN').value.trim(), i = $('v2cI').value, f = $('v2cF').value, s = lerChecks('v2cS');
      if (!n || !i) { $('v2cErro').textContent = 'Informe o nome e a data de início.'; return; }
      if (f && f < i) { $('v2cErro').textContent = 'O fim não pode ser antes do início.'; return; }
      if (!s.length) { $('v2cErro').textContent = 'Escolha ao menos uma seção.'; return; }
      var sess = sessao();
      var obj = { nome: n, ini: i, fim: f || null, local: $('v2cL').value.trim() || null, origem: $('v2cO') ? $('v2cO').value : (e.origem || 'distrito'), janela: $('v2cJ').checked, secoes: s, criadoTropa: e.criadoTropa || (escolheSecoes() ? 'diretoria' : minhaSecao()), por: sess.nome || null };
      await gravar(novo ? 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : e.id, obj);
    };
    if (!novo) $('v2cDel').onclick = async function () { if (!confirm('Excluir esta atividade?')) return; await gravar(e.id, null); };
  }
  async function gravar(id, obj) {
    try {
      var r = await fetch(url('/grupoCal/' + id), { method: obj ? 'PUT' : 'DELETE', headers: { 'Content-Type': 'application/json' }, body: obj ? JSON.stringify(obj) : undefined });
      if (!r.ok) throw new Error('perm');
      if (obj) eventos[id] = obj; else delete eventos[id];
      fechar(); desenhar();
    } catch (e) { var er = $('v2cErro'); if (er) er.textContent = 'O banco não aceitou. O admin precisa publicar as regras novas do Firebase.'; else alert('O banco não aceitou. O admin precisa publicar as regras novas do Firebase.'); }
  }

  /* ---------- leitura de datas em texto ---------- */
  var MESRX = '(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\\.?';
  var MIDX = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  function mk(a, m, d, padrao) { a = a ? +a : padrao; if (a < 100) a += 2000; if (m < 1 || m > 12 || d < 1 || d > 31) return null; return a + '-' + pad(m) + '-' + pad(d); }
  function parseDatas(texto, padrao) {
    var t = norm(texto).replace(/\s+/g, ' '), nome = t, r, ini = null, fim = null;
    function cortar(rx) { nome = nome.replace(rx, ' '); }
    // 12 a 14/03[/2026] | 12 e 13 de março
    var c = new RegExp('(?<![\\d\\/.\\-])(\\d{1,2})\\s*(?:a|e|ao|ate|-|–)\\s*(\\d{1,2})\\s*(?:\\/|de\\s+| )\\s*(\\d{1,2}|' + MESRX + ')(?:\\s*(?:\\/|de\\s+| )\\s*(\\d{2,4}))?'), mc = c.exec(t);
    if (mc) {
      var mm = /^\d/.test(mc[3]) ? +mc[3] : MIDX[mc[4]]; ini = mk(mc[6], mm, +mc[1], padrao); fim = mk(mc[6], mm, +mc[2], padrao);
      if (ini && fim) { cortar(c); return { ini: ini, fim: fim, resto: nome }; }
    }
    var toks = [], rxs = [new RegExp('(\\d{1,2})[\\/.\\-](\\d{1,2})(?:[\\/.\\-](\\d{2,4}))?', 'g'), new RegExp('(\\d{1,2})\\s*(?:de\\s+)?' + MESRX + '(?:\\s*(?:de\\s+)?(\\d{4}))?', 'g')];
    var m1; while ((m1 = rxs[0].exec(t))) toks.push({ i: m1.index, d: mk(m1[3], +m1[2], +m1[1], padrao) });
    while ((m1 = rxs[1].exec(t))) toks.push({ i: m1.index, d: mk(m1[4], MIDX[m1[2]], +m1[1], padrao) });
    toks = toks.filter(function (x) { return x.d; }).sort(function (a, b) { return a.i - b.i; });
    if (!toks.length) return null;
    ini = toks[0].d; fim = toks.length > 1 ? toks[toks.length - 1].d : null; if (fim && fim < ini) { var tmp = ini; ini = fim; fim = tmp; }
    nome = nome.replace(rxs[0], ' ').replace(rxs[1], ' ');
    return { ini: ini, fim: fim === ini ? null : fim, resto: nome };
  }
  function limparNome(orig, resto) {
    // devolve o texto original sem as datas, mantendo maiúsculas
    var s = String(orig).replace(/\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?/g, ' ').replace(new RegExp('\\d{1,2}\\s*(?:de\\s+)?' + MESRX + '(?:\\s*(?:de\\s+)?\\d{4})?', 'gi'), ' ').replace(/\b\d{1,2}\s*(?:a|e|ao|até|-|–)\s*(?=\s|$)/gi, ' ');
    s = s.replace(/[|;–\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    for (var k = 0; k < 3; k++) s = s.replace(/^(a|e|até|ate|ao|de|em)\s+/i, '').replace(/\s+(a|e|até|ate|ao|de|em)$/i, '').trim();
    return s;
  }
  function janelaProvavel(nome, ini, fim) { return /mut(eco|com)|prazo|janela|periodo de|inscric/.test(norm(nome)) || (!!fim && (new Date(fim) - new Date(ini)) / 864e5 >= 14); }
  function carregarScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('Não consegui carregar o leitor de planilhas. Confira a internet.')); }; document.head.appendChild(s); }); }
  async function linhasPdf(arq) {
    if (!root.pdfjsLib) { await carregarScript('Apoio/vendor/pdfjs/pdf.min.js'); root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'Apoio/vendor/pdfjs/pdf.worker.min.js'; }
    var doc = await root.pdfjsLib.getDocument({ data: await arq.arrayBuffer(), disableFontFace: true }).promise, out = [];
    for (var n = 1; n <= doc.numPages; n++) {
      var c = await (await doc.getPage(n)).getTextContent(), por = {};
      c.items.forEach(function (i) { if (i.str && i.str.trim()) { var y = Math.round(i.transform[5] / 4); (por[y] = por[y] || []).push({ x: i.transform[4], s: i.str }); } });
      Object.keys(por).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) { out.push(por[y].sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.s; }).join(' ').replace(/\s+/g, ' ').trim()); });
    }
    await doc.destroy(); return out.filter(Boolean);
  }
  async function linhasPlanilha(arq) {
    if (/\.csv$/i.test(arq.name)) return (await arq.text()).split(/\r?\n/).filter(Boolean);
    if (!root.XLSX) await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    var wb = root.XLSX.read(await arq.arrayBuffer(), { type: 'array', cellDates: true }), out = [];
    wb.SheetNames.forEach(function (sn) {
      root.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' }).forEach(function (row) {
        var cel = row.map(function (v) { if (v instanceof Date) { var d = new Date(v.getTime() + 12 * 3600e3); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); } return String(v == null ? '' : v).trim(); }).filter(Boolean);
        if (cel.length) out.push(cel.join(' | '));
      });
    });
    return out;
  }
  function extrair(linhas, anoPadrao) {
    var res = [], anterior = '';
    linhas.forEach(function (ln) {
      var p = parseDatas(ln, anoPadrao);
      if (!p) { if (ln.length > 3 && ln.length < 120) anterior = ln; return; }
      var nome = limparNome(ln, p.resto); if (nome.length < 3) nome = anterior; if (!nome) return;
      res.push({ nome: nome.slice(0, 120), ini: p.ini, fim: p.fim || '', janela: janelaProvavel(nome, p.ini, p.fim), ok: true });
      anterior = '';
    });
    return res;
  }
  var pend = [];
  function importar() {
    var anoAtual = new Date().getFullYear();
    overlay('<h3 style="margin:0 0 6px">📥 Importar calendário</h3><div style="font-size:12px;opacity:.75">Excel, CSV ou PDF do distrito, da região ou nacional. O arquivo é lido aqui e não fica guardado: você confere a lista antes de entrar no sistema.</div>'
      + '<label>Origem do calendário</label><select id="v2cImpO"><option value="distrito">Distrito</option><option value="regiao">Região</option><option value="nacional">Nacional</option></select>'
      + '<label>Ano das datas sem ano</label><select id="v2cImpA">' + [anoAtual - 1, anoAtual, anoAtual + 1].map(function (a) { return '<option' + (a === anoAtual ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>'
      + '<label>' + (ehDir() ? 'Seções a que se relacionam' : 'Seção') + '</label>' + checksSecoes([], 'v2cImpS')
      + '<label>Arquivo</label><input type="file" id="v2cImpF" accept=".xlsx,.xls,.csv,application/pdf,.pdf"><div id="v2cImpMsg" style="font-size:12px;margin-top:8px"></div><div id="v2cImpLista"></div><div style="display:flex;gap:8px;margin-top:12px"><button class="v2c-bt p" id="v2cImpGo" style="display:none">Adicionar ao calendário</button><button class="v2c-bt" onclick="V2_CAL._fechar()">Fechar</button></div>');
    $('v2cImpF').onchange = async function () {
      var f = this.files[0]; if (!f) return; var msg = $('v2cImpMsg'); msg.textContent = 'Lendo o arquivo…';
      try {
        var linhas = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await linhasPdf(f) : await linhasPlanilha(f);
        pend = extrair(linhas, +$('v2cImpA').value);
        if (!pend.length) { msg.textContent = 'Não encontrei atividades com data neste arquivo. Se for PDF escaneado (imagem), peça a planilha ou cadastre à mão.'; $('v2cImpLista').innerHTML = ''; $('v2cImpGo').style.display = 'none'; return; }
        msg.textContent = pend.length + ' atividades encontradas. Confira, corrija e desmarque o que não serve.';
        $('v2cImpLista').innerHTML = pend.map(function (e, i) { return '<div class="v2c-imp"><label class="v2c-ck"><input type="checkbox" data-i="' + i + '" data-c="ok" checked> <input type="text" data-i="' + i + '" data-c="nome" value="' + esc(e.nome) + '"></label><div class="l"><input type="date" data-i="' + i + '" data-c="ini" value="' + e.ini + '"> até <input type="date" data-i="' + i + '" data-c="fim" value="' + e.fim + '"><label class="v2c-ck"><input type="checkbox" data-i="' + i + '" data-c="janela"' + (e.janela ? ' checked' : '') + '> janela de execução</label></div></div>'; }).join('');
        $('v2cImpGo').style.display = '';
      } catch (er) { msg.textContent = er.message || 'Não consegui ler o arquivo.'; }
    };
    $('v2cImpGo').onclick = async function () {
      var secs = lerChecks('v2cImpS'); if (!secs.length) { $('v2cImpMsg').textContent = 'Escolha ao menos uma seção.'; return; }
      document.querySelectorAll('#v2cImpLista [data-i]').forEach(function (el) { var e = pend[+el.dataset.i], c = el.dataset.c; e[c] = el.type === 'checkbox' ? el.checked : el.value; });
      var lote = {}, sess = sessao(), orig = $('v2cImpO').value, n = 0;
      pend.forEach(function (e) { if (!e.ok || !e.nome || !e.ini) return; lote['i' + Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 4)] = { nome: e.nome, ini: e.ini, fim: e.fim && e.fim > e.ini ? e.fim : null, local: null, origem: orig, janela: !!e.janela, secoes: secs, criadoTropa: escolheSecoes() ? 'diretoria' : minhaSecao(), por: sess.nome || null }; });
      if (!n) { $('v2cImpMsg').textContent = 'Nada selecionado.'; return; }
      try { var r = await fetch(url('/grupoCal'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lote) }); if (!r.ok) throw 0; Object.assign(eventos, lote); pend = []; fechar(); desenhar(); }
      catch (e) { $('v2cImpMsg').textContent = 'O banco não aceitou. O admin precisa publicar as regras novas do Firebase.'; }
    };
  }

  root.V2_CAL = {
    // o: { container, secao (null = Diretoria vê todas), podeImportar }
    montar: async function (o) { cfg = o; injetarCss(); var h = new Date(); mes = new Date(h.getFullYear(), h.getMonth(), 1); $(o.container).innerHTML = '<div class="v2c">Carregando calendário…</div>'; await carregar(); desenhar(); },
    atualizar: async function () { if (!cfg) return; await carregar(); desenhar(); },
    _m: function (d) { if (d === 0) { var h = new Date(); mes = new Date(h.getFullYear(), h.getMonth(), 1); } else mes = new Date(mes.getFullYear(), mes.getMonth() + d, 1); desenhar(); },
    _novo: function () { formulario(null); }, _ed: function (id) { var e = eventos[id]; if (e) { e.id = id; visiveis(); formulario(e); } }, _imp: importar, _fechar: fechar,
    _dia: function (di) {
      var evs = visiveis().filter(function (e) { return noDia(e, di); }), marc = (root.V2_PESSOAS ? root.V2_PESSOAS.eventosDoAno(marcas, +di.slice(0, 4)) : []).filter(function (x) { return x.data === di; });
      var d = $('v2cDia'); if (!d) return;
      d.innerHTML = '<div class="v2c-sec">' + dBR(di) + '</div>' + (evs.length || marc.length ? evs.map(item).join('') + marc.map(function (x) { return '<div class="v2c-it" style="border-left-color:#f9a825"><div class="q">' + esc(x.titulo) + '</div></div>'; }).join('') : '<div style="opacity:.7;font-size:13px">Nada neste dia.</div>');
      d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    abrirNaSecao: function (secao, container) { try { if (new URLSearchParams(location.search).get('view') === '1') return; } catch (e) {} if (cfg && cfg.container === container && cfg.secao === secao && $(container) && $(container).firstChild) return root.V2_CAL.atualizar(); return root.V2_CAL.montar({ container: container, secao: secao }); },
    _parse: parseDatas, _extrair: extrair
  };
})(typeof window !== 'undefined' ? window : globalThis);
