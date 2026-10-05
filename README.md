# Consertaê — Assistente Inteligente de Serviços

Projeto acadêmico da disciplina **Padrões Web para No Code e Low Code**.
Página de uma assistência técnica de celulares com um diagnóstico guiado: o usuário descreve o problema, o site consulta uma IA e mostra uma **recomendação preliminar** de serviço (nunca um diagnóstico definitivo).

## Fluxo

```
formulário → JavaScript (objeto com os dados) → fetch() → /api/diagnostico (Vercel)
          → Google Gemini → JSON → JavaScript valida → DOM mostra o resultado
```

## Estrutura

| Arquivo | Função |
|---|---|
| `frontend/index.html` | Página completa (header, hero, serviços, diagnóstico, resultado, contato, footer) |
| `frontend/style.css` | Estilos (mobile first, responsivo) |
| `frontend/script.js` | Catálogo, perguntas, estado, validação, `fetch()` e atualização do DOM |
| `api/diagnostico.js` | Função serverless da Vercel que valida os dados e chama o Gemini |
| `.env.example` | Lista das variáveis de ambiente (sem valores reais) |

## Respostas da API

| `status` | Campos | Significado |
|---|---|---|
| `ok` | `servico` (id do catálogo), `causas` (2 ou 3) | Recomendação preliminar |
| `insufficient_info` | `perguntas` (1 ou 2, cada uma com `opcoes`) | Precisa de mais informação (só na 1ª análise) |
| `no_match` | — | Nenhum dos 4 serviços combina |
| `error` | `mensagem` | Falha |

A requisição enviada pelo site tem este formato (sem dados pessoais):

```json
{
  "aparelho": { "marca": "Samsung", "modelo": "Galaxy A54" },
  "problema": { "categoria": "carregamento", "descricao": "Não está carregando" },
  "respostas": [{ "pergunta": "Você tentou outro cabo ou carregador?", "resposta": "Sim" }],
  "rodada": 1
}
```

`rodada` é 1 na primeira análise e 2 depois que o usuário responde às perguntas adicionais. Na rodada 2 a resposta só pode ser `ok` ou `no_match`.

## Variáveis de ambiente (Vercel)

- `GEMINI_API_KEY` — obrigatória.
- `GEMINI_MODEL` — opcional (padrão `gemini-2.5-flash`; confirme o nome atual na documentação do Google).
- `ALLOWED_ORIGINS` — opcional; origens autorizadas separadas por vírgula (ex.: o endereço do site no Webflow). Vazio = qualquer origem.

## Como testar

**Modo simulação (sem API):** com `API_URL` vazia em `frontend/script.js`, o site usa respostas fictícias e mostra um aviso na tela.

```
cd frontend
python3 -m http.server 8000     # abra http://localhost:8000
```

Frases para escrever na descrição: `simular erro` (status `error`) e `simular resposta invalida` (testa a validação). Com o sintoma "Outro problema" e um texto sem palavras conhecidas, a 1ª análise pede mais informação e a 2ª resulta em `no_match`.

**Com a API real (local):** crie um `.env` a partir do `.env.example`, rode `npx vercel dev` na raiz e preencha `API_URL` em `frontend/script.js` com o endereço local mostrado pelo comando seguido de `/api/diagnostico`.

## Configurações pendentes

- **Vercel:** importar o repositório, cadastrar as variáveis acima e publicar; copiar a URL final do endpoint para `API_URL`.
- **Webflow:** montar as seções (o Webflow cuida da estrutura, navbar, estilos e publicação). O formulário do diagnóstico e o bloco de resultado entram em elementos *Embed*, mantendo os `id` usados pelo `script.js`. O `style.css` e o `script.js` precisam ser colados no site (ou hospedados e carregados por `<script src>`). Trocar o formulário de contato de exemplo pelo formulário nativo do Webflow.
