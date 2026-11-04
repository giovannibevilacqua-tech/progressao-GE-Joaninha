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
    { id: 'lobinho', nome: 'Lobinho', icone: '🐺' },
    { id: 'escoteira', nome: 'Escoteiro', icone: '🏕️', ativo: true, ficha: 'escoteiro', frame: 'iframeEscoteira', secao: 'escoteira' },
    { id: 'senior', nome: 'Sênior', icone: '🎓', ativo: true, ficha: 'senior', frame: 'iframeSenior', secao: 'senior' },
    { id: 'pioneiro', nome: 'Pioneiro', icone: '🔥' },
    { id: 'dirigente', nome: 'Dirigente', icone: '🏛️' }
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
  var E = { ramo: null, arquivos: [], linhas: [], ignorados: 0, erros: [], estado: null, ocupado: false };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function dataBr(iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; }

  function abrir() {
    E = { ramo: null, arquivos: [], linhas: [], ignorados: 0, erros: [], estado: null, ocupado: false };
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
    h += '<div id="paxtuMsg"></div><button type="button" class="btn-primario paxtu-acao" ' + (E.ramo && E.arquivos.length ? '' : 'disabled') + ' onclick="ImportarPaxtu.ler()">Ler fichas</button>';
    $('paxtuModalBody').innerHTML = h;
  }
  function msg(t, erro) { var m = $('paxtuMsg'); if (m) m.innerHTML = t ? '<div class="paxtu-msg' + (erro ? ' erro' : '') + '" role="status">' + esc(t) + '</div>' : ''; }

  var pdfPronto = null;
  function carregarPdf() {
    if (!pdfPronto) pdfPronto = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = 'vendor/pdfjs/pdf.min.js';
      s.onload = function () { root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; ok(root.pdfjsLib); };
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
    if (!f.getAttribute('src')) f.src = root.V2.pagina(ramo.secao === 'senior' ? 'tropa-senior' : 'escoteira');
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
    } catch (e) {
      console.error(e); E.ocupado = false; if (btn) btn.disabled = false;
      msg(/HTTP (401|403)/.test(String(e.message)) ? 'O banco recusou a gravação. A importação foi cancelada: é preciso liberar a área de dados do Paxtu nas regras do Firebase.' : (e.message || 'Não foi possível gravar.'), true);
    }
  }
  var api = {
    abrir: abrir, fechar: fechar, ler: ler, gravar: gravar, voltar: function () { E.linhas = []; telaInicio(); },
    escolher: function (r) { E.ramo = r; telaInicio(); },
    arquivos: function (l) { E.arquivos = Array.prototype.slice.call(l || []); telaInicio(); },
    marcar: function (i, v) { E.linhas[i].marcado = v; telaPrevia(); },
    vincular: function (i, v) { E.linhas[i].id = v || null; telaPrevia(); },
    lerFichas: lerFichas, ehJovem: ehJovem, nomeBonito: nomeBonito, acharJovem: acharJovem, RAMOS: RAMOS
  };
  root.ImportarPaxtu = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
