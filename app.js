/* Jogo do Impostor — passa-e-joga em um único aparelho.
 *
 * Fluxo de uma rodada:
 *   config → revelacao → dicas → votacao → [chute] → resultado
 *
 * O impostor recebe uma palavra parecida com a dos demais e não é avisado de
 * nada: ele só descobre que era o impostor quando o grupo aponta o dedo.
 */

(function () {
  'use strict';

  var CHAVE_ARMAZENAMENTO = 'impostor:estado:v1';
  var MIN_JOGADORES = 3;
  var MAX_JOGADORES = 8;

  // ── Estado ───────────────────────────────────────────────────────────────
  var estado = estadoInicial();
  var cronometro = { id: null, restante: 0, total: 0, rodando: false };

  function estadoInicial() {
    return {
      fase: 'config',
      jogadores: [
        { nome: 'Jogador 1', pontos: 0 },
        { nome: 'Jogador 2', pontos: 0 },
        { nome: 'Jogador 3', pontos: 0 },
        { nome: 'Jogador 4', pontos: 0 },
      ],
      config: {
        categorias: Object.keys(CATEGORIAS),
        cronometro: true,
        segundos: 120,
        chuteFinal: true,
      },
      paresUsados: [],
      rodada: null,
    };
  }

  function rodadaInicial() {
    return {
      categoriaId: null,
      palavraComum: '',
      palavraImpostor: '',
      impostorIdx: -1,
      ordemFala: [],
      votanteIdx: 0,
      votos: {},          // índice do votante → índice do votado
      candidatos: null,   // em revotação, quem ainda pode receber voto
      revotacao: false,
      eliminadoIdx: null,
      opcoesChute: null,
      chuteCerto: null,
      vencedor: null,     // 'grupo' | 'impostor'
    };
  }

  // ── Atalhos de DOM ───────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function mostrarTela(nome) {
    var telas = document.querySelectorAll('.tela');
    for (var i = 0; i < telas.length; i++) telas[i].classList.remove('ativa');
    $('tela-' + nome).classList.add('ativa');
    window.scrollTo(0, 0);
  }

  function vibrar(padrao) {
    if (navigator.vibrate) navigator.vibrate(padrao);
  }

  // ── Persistência ─────────────────────────────────────────────────────────
  function salvar() {
    try {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(estado));
    } catch (e) {
      /* modo privado ou armazenamento cheio: o jogo segue sem persistir */
    }
  }

  function carregar() {
    var bruto;
    try {
      bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    } catch (e) {
      return;
    }
    if (!bruto) return;

    var salvo;
    try {
      salvo = JSON.parse(bruto);
    } catch (e) {
      return;
    }
    if (!salvo || !Array.isArray(salvo.jogadores) || salvo.jogadores.length < MIN_JOGADORES) return;

    // Categorias que sumiram do banco de palavras não podem voltar do disco.
    var categorias = (salvo.config && salvo.config.categorias || []).filter(function (id) {
      return Object.prototype.hasOwnProperty.call(CATEGORIAS, id);
    });
    if (!categorias.length) categorias = Object.keys(CATEGORIAS);

    estado = {
      fase: salvo.fase || 'config',
      jogadores: salvo.jogadores.slice(0, MAX_JOGADORES).map(function (j) {
        return { nome: String(j.nome || ''), pontos: Number(j.pontos) || 0 };
      }),
      config: {
        categorias: categorias,
        cronometro: salvo.config ? !!salvo.config.cronometro : true,
        segundos: (salvo.config && Number(salvo.config.segundos)) || 120,
        chuteFinal: salvo.config ? !!salvo.config.chuteFinal : true,
      },
      paresUsados: Array.isArray(salvo.paresUsados) ? salvo.paresUsados : [],
      rodada: salvo.rodada || null,
    };

    if (estado.fase !== 'config' && !estado.rodada) estado.fase = 'config';
  }

  // ── Sorteios ─────────────────────────────────────────────────────────────
  function embaralhar(lista) {
    var copia = lista.slice();
    for (var i = copia.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copia[i];
      copia[i] = copia[j];
      copia[j] = tmp;
    }
    return copia;
  }

  function sortear(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }

  // Junta os pares de todas as categorias escolhidas, evitando repetir pares
  // já usados na partida — quando esgotam, a lista de usados recomeça.
  function sortearPar() {
    var disponiveis = [];
    var todos = [];

    estado.config.categorias.forEach(function (catId) {
      CATEGORIAS[catId].pares.forEach(function (par, i) {
        var item = { chave: catId + ':' + i, categoriaId: catId, par: par };
        todos.push(item);
        if (estado.paresUsados.indexOf(item.chave) === -1) disponiveis.push(item);
      });
    });

    if (!disponiveis.length) {
      estado.paresUsados = [];
      disponiveis = todos;
    }

    var escolhido = sortear(disponiveis);
    estado.paresUsados.push(escolhido.chave);

    // Qualquer um dos dois lados pode ser a palavra do grupo.
    var par = Math.random() < 0.5 ? escolhido.par : [escolhido.par[1], escolhido.par[0]];
    return { categoriaId: escolhido.categoriaId, comum: par[0], impostor: par[1] };
  }

  // Ordem de fala embaralhada, mas nunca começando pelo impostor: quem abre
  // não tem dica nenhuma para se apoiar, e isso entregaria o jogo cedo demais.
  function sortearOrdemFala(qtd, impostorIdx) {
    var ordem;
    do {
      ordem = embaralhar(indices(qtd));
    } while (ordem[0] === impostorIdx);
    return ordem;
  }

  function indices(qtd) {
    var lista = [];
    for (var i = 0; i < qtd; i++) lista.push(i);
    return lista;
  }

  // ── Tela de configuração ─────────────────────────────────────────────────
  function renderJogadores() {
    var lista = $('jogadores-lista');
    lista.innerHTML = '';

    estado.jogadores.forEach(function (jogador, i) {
      var linha = document.createElement('div');
      linha.className = 'jogador-campo';

      var numero = document.createElement('span');
      numero.className = 'jogador-numero';
      numero.textContent = (i + 1) + '.';

      var input = document.createElement('input');
      input.type = 'text';
      input.value = jogador.nome;
      input.maxLength = 20;
      input.placeholder = 'Jogador ' + (i + 1);
      input.setAttribute('aria-label', 'Nome do jogador ' + (i + 1));
      input.addEventListener('input', function () {
        estado.jogadores[i].nome = input.value;
      });

      linha.appendChild(numero);
      linha.appendChild(input);
      lista.appendChild(linha);
    });

    $('btn-remover-jogador').disabled = estado.jogadores.length <= MIN_JOGADORES;
    $('btn-adicionar-jogador').disabled = estado.jogadores.length >= MAX_JOGADORES;
    $('dica-jogadores').textContent =
      estado.jogadores.length + ' jogadores (' + MIN_JOGADORES + ' a ' + MAX_JOGADORES + ').';
  }

  function renderCategorias() {
    var grade = $('categorias-grade');
    grade.innerHTML = '';

    Object.keys(CATEGORIAS).forEach(function (id) {
      var categoria = CATEGORIAS[id];
      var marcada = estado.config.categorias.indexOf(id) !== -1;

      var rotulo = document.createElement('label');
      rotulo.className = 'categoria' + (marcada ? ' marcada' : '');

      var caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = marcada;
      caixa.addEventListener('change', function () {
        var pos = estado.config.categorias.indexOf(id);
        if (caixa.checked && pos === -1) estado.config.categorias.push(id);
        if (!caixa.checked && pos !== -1) estado.config.categorias.splice(pos, 1);
        rotulo.classList.toggle('marcada', caixa.checked);
        atualizarDicaCategorias();
      });

      var texto = document.createElement('span');
      texto.textContent = categoria.emoji + ' ' + categoria.nome;

      rotulo.appendChild(caixa);
      rotulo.appendChild(texto);
      grade.appendChild(rotulo);
    });

    atualizarDicaCategorias();
  }

  function atualizarDicaCategorias() {
    var total = estado.config.categorias.reduce(function (soma, id) {
      return soma + CATEGORIAS[id].pares.length;
    }, 0);
    $('dica-categorias').textContent = total
      ? total + ' pares de palavras disponíveis.'
      : 'Escolha pelo menos uma categoria.';
  }

  function renderConfig() {
    renderJogadores();
    renderCategorias();
    $('opt-cronometro').checked = estado.config.cronometro;
    $('opt-chute').checked = estado.config.chuteFinal;
    $('opt-minutos').value = String(estado.config.segundos);
    $('detalhe-cronometro').hidden = !estado.config.cronometro;
    $('erro-config').hidden = true;
  }

  function normalizarNomes() {
    var vistos = {};
    var duplicado = false;

    estado.jogadores.forEach(function (jogador, i) {
      var nome = jogador.nome.trim().replace(/\s+/g, ' ');
      if (!nome) nome = 'Jogador ' + (i + 1);
      jogador.nome = nome;

      var chave = nome.toLowerCase();
      if (vistos[chave]) duplicado = true;
      vistos[chave] = true;
    });

    return !duplicado;
  }

  function comecarRodada() {
    var erro = $('erro-config');

    if (!estado.config.categorias.length) {
      erro.textContent = 'Escolha pelo menos uma categoria de palavras.';
      erro.hidden = false;
      return;
    }
    if (!normalizarNomes()) {
      renderJogadores();
      erro.textContent = 'Dois jogadores estão com o mesmo nome. Deixe cada um diferente.';
      erro.hidden = false;
      return;
    }

    erro.hidden = true;
    novaRodada();
  }

  function novaRodada() {
    var par = sortearPar();
    var rodada = rodadaInicial();

    rodada.categoriaId = par.categoriaId;
    rodada.palavraComum = par.comum;
    rodada.palavraImpostor = par.impostor;
    rodada.impostorIdx = Math.floor(Math.random() * estado.jogadores.length);
    rodada.ordemFala = sortearOrdemFala(estado.jogadores.length, rodada.impostorIdx);
    rodada.revelacaoIdx = 0;

    estado.rodada = rodada;
    irPara('revelacao');
  }

  // ── Revelação ────────────────────────────────────────────────────────────
  function renderRevelacao() {
    var idx = estado.rodada.revelacaoIdx;
    var total = estado.jogadores.length;

    $('revelacao-contador').textContent = (idx + 1) + ' de ' + total;
    $('revelacao-nome').textContent = estado.jogadores[idx].nome;
    $('cartao-texto').textContent = palavraDe(idx);
    fecharCartao();
    $('btn-revelacao-proximo').disabled = true;
    $('btn-revelacao-proximo').textContent =
      idx === total - 1 ? 'Já vi, começar as dicas' : 'Já vi, passar o celular';
  }

  function palavraDe(idx) {
    return idx === estado.rodada.impostorIdx
      ? estado.rodada.palavraImpostor
      : estado.rodada.palavraComum;
  }

  function abrirCartao() {
    $('cartao-palavra').classList.add('aberto');
    $('cartao-oculto').hidden = true;
    $('cartao-revelado').hidden = false;
    $('btn-revelacao-proximo').disabled = false;
  }

  function fecharCartao() {
    $('cartao-palavra').classList.remove('aberto');
    $('cartao-oculto').hidden = false;
    $('cartao-revelado').hidden = true;
  }

  function avancarRevelacao() {
    if (estado.rodada.revelacaoIdx < estado.jogadores.length - 1) {
      estado.rodada.revelacaoIdx += 1;
      salvar();
      renderRevelacao();
    } else {
      irPara('dicas');
    }
  }

  // ── Dicas ────────────────────────────────────────────────────────────────
  function renderDicas() {
    var ordem = $('ordem-fala');
    ordem.innerHTML = '';

    estado.rodada.ordemFala.forEach(function (idx) {
      var item = document.createElement('li');
      item.textContent = estado.jogadores[idx].nome;
      ordem.appendChild(item);
    });

    var caixa = $('cronometro');
    caixa.hidden = !estado.config.cronometro;
    if (estado.config.cronometro) reiniciarCronometro();
  }

  function reiniciarCronometro() {
    pararCronometro();
    cronometro.total = estado.config.segundos;
    cronometro.restante = estado.config.segundos;
    $('btn-cronometro').textContent = 'Iniciar discussão';
    pintarCronometro();
  }

  function pintarCronometro() {
    var minutos = Math.floor(cronometro.restante / 60);
    var segundos = cronometro.restante % 60;
    var tempo = $('cronometro-tempo');

    tempo.textContent = minutos + ':' + (segundos < 10 ? '0' : '') + segundos;
    tempo.classList.toggle('acabando', cronometro.restante <= 10);
    $('cronometro-preenchimento').style.width =
      (cronometro.total ? (cronometro.restante / cronometro.total) * 100 : 0) + '%';
  }

  function alternarCronometro() {
    if (cronometro.rodando) {
      pararCronometro();
      $('btn-cronometro').textContent = 'Continuar';
      return;
    }
    if (cronometro.restante <= 0) cronometro.restante = cronometro.total;

    cronometro.rodando = true;
    $('btn-cronometro').textContent = 'Pausar';
    cronometro.id = setInterval(function () {
      cronometro.restante -= 1;
      pintarCronometro();
      if (cronometro.restante <= 0) {
        pararCronometro();
        $('btn-cronometro').textContent = 'Tempo esgotado — reiniciar';
        vibrar([200, 100, 200]);
      }
    }, 1000);
  }

  function pararCronometro() {
    if (cronometro.id) clearInterval(cronometro.id);
    cronometro.id = null;
    cronometro.rodando = false;
  }

  // ── Votação ──────────────────────────────────────────────────────────────
  function renderVotacao() {
    var rodada = estado.rodada;
    var votante = rodada.votanteIdx;

    $('votacao-contador').textContent = (votante + 1) + ' de ' + estado.jogadores.length;
    $('votacao-nome').textContent = estado.jogadores[votante].nome;
    $('votacao-instrucao').textContent = rodada.revotacao
      ? 'Empate! Vote de novo, agora só entre os mais votados.'
      : 'Quem você acha que é o impostor?';

    var opcoes = $('voto-opcoes');
    opcoes.innerHTML = '';

    alvosPermitidos(votante).forEach(function (idx) {
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'voto-opcao';
      botao.textContent = estado.jogadores[idx].nome;
      botao.addEventListener('click', function () { registrarVoto(idx); });
      opcoes.appendChild(botao);
    });
  }

  // Ninguém vota em si mesmo; na revotação, só os empatados podem ser votados.
  function alvosPermitidos(votante) {
    var base = estado.rodada.candidatos || indices(estado.jogadores.length);
    return base.filter(function (idx) { return idx !== votante; });
  }

  function registrarVoto(alvoIdx) {
    var rodada = estado.rodada;
    rodada.votos[rodada.votanteIdx] = alvoIdx;
    vibrar(30);

    if (rodada.votanteIdx < estado.jogadores.length - 1) {
      rodada.votanteIdx += 1;
      salvar();
      renderVotacao();
    } else {
      apurarVotos();
    }
  }

  function contarVotos() {
    var contagem = {};
    Object.keys(estado.rodada.votos).forEach(function (votante) {
      var alvo = estado.rodada.votos[votante];
      contagem[alvo] = (contagem[alvo] || 0) + 1;
    });
    return contagem;
  }

  function maisVotados(contagem) {
    var maior = 0;
    Object.keys(contagem).forEach(function (idx) {
      if (contagem[idx] > maior) maior = contagem[idx];
    });
    return Object.keys(contagem)
      .filter(function (idx) { return contagem[idx] === maior; })
      .map(Number);
  }

  function apurarVotos() {
    var rodada = estado.rodada;
    var lideres = maisVotados(contarVotos());

    if (lideres.length > 1) {
      if (!rodada.revotacao) {
        // Primeiro empate: uma revotação restrita aos empatados.
        rodada.revotacao = true;
        rodada.candidatos = lideres;
        rodada.votos = {};
        rodada.votanteIdx = 0;
        salvar();
        renderVotacao();
        return;
      }
      // Empate de novo: o grupo não se decide e o impostor escapa.
      rodada.eliminadoIdx = null;
      return finalizar('impostor');
    }

    rodada.eliminadoIdx = lideres[0];

    if (rodada.eliminadoIdx !== rodada.impostorIdx) return finalizar('impostor');
    if (estado.config.chuteFinal) return irPara('chute');
    return finalizar('grupo');
  }

  // ── Chute final ──────────────────────────────────────────────────────────
  function renderChute() {
    var rodada = estado.rodada;

    if (!rodada.opcoesChute) rodada.opcoesChute = montarOpcoesChute();
    $('chute-nome').textContent = estado.jogadores[rodada.impostorIdx].nome;

    var opcoes = $('chute-opcoes');
    opcoes.innerHTML = '';

    rodada.opcoesChute.forEach(function (palavra) {
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'voto-opcao';
      botao.textContent = palavra;
      botao.addEventListener('click', function () {
        rodada.chuteCerto = palavra === rodada.palavraComum;
        finalizar(rodada.chuteCerto ? 'impostor' : 'grupo');
      });
      opcoes.appendChild(botao);
    });
  }

  // A palavra certa mais três iscas da mesma categoria.
  function montarOpcoesChute() {
    var rodada = estado.rodada;
    var candidatas = [];

    CATEGORIAS[rodada.categoriaId].pares.forEach(function (par) {
      par.forEach(function (palavra) {
        if (palavra !== rodada.palavraComum && palavra !== rodada.palavraImpostor) {
          candidatas.push(palavra);
        }
      });
    });

    return embaralhar([rodada.palavraComum].concat(embaralhar(candidatas).slice(0, 3)));
  }

  // ── Resultado ────────────────────────────────────────────────────────────
  function finalizar(vencedor) {
    var rodada = estado.rodada;
    rodada.vencedor = vencedor;

    if (vencedor === 'impostor') {
      estado.jogadores[rodada.impostorIdx].pontos += 2;
    } else {
      estado.jogadores.forEach(function (jogador, i) {
        if (i !== rodada.impostorIdx) jogador.pontos += 1;
      });
    }

    irPara('resultado');
  }

  function renderResultado() {
    var rodada = estado.rodada;
    var impostor = estado.jogadores[rodada.impostorIdx];

    var veredito = $('veredito');
    veredito.className = 'veredito ' + rodada.vencedor;
    veredito.textContent = textoVeredito();

    $('resultado-impostor').textContent = impostor.nome;
    $('resultado-palavra-comum').textContent = rodada.palavraComum;
    $('resultado-palavra-impostor').textContent = rodada.palavraImpostor;

    renderVotos();
    renderPlacar();
  }

  function textoVeredito() {
    var rodada = estado.rodada;

    if (rodada.chuteCerto === true) {
      return '🎭 Descoberto, mas acertou a palavra do grupo e roubou a vitória!';
    }
    if (rodada.vencedor === 'grupo') {
      return '🎉 O grupo desmascarou o impostor!';
    }
    if (rodada.eliminadoIdx === null) {
      return '🕵️ Empate atrás de empate — o impostor escapou!';
    }
    return '🕵️ O grupo acusou ' + estado.jogadores[rodada.eliminadoIdx].nome +
      ' e o impostor escapou!';
  }

  function renderVotos() {
    var contagem = contarVotos();
    var lista = $('votos-lista');
    lista.innerHTML = '';

    estado.jogadores.forEach(function (jogador, i) {
      var votantes = Object.keys(estado.rodada.votos)
        .filter(function (votante) { return estado.rodada.votos[votante] === i; })
        .map(function (votante) { return estado.jogadores[votante].nome; });

      if (!votantes.length) return;

      var item = document.createElement('li');

      var alvo = document.createElement('span');
      alvo.textContent = jogador.nome + ' · ' + contagem[i] +
        (contagem[i] === 1 ? ' voto' : ' votos');

      var quem = document.createElement('span');
      quem.className = 'votos-quem';
      quem.textContent = votantes.join(', ');

      item.appendChild(alvo);
      item.appendChild(quem);
      lista.appendChild(item);
    });

    if (!lista.children.length) {
      var vazio = document.createElement('li');
      vazio.textContent = 'Ninguém votou.';
      lista.appendChild(vazio);
    }
  }

  function renderPlacar() {
    var placar = $('placar');
    placar.innerHTML = '';

    estado.jogadores
      .map(function (jogador, i) { return { jogador: jogador, i: i }; })
      .sort(function (a, b) { return b.jogador.pontos - a.jogador.pontos; })
      .forEach(function (item) {
        var linha = document.createElement('li');
        if (item.i === estado.rodada.impostorIdx) linha.className = 'foi-impostor';

        var nome = document.createElement('span');
        nome.className = 'placar-nome';
        nome.textContent = item.jogador.nome +
          (item.i === estado.rodada.impostorIdx ? ' 🎭' : '');

        var pontos = document.createElement('span');
        pontos.className = 'placar-pontos';
        pontos.textContent = item.jogador.pontos +
          (item.jogador.pontos === 1 ? ' pt' : ' pts');

        linha.appendChild(nome);
        linha.appendChild(pontos);
        placar.appendChild(linha);
      });
  }

  function encerrarPartida() {
    pararCronometro();
    estado.jogadores.forEach(function (jogador) { jogador.pontos = 0; });
    estado.paresUsados = [];
    estado.rodada = null;
    irPara('config');
  }

  // ── Navegação ────────────────────────────────────────────────────────────
  function irPara(fase) {
    if (fase !== 'dicas') pararCronometro();
    estado.fase = fase;
    salvar();
    render();
  }

  function render() {
    switch (estado.fase) {
      case 'revelacao': renderRevelacao(); break;
      case 'dicas': renderDicas(); break;
      case 'votacao': renderVotacao(); break;
      case 'chute': renderChute(); break;
      case 'resultado': renderResultado(); break;
      default: renderConfig(); break;
    }
    mostrarTela(estado.fase);
  }

  // ── Ligações de eventos ──────────────────────────────────────────────────
  function ligarEventos() {
    $('btn-adicionar-jogador').addEventListener('click', function () {
      if (estado.jogadores.length >= MAX_JOGADORES) return;
      estado.jogadores.push({ nome: 'Jogador ' + (estado.jogadores.length + 1), pontos: 0 });
      renderJogadores();
    });

    $('btn-remover-jogador').addEventListener('click', function () {
      if (estado.jogadores.length <= MIN_JOGADORES) return;
      estado.jogadores.pop();
      renderJogadores();
    });

    $('opt-cronometro').addEventListener('change', function () {
      estado.config.cronometro = this.checked;
      $('detalhe-cronometro').hidden = !this.checked;
    });

    $('opt-minutos').addEventListener('change', function () {
      estado.config.segundos = Number(this.value);
    });

    $('opt-chute').addEventListener('change', function () {
      estado.config.chuteFinal = this.checked;
    });

    $('btn-comecar').addEventListener('click', comecarRodada);

    // Cartão: a palavra só fica visível enquanto o dedo está pressionado.
    var cartao = $('cartao-palavra');
    cartao.addEventListener('pointerdown', function (e) { e.preventDefault(); abrirCartao(); });
    cartao.addEventListener('pointerup', fecharCartao);
    cartao.addEventListener('pointercancel', fecharCartao);
    cartao.addEventListener('pointerleave', fecharCartao);
    cartao.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cartao.addEventListener('click', function (e) { e.preventDefault(); });
    cartao.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); abrirCartao(); }
    });
    cartao.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') fecharCartao();
    });
    cartao.addEventListener('blur', fecharCartao);

    $('btn-revelacao-proximo').addEventListener('click', avancarRevelacao);
    $('btn-ir-votacao').addEventListener('click', function () { irPara('votacao'); });
    $('btn-cronometro').addEventListener('click', alternarCronometro);
    $('btn-nova-rodada').addEventListener('click', novaRodada);
    $('btn-encerrar').addEventListener('click', encerrarPartida);
  }

  carregar();
  ligarEventos();
  render();
})();
