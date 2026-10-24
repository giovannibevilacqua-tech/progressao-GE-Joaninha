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
