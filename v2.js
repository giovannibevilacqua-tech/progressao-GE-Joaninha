/* ===== Service worker (modo instalável): o próprio v2.js é registrado como service worker; nas páginas esse trecho não roda ===== */
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.window = self; // o resto do arquivo só define funções; nada aqui usa a tela
  // Guarda uma cópia dos arquivos do app para abrir mesmo sem internet.
  // Sempre tenta a internet primeiro (assim as atualizações chegam); só usa a cópia se estiver offline.
  const CACHE = 'joaninha-app-v1';
  const BASE = ['./', 'index.html', 'tropa-senior.html', 'visualizacao.html', 'v2.js', 'manifest.webmanifest'];

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
      fetch(r).then((res) => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); }
        return res;
      }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('index.html')))
    );
  });

}

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
  VERSAO: "2026-10-23f"
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
    var sets = {}, dels = {}, ns = 0, nd = 0;
    Object.keys(novo).forEach(function (k) { if (!(k in base) || base[k] !== novo[k]) { sets[k] = novo[k]; ns++; } });
    Object.keys(base).forEach(function (k) { if (!(k in novo)) { dels[k] = null; nd++; } });
    return { sets: sets, dels: dels, nSets: ns, nDels: nd };
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
          var r = await fetchTimeout(url(''), {}, 10000);
          if (r.status === 401 || r.status === 403) { try { await renovar(); } catch (e) {} throw new Error('HTTP ' + r.status); }
          if (!r.ok) throw new Error('HTTP ' + r.status);
          cache = await r.json();
          if (cache && typeof cache !== 'object') cache = null;
          carregou = true;
          try { localStorage.setItem('v2cache_' + o.node, JSON.stringify(cache)); } catch (e) {}
          return lerCache();
        } catch (e) { ultimo = e; await sleep(1200 * i); }
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
            if (o.onModoOffline) o.onModoOffline(); else if (o.onModoLeitura) o.onModoLeitura();
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

  /* ---------- histórico de alterações ---------- */
  var ROTULOS = {
    S: 'Progressão', PRESENCA: 'Presença', eventos: 'Calendário', ciclo: 'Ciclo de programa', cicloInfo: 'Ciclo de programa',
    cicloDestaque: 'Ciclo de programa', patrulhas: 'Patrulhas', patrulhaDe: 'Patrulhas', cargoDe: 'Cargos', observacoes: 'Observações',
    datasNascimento: 'Datas de nascimento', justificativas: 'Justificativas', JUSTIFICATIVAS_SR: 'Justificativas', nomesBase: 'Nomes',
    extraJovens: 'Jovens', excluidos: 'Jovens', arquivados: 'Jovens', JOVENS: 'Jovens', JNOMES: 'Jovens', JCORES: 'Jovens', YOUTH_DATA: 'Jovens',
    lisOuroDe: 'Lis de Ouro', conversarCom: 'Conversar com', EP_DATA: 'Especialidades', CAL_EXTRAS: 'Calendário', CAL_2S26: 'Calendário',
    CAL_1S27: 'Calendário', METAS_SR: 'Metas', CICLO_BLOCOS_SR: 'Ciclo de programa', PATRULHAS_SR: 'Patrulhas', PATRULHA_DE_SR: 'Patrulhas',
    SEMESTRES_SR: 'Semestres', semAbertoSr: 'Semestres'
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
  async function registrarHistorico(tropa, por, nome, resumo, n) {
    if (!resumo) return;
    try {
      await fetch(urlV2('historico/' + tropa), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ em: new Date().toISOString(), por: String(por || ''), nome: nome || '', resumo: resumo, n: n || 0 }) });
    } catch (e) {}
  }
  async function lerHistorico(qtd) {
    var tudo = [];
    for (var t of ['escoteira', 'senior']) {
      try {
        var r = await fetch(urlV2('historico/' + t, 'orderBy=%22%24key%22&limitToLast=' + (qtd || 60)));
        var o = (await r.json()) || {};
        Object.keys(o).forEach(function (k) { var e = o[k]; if (e && e.em) { e.tropa = t; tudo.push(e); } });
      } catch (e) {}
    }
    tudo.sort(function (a, b) { return a.em < b.em ? 1 : -1; });
    return tudo.slice(0, qtd || 60);
  }
  async function podarHistorico(manter) {
    manter = manter || 300;
    for (var t of ['escoteira', 'senior']) {
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
  // r = { tropa, nome, info:[[rotulo,valor]], resumo:{n,total,etapa}, eixos:[{nome,cor,feitos,total,blocos:[{nome,ok,detalhe}]}], presenca:{presentes,ausentes,total}|null }
  // Chame direto do clique (antes de qualquer espera) para o navegador não bloquear a janela.
  function abrirRelatorio(r) {
    var w = window.open('', '_blank');
    if (!w) { alert('O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.'); return; }
    var pct = r.resumo.total ? Math.round(r.resumo.n / r.resumo.total * 100) : 0;
    var hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    var h = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório — ' + escHtml(r.nome) + '</title><style>' +
      '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:24px;max-width:820px;margin:auto;font-size:13px;line-height:1.4}' +
      'header{border-bottom:3px solid #6D1026;padding-bottom:10px;margin-bottom:14px}h1{margin:0;font-size:22px;color:#6D1026}.sub{color:#666;font-size:12px;margin-top:2px}' +
      '.info{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin:12px 0}.info div span{color:#777}' +
      '.resumo{background:#F6EFEA;border-radius:8px;padding:12px 14px;margin:12px 0}.resumo b{font-size:16px}.barra{height:10px;background:#E4D9D0;border-radius:6px;margin-top:8px;overflow:hidden}.barra i{display:block;height:100%;background:#6D1026}' +
      '.eixo{margin-top:14px;break-inside:avoid}.eixo h2{font-size:14px;margin:0 0 6px;padding:6px 10px;border-radius:6px;color:#fff;display:flex;justify-content:space-between}' +
      'table{width:100%;border-collapse:collapse}td{padding:5px 8px;border-bottom:1px solid #EEE;vertical-align:top}td.s{width:26px;text-align:center;font-weight:bold}.ok{color:#1E8449}.pend{color:#B0A89F}td.d{color:#666;text-align:right;white-space:nowrap}' +
      'footer{margin-top:22px;border-top:1px solid #DDD;padding-top:8px;color:#888;font-size:11px}.btn{position:fixed;right:14px;top:14px;background:#6D1026;color:#fff;border:0;border-radius:20px;padding:10px 16px;font-size:13px;cursor:pointer}' +
      '@media print{.btn{display:none}body{padding:0}}@page{margin:14mm}</style></head><body>' +
      '<button class="btn" onclick="window.print()">🖨 Imprimir / Salvar como PDF</button>' +
      '<header><h1>' + escHtml(r.nome) + '</h1><div class="sub">' + escHtml(r.tropa) + ' · GE Joaninha · Relatório de progressão · ' + escHtml(hoje) + '</div></header>';
    if (r.info && r.info.length) h += '<div class="info">' + r.info.filter(function (i) { return i[1]; }).map(function (i) { return '<div><span>' + escHtml(i[0]) + ':</span> ' + escHtml(i[1]) + '</div>'; }).join('') + '</div>';
    h += '<div class="resumo"><b>' + r.resumo.n + ' de ' + r.resumo.total + ' blocos concluídos</b> (' + pct + '%)' + (r.resumo.etapa ? ' — etapa: <b>' + escHtml(r.resumo.etapa) + '</b>' : '') + '<div class="barra"><i style="width:' + pct + '%"></i></div></div>';
    if (r.presenca && r.presenca.total) {
      var pp = Math.round(r.presenca.presentes / r.presenca.total * 100);
      h += '<div class="resumo"><b>Presença:</b> ' + r.presenca.presentes + ' presença(s) em ' + r.presenca.total + ' atividade(s) com chamada (' + pp + '%)' + (r.presenca.ausentes ? ' · ' + r.presenca.ausentes + ' falta(s)' : '') + '</div>';
    }
    (r.eixos || []).forEach(function (e) {
      h += '<div class="eixo"><h2 style="background:' + escHtml(e.cor) + '"><span>' + escHtml(e.nome) + '</span><span>' + e.feitos + '/' + e.total + '</span></h2><table>' +
        e.blocos.map(function (b) { return '<tr><td class="s ' + (b.ok ? 'ok' : 'pend') + '">' + (b.ok ? '✓' : '○') + '</td><td>' + escHtml(b.nome) + '</td><td class="d">' + escHtml(b.detalhe) + '</td></tr>'; }).join('') + '</table></div>';
    });
    h += '<footer>Relatório gerado pelo sistema de progressão do GE Joaninha. Os dados refletem o que estava registrado no momento da emissão.</footer></body></html>';
    w.document.open(); w.document.write(h); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 500);
  }

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
  // Devolve { ciclo, pendentes:['escoteira','senior'] } ou null se não é hora / já foi tudo feito.
  async function lembreteBackup() {
    var ciclo = cicloBackup();
    if (!ciclo) return null;
    try {
      var r = await fetch(urlBackup(ciclo));
      if (!r.ok) return null;
      var feito = (await r.json()) || {};
      var pend = ['escoteira', 'senior'].filter(function (t) { return !feito[t]; });
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
    abrirRelatorio: abrirRelatorio,
    snapshot: snapshot, listarSnapshots: listarSnapshots, lerSnapshot: lerSnapshot, protegerAntes: protegerAntes,
    resumirDiff: resumirDiff, registrarHistorico: registrarHistorico, lerHistorico: lerHistorico, podarHistorico: podarHistorico, limparCacheLocal: limparCacheLocal, temPendenciaLocal: temPendenciaLocal,
    hashSenha: hashSenha, conferirSenha: conferirSenha, senhaComHash: senhaComHash,
    cicloBackup: cicloBackup, lembreteBackup: lembreteBackup, registrarBackup: registrarBackup,
    CFG: CFG, escKey: escKey, unescKey: unescKey, enc: enc, dec: dec, encDados: encDados, decDados: decDados, decCampo: decCampo,
    flatten: flatten, diff: diff, canon: canon, canonStr: canonStr, setAt: setAt, podar: podar, aplicarMulti: aplicarMulti,
    configurarAuth: configurarAuth, criarStore: criarStore,
    subirAnexo: subirAnexo, garantirAnexos: garantirAnexos, removerAnexo: removerAnexo, baixarAnexo: baixarAnexo,
    ehAnexoInline: ehAnexoInline, gravarAnexo: gravarAnexo, urlAnexoDb: urlAnexoDb, nomeSeguro: nomeSeguro,
    comEspera: comEspera, pagina: pagina, sleep: sleep, fetchTimeout: fetchTimeout
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
