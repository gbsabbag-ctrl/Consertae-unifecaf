// Consertaê — Assistente Inteligente de Serviços
// Fluxo: formulário -> objeto com os dados -> fetch() -> API -> JSON -> DOM

// =====================================================
// 1. CONFIGURAÇÃO
// =====================================================

// TODO: preencher com a URL do endpoint depois de publicar a API na Vercel
// (o caminho será /api/diagnostico). Enquanto estiver vazio, o site funciona
// em MODO SIMULAÇÃO, só para desenvolvimento e testes.
const API_URL = "";

const MODO_SIMULACAO = API_URL === "";
const TEMPO_LIMITE_MS = 15000; // tempo máximo de espera pela API

// =====================================================
// 2. DADOS (objetos e arrays simples)
// =====================================================

// Catálogo de serviços (manter igual ao do arquivo api/diagnostico.js)
const servicos = [
  { id: "bateria", nome: "Troca de bateria", descricao: "Substituição da bateria quando ela dura pouco, esquenta ou está inchada." },
  { id: "carregamento", nome: "Reparo de carregamento", descricao: "Conserto para quando o celular não carrega ou carrega só às vezes." },
  { id: "tela", nome: "Troca de tela", descricao: "Substituição de tela trincada, com manchas, listras ou sem imagem." },
  { id: "liquido", nome: "Avaliação de dano líquido", descricao: "Avaliação de celulares que molharam ou caíram na água." }
];

// Sintomas que o usuário pode escolher, com perguntas rápidas para cada um
const sintomas = [
  {
    id: "carregamento",
    rotulo: "Não carrega",
    perguntas: [
      { pergunta: "Você tentou outro cabo ou carregador?", opcoes: ["Sim", "Não"] },
      { pergunta: "O celular mostra algum sinal de que está carregando?", opcoes: ["Sim", "Não"] }
    ]
  },
  {
    id: "bateria",
    rotulo: "A bateria acaba rápido",
    perguntas: [
      { pergunta: "O celular esquenta mais do que o normal?", opcoes: ["Sim", "Não"] },
      { pergunta: "A bateria parece inchada?", opcoes: ["Sim", "Não"] }
    ]
  },
  {
    id: "tela",
    rotulo: "Problema na tela",
    perguntas: [
      { pergunta: "A tela está trincada ou quebrada?", opcoes: ["Sim", "Não"] },
      { pergunta: "A imagem aparece na tela?", opcoes: ["Sim", "Não"] }
    ]
  },
  {
    id: "liquido",
    rotulo: "Caiu na água ou molhou",
    perguntas: [
      { pergunta: "O celular liga normalmente?", opcoes: ["Sim", "Não"] },
      { pergunta: "O contato com líquido foi há menos de 24 horas?", opcoes: ["Sim", "Não"] }
    ]
  },
  {
    id: "outro",
    rotulo: "Outro problema",
    perguntas: []
  }
];

// Estado do diagnóstico
const estado = {
  rodada: 1,              // 1 = primeira análise, 2 = depois das perguntas extras
  perguntasExtras: [],    // perguntas devolvidas pela IA (insufficient_info)
  enviando: false,        // evita enviar duas vezes
  resumo: ""              // texto usado para preencher o formulário de contato
};

// =====================================================
// 3. ELEMENTOS DA PÁGINA
// =====================================================

const listaServicos = document.getElementById("lista-servicos");
const formulario = document.getElementById("form-diagnostico");
const campoMarca = document.getElementById("marca");
const campoModelo = document.getElementById("modelo");
const campoSintoma = document.getElementById("sintoma");
const campoDescricao = document.getElementById("descricao");
const blocoFixas = document.getElementById("perguntas-fixas");
const blocoExtras = document.getElementById("perguntas-extras");
const erroForm = document.getElementById("erro-form");
const botaoAnalisar = document.getElementById("botao-analisar");
const statusCarregamento = document.getElementById("status-carregamento");
const avisoSimulacao = document.getElementById("aviso-simulacao");
const secaoResultado = document.getElementById("resultado");
const corpoResultado = document.getElementById("resultado-corpo");
const formContato = document.getElementById("form-contato");
const campoContatoNome = document.getElementById("contato-nome");
const campoContatoMensagem = document.getElementById("contato-mensagem");
const statusContato = document.getElementById("contato-status");

// =====================================================
// 4. FUNÇÕES DE APOIO
// =====================================================

// Cria um elemento com texto (textContent não interpreta HTML: é mais seguro)
function criar(tag, texto, classe) {
  const elemento = document.createElement(tag);
  if (texto) {
    elemento.textContent = texto;
  }
  if (classe) {
    elemento.className = classe;
  }
  return elemento;
}

function buscarServico(id) {
  for (let i = 0; i < servicos.length; i++) {
    if (servicos[i].id === id) {
      return servicos[i];
    }
  }
  return null;
}

function buscarSintoma(id) {
  for (let i = 0; i < sintomas.length; i++) {
    if (sintomas[i].id === id) {
      return sintomas[i];
    }
  }
  return null;
}

// Evita enviar e-mail ou telefone para a IA
function contemDadoPessoal(texto) {
  const temEmail = /\S+@\S+\.\S+/.test(texto);
  const temNumeroLongo = /(\d[\s().-]?){8,}/.test(texto);
  return temEmail || temNumeroLongo;
}

// Cria os cards de serviços
function mostrarServicos() {
  for (let i = 0; i < servicos.length; i++) {
    const item = document.createElement("li");
    item.className = "card";
    item.appendChild(criar("h3", servicos[i].nome));
    item.appendChild(criar("p", servicos[i].descricao));
    listaServicos.appendChild(item);
  }
}

// Preenche o <select> com os sintomas
function preencherSintomas() {
  for (let i = 0; i < sintomas.length; i++) {
    const opcao = document.createElement("option");
    opcao.value = sintomas[i].id;
    opcao.textContent = sintomas[i].rotulo;
    campoSintoma.appendChild(opcao);
  }
}

// Desenha perguntas com opções (radio) dentro de um bloco
function desenharPerguntas(bloco, perguntas, prefixo) {
  bloco.replaceChildren();

  for (let i = 0; i < perguntas.length; i++) {
    const grupo = document.createElement("fieldset");
    grupo.appendChild(criar("legend", perguntas[i].pergunta));

    for (let j = 0; j < perguntas[i].opcoes.length; j++) {
      const id = prefixo + "-" + i + "-" + j;
      const linha = criar("div", "", "opcao");

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.id = id;
      radio.name = prefixo + "-" + i;
      radio.value = perguntas[i].opcoes[j];

      const rotulo = criar("label", perguntas[i].opcoes[j]);
      rotulo.setAttribute("for", id);

      linha.appendChild(radio);
      linha.appendChild(rotulo);
      grupo.appendChild(linha);
    }
    bloco.appendChild(grupo);
  }
}

// Lê as respostas marcadas. Devolve null se alguma pergunta ficou sem resposta.
function lerRespostas(bloco, perguntas, prefixo) {
  const respostas = [];

  for (let i = 0; i < perguntas.length; i++) {
    const marcada = bloco.querySelector('input[name="' + prefixo + "-" + i + '"]:checked');
    if (!marcada) {
      return null;
    }
    respostas.push({ pergunta: perguntas[i].pergunta, resposta: marcada.value });
  }
  return respostas;
}

function mostrarErroForm(mensagem, campo) {
  erroForm.textContent = mensagem;
  erroForm.hidden = false;
  if (campo) {
    campo.setAttribute("aria-invalid", "true");
    campo.focus();
  }
}

function limparErroForm() {
  erroForm.textContent = "";
  erroForm.hidden = true;
  const marcados = formulario.querySelectorAll('[aria-invalid="true"]');
  for (let i = 0; i < marcados.length; i++) {
    marcados[i].removeAttribute("aria-invalid");
  }
}

function definirCarregando(carregando) {
  estado.enviando = carregando;
  botaoAnalisar.disabled = carregando;
  formulario.setAttribute("aria-busy", carregando ? "true" : "false");
  statusCarregamento.textContent = carregando ? "Analisando as informações…" : "";
  botaoAnalisar.textContent = carregando
    ? "Analisando…"
    : (estado.rodada === 2 ? "Analisar novamente" : "Analisar");
}

// =====================================================
// 5. COLETA E VALIDAÇÃO DO FORMULÁRIO
// =====================================================

// Devolve { dados } se estiver tudo certo, ou { mensagem, campo } se houver erro
function montarDados() {
  const marca = campoMarca.value.trim();
  const modelo = campoModelo.value.trim();
  const sintoma = buscarSintoma(campoSintoma.value);
  const descricao = campoDescricao.value.trim();

  if (marca === "") {
    return { mensagem: "Informe a marca do celular.", campo: campoMarca };
  }
  if (modelo === "") {
    return { mensagem: "Informe o modelo do celular.", campo: campoModelo };
  }
  if (sintoma === null) {
    return { mensagem: "Escolha o que está acontecendo.", campo: campoSintoma };
  }
  if (descricao.length < 5) {
    return { mensagem: "Descreva o problema com pelo menos 5 caracteres.", campo: campoDescricao };
  }
  if (contemDadoPessoal(marca + " " + modelo + " " + descricao)) {
    return { mensagem: "Não informe e-mail, telefone ou outros números longos no diagnóstico.", campo: campoDescricao };
  }

  const respostasFixas = lerRespostas(blocoFixas, sintoma.perguntas, "fixa");
  if (respostasFixas === null) {
    return { mensagem: "Responda todas as perguntas rápidas.", campo: blocoFixas.querySelector("input") };
  }

  let respostas = respostasFixas;
  if (estado.rodada === 2) {
    const respostasExtras = lerRespostas(blocoExtras, estado.perguntasExtras, "extra");
    if (respostasExtras === null) {
      return { mensagem: "Responda as perguntas adicionais.", campo: blocoExtras.querySelector("input") };
    }
    respostas = respostasFixas.concat(respostasExtras);
  }

  const dados = {
    aparelho: { marca: marca, modelo: modelo },
    problema: { categoria: sintoma.id, descricao: descricao },
    respostas: respostas,
    rodada: estado.rodada
  };
  return { dados: dados };
}

// =====================================================
// 6. COMUNICAÇÃO COM A API
// =====================================================

async function enviarParaApi(dados) {
  if (MODO_SIMULACAO) {
    return simularApi(dados);
  }

  // AbortController permite cancelar o fetch se a API demorar demais
  const controlador = new AbortController();
  const temporizador = setTimeout(function () {
    controlador.abort();
  }, TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
      signal: controlador.signal
    });

    if (!resposta.ok) {
      let mensagem = "O servidor respondeu com erro (HTTP " + resposta.status + ").";
      try {
        const corpo = await resposta.json();
        if (corpo && typeof corpo.mensagem === "string") {
          mensagem = corpo.mensagem;
        }
      } catch (e) {
        // mantém a mensagem padrão
      }
      throw new Error(mensagem);
    }

    try {
      return await resposta.json();
    } catch (e) {
      if (e.name === "AbortError") {
        throw e;
      }
      throw new Error("A resposta do servidor não está em um formato válido.");
    }
  } catch (erro) {
    if (erro.name === "AbortError") {
      throw new Error("A análise demorou demais. Tente novamente.");
    }
    if (erro instanceof TypeError) {
      throw new Error("Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.");
    }
    throw erro;
  } finally {
    clearTimeout(temporizador);
  }
}

// Confere se o JSON recebido tem o formato esperado.
// Devolve sempre um objeto limpo com status "ok", "insufficient_info", "no_match" ou "error".
function validarResposta(dados, rodada) {
  const invalida = { status: "error", mensagem: "Recebemos uma resposta inesperada. Tente novamente." };

  if (dados === null || typeof dados !== "object") {
    return invalida;
  }

  if (dados.status === "ok") {
    if (buscarServico(dados.servico) === null || !Array.isArray(dados.causas)) {
      return invalida;
    }
    const causas = [];
    for (let i = 0; i < dados.causas.length && causas.length < 3; i++) {
      if (typeof dados.causas[i] === "string" && dados.causas[i].trim() !== "") {
        causas.push(dados.causas[i].trim());
      }
    }
    if (causas.length < 2) {
      return invalida;
    }
    return { status: "ok", servico: dados.servico, causas: causas };
  }

  if (dados.status === "insufficient_info") {
    // Só pode acontecer uma vez: na segunda análise vira no_match
    if (rodada >= 2) {
      return { status: "no_match" };
    }
    if (!Array.isArray(dados.perguntas)) {
      return invalida;
    }
    const perguntas = [];
    for (let i = 0; i < dados.perguntas.length && perguntas.length < 2; i++) {
      const p = dados.perguntas[i];
      if (!p || typeof p.pergunta !== "string" || p.pergunta.trim() === "" || !Array.isArray(p.opcoes)) {
        return invalida;
      }
      const opcoes = [];
      for (let j = 0; j < p.opcoes.length && opcoes.length < 4; j++) {
        if (typeof p.opcoes[j] === "string" && p.opcoes[j].trim() !== "") {
          opcoes.push(p.opcoes[j].trim());
        }
      }
      if (opcoes.length < 2) {
        return invalida;
      }
      perguntas.push({ pergunta: p.pergunta.trim(), opcoes: opcoes });
    }
    if (perguntas.length < 1) {
      return invalida;
    }
    return { status: "insufficient_info", perguntas: perguntas };
  }

  if (dados.status === "no_match") {
    return { status: "no_match" };
  }

  if (dados.status === "error") {
    const mensagem = typeof dados.mensagem === "string" && dados.mensagem.trim() !== ""
      ? dados.mensagem.trim()
      : "Não foi possível concluir a análise.";
    return { status: "error", mensagem: mensagem };
  }

  return invalida;
}

// =====================================================
// 7. MODO SIMULAÇÃO (somente desenvolvimento/testes)
// =====================================================
// Respostas fictícias, sem IA. Frases de teste para escrever na descrição:
//   "simular erro"               -> status error
//   "simular resposta invalida"  -> resposta fora do padrão (testa a validação)
// Sintoma "Outro problema" com texto sem palavras conhecidas -> insufficient_info
// na 1ª rodada e no_match na 2ª.

const causasSimuladas = {
  bateria: ["Desgaste natural da bateria", "Uso intenso de aplicativos em segundo plano"],
  carregamento: ["Problema no conector de carregamento", "Falha no circuito de carregamento", "Cabo ou carregador com defeito"],
  tela: ["Dano físico no vidro ou no painel", "Conexão interna da tela solta ou danificada"],
  liquido: ["Umidade em componentes internos", "Corrosão em contatos e conectores"]
};

function descobrirCategoriaSimulada(texto) {
  if (/carreg|cabo|tomada/.test(texto)) return "carregamento";
  if (/bateria|descarreg/.test(texto)) return "bateria";
  if (/tela|display|trinc|quebr/.test(texto)) return "tela";
  if (/agua|água|molh|liquid|líquid/.test(texto)) return "liquido";
  return null;
}

function gerarRespostaSimulada(dados) {
  const descricao = dados.problema.descricao.toLowerCase();

  if (descricao.includes("simular erro")) {
    return { status: "error", mensagem: "Erro simulado para teste." };
  }
  if (descricao.includes("simular resposta invalida")) {
    return { status: "ok", servico: "servico-que-nao-existe", causas: ["x"] };
  }

  let categoria = dados.problema.categoria;
  if (categoria === "outro") {
    categoria = descobrirCategoriaSimulada(descricao);
  }

  if (categoria === null) {
    if (dados.rodada === 1) {
      return {
        status: "insufficient_info",
        perguntas: [{ pergunta: "O problema começou depois de uma queda ou contato com líquido?", opcoes: ["Sim", "Não"] }]
      };
    }
    return { status: "no_match" };
  }

  return { status: "ok", servico: categoria, causas: causasSimuladas[categoria] };
}

function simularApi(dados) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(gerarRespostaSimulada(dados));
    }, 900);
  });
}

// =====================================================
// 8. MOSTRAR O RESULTADO NA TELA (DOM)
// =====================================================

function criarBotao(texto, classe, aoClicar) {
  const botao = criar("button", texto, classe);
  botao.type = "button";
  botao.addEventListener("click", aoClicar);
  return botao;
}

function montarResumo(dados, servico) {
  let resumo = "Aparelho: " + dados.aparelho.marca + " " + dados.aparelho.modelo + "\n";
  resumo += "Problema: " + dados.problema.descricao + "\n";
  if (servico) {
    resumo += "Serviço sugerido (recomendação preliminar): " + servico.nome;
  } else {
    resumo += "Nenhum serviço da lista pareceu compatível. Gostaria de uma avaliação.";
  }
  return resumo;
}

function mostrarResultado(resposta, dados) {
  corpoResultado.replaceChildren();
  const caixa = criar("div", "", "resultado-caixa");

  if (resposta.status === "ok") {
    const servico = buscarServico(resposta.servico);
    estado.resumo = montarResumo(dados, servico);

    caixa.appendChild(criar("p", "Serviço que pode ser adequado:"));
    caixa.appendChild(criar("h3", servico.nome));
    caixa.appendChild(criar("p", servico.descricao));
    caixa.appendChild(criar("h4", "Possíveis causas"));
    const lista = document.createElement("ul");
    for (let i = 0; i < resposta.causas.length; i++) {
      lista.appendChild(criar("li", resposta.causas[i]));
    }
    caixa.appendChild(lista);
    caixa.appendChild(criar("p", "Esta é uma recomendação preliminar, feita apenas com as informações que você enviou. Ela não é um diagnóstico definitivo: o aparelho precisa ser avaliado por um técnico."));

    const acoes = criar("div", "", "acoes");
    acoes.appendChild(criarBotao("Solicitar atendimento", "botao", irParaContato));
    acoes.appendChild(criarBotao("Novo diagnóstico", "botao botao-secundario", novoDiagnostico));
    caixa.appendChild(acoes);
  } else if (resposta.status === "no_match") {
    estado.resumo = montarResumo(dados, null);

    caixa.appendChild(criar("h3", "Não encontramos um serviço compatível"));
    caixa.appendChild(criar("p", "Pelas informações enviadas, o problema não parece corresponder aos serviços disponíveis nesta página. Você pode falar com a nossa equipe para uma avaliação."));
    const acoes = criar("div", "", "acoes");
    acoes.appendChild(criarBotao("Falar com a equipe", "botao", irParaContato));
    acoes.appendChild(criarBotao("Novo diagnóstico", "botao botao-secundario", novoDiagnostico));
    caixa.appendChild(acoes);
  } else {
    caixa.className = "resultado-caixa resultado-erro";
    caixa.appendChild(criar("h3", "Não foi possível concluir a análise"));
    caixa.appendChild(criar("p", resposta.mensagem));
    const acoes = criar("div", "", "acoes");
    acoes.appendChild(criarBotao("Tentar novamente", "botao", function () {
      secaoResultado.hidden = true;
      botaoAnalisar.focus();
    }));
    acoes.appendChild(criarBotao("Falar com a equipe", "botao botao-secundario", irParaContato));
    caixa.appendChild(acoes);
    estado.resumo = montarResumo(dados, null);
  }

  corpoResultado.appendChild(caixa);
  secaoResultado.hidden = false;
  secaoResultado.scrollIntoView({ behavior: "smooth" });
  secaoResultado.focus({ preventScroll: true });
}

// Mostra as perguntas adicionais da IA dentro do formulário (acontece só uma vez)
function mostrarPerguntasExtras(perguntas) {
  estado.perguntasExtras = perguntas;
  estado.rodada = 2;

  blocoExtras.replaceChildren();
  blocoExtras.appendChild(criar("h3", "Precisamos de mais uma informação"));
  const bloco = document.createElement("div");
  blocoExtras.appendChild(bloco);
  desenharPerguntas(bloco, perguntas, "extra");
  blocoExtras.hidden = false;

  const primeira = blocoExtras.querySelector("input");
  if (primeira) {
    primeira.focus();
  }
}

// =====================================================
// 9. EVENTOS
// =====================================================

async function analisar(evento) {
  evento.preventDefault();

  if (estado.enviando) {
    return; // já existe uma análise em andamento
  }

  limparErroForm();
  const montagem = montarDados();
  if (!montagem.dados) {
    mostrarErroForm(montagem.mensagem, montagem.campo);
    return;
  }

  secaoResultado.hidden = true;
  definirCarregando(true);

  const dados = montagem.dados;
  let resposta;

  try {
    const bruta = await enviarParaApi(dados);
    resposta = validarResposta(bruta, dados.rodada);
  } catch (erro) {
    resposta = { status: "error", mensagem: erro.message };
  }

  if (resposta.status === "insufficient_info") {
    mostrarPerguntasExtras(resposta.perguntas);
  } else {
    mostrarResultado(resposta, dados);
  }

  definirCarregando(false);
}

// Trocar o sintoma muda as perguntas rápidas e reinicia as rodadas
function trocarSintoma() {
  const sintoma = buscarSintoma(campoSintoma.value);
  if (sintoma) {
    desenharPerguntas(blocoFixas, sintoma.perguntas, "fixa");
  } else {
    blocoFixas.replaceChildren();
  }
  estado.rodada = 1;
  estado.perguntasExtras = [];
  blocoExtras.replaceChildren();
  blocoExtras.hidden = true;
  botaoAnalisar.textContent = "Analisar";
  secaoResultado.hidden = true;
}

function novoDiagnostico() {
  formulario.reset();
  trocarSintoma();
  limparErroForm();
  document.getElementById("diagnostico").scrollIntoView({ behavior: "smooth" });
  campoMarca.focus({ preventScroll: true });
}

function irParaContato() {
  campoContatoMensagem.value = estado.resumo;
  statusContato.textContent = "";
  document.getElementById("contato").scrollIntoView({ behavior: "smooth" });
  campoContatoNome.focus({ preventScroll: true });
}

// No Webflow este formulário será o formulário nativo; aqui é só simulação local.
function enviarContato(evento) {
  evento.preventDefault();
  statusContato.textContent = "Pedido registrado (simulação local, nada foi enviado).";
}

// =====================================================
// 10. INÍCIO
// =====================================================

mostrarServicos();
preencherSintomas();
avisoSimulacao.hidden = !MODO_SIMULACAO;

formulario.addEventListener("submit", analisar);
campoSintoma.addEventListener("change", trocarSintoma);
formContato.addEventListener("submit", enviarContato);
