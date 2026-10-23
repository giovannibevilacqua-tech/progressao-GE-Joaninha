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

  LIMITE_ANEXO_MB: 3
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
    var cache = null, baseFlat = {}, carregou = false, bloqueado = false;
    var es = null, fila = Promise.resolve(), salvando = 0, sujo = false, timerAp = null, fechado = false;

    function token() { return (o.getToken ? o.getToken() : null) || auth.getToken(); }
    function renovar() { return o.renovarToken ? o.renovarToken() : (auth.renovar ? auth.renovar() : Promise.resolve()); }
    function url(sub) {
      var t = token();
      return raiz + (sub || '') + '.json' + (t ? '?auth=' + encodeURIComponent(t) : '');
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
          return lerCache();
        } catch (e) { ultimo = e; await sleep(1200 * i); }
      }
      bloqueado = true;
      throw ultimo;
    }

    function aplicarRemoto() {
      if (fechado) return;
      if (salvando > 0 || (o.temPendente && o.temPendente())) { sujo = true; return; }
      sujo = false;
      var dados = cache ? decDados(cache, ids) : null;
      var novoFlat = cache ? flatten(encDados(dados, ids)) : {};
      if (iguaisFlat(novoFlat, baseFlat)) return; // nada mudou de verdade (eco do próprio salvamento)
      baseFlat = novoFlat;
      if (o.onDados) o.onDados(dados, false);
    }
    function agendar() { clearTimeout(timerAp); timerAp = setTimeout(aplicarRemoto, 40); }

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
      if (o.onDados) o.onDados(dados, true);
      if (o.stream && !bloqueado) abrirStream();
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
      if (!d.nSets && !d.nDels) return { sets: 0, dels: 0 };
      var ultimo;
      for (var t = 1; t <= 3; t++) {
        try {
          if (d.nDels) await enviar(d.dels);   // primeiro apaga, depois grava (evita caminhos sobrepostos)
          if (d.nSets) await enviar(d.sets);
          baseFlat = novo;
          return { sets: d.nSets, dels: d.nDels };
        } catch (e) { ultimo = e; if (t < 3) await sleep(800); }
      }
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
      iniciar: iniciar, carregar: carregar, salvar: salvar,
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
  function pagina(nome) { return nome + (CFG.SUFIXO || '') + '.html'; }

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

  root.V2 = {
    CFG: CFG, escKey: escKey, unescKey: unescKey, enc: enc, dec: dec, encDados: encDados, decDados: decDados, decCampo: decCampo,
    flatten: flatten, diff: diff, canon: canon, canonStr: canonStr, setAt: setAt, podar: podar, aplicarMulti: aplicarMulti,
    configurarAuth: configurarAuth, criarStore: criarStore,
    subirAnexo: subirAnexo, garantirAnexos: garantirAnexos, removerAnexo: removerAnexo, baixarAnexo: baixarAnexo,
    ehAnexoInline: ehAnexoInline, gravarAnexo: gravarAnexo, urlAnexoDb: urlAnexoDb, nomeSeguro: nomeSeguro,
    comEspera: comEspera, pagina: pagina, sleep: sleep, fetchTimeout: fetchTimeout
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.V2;
})(typeof window !== 'undefined' ? window : globalThis);
