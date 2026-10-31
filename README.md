# Diário Filosófico

App web (PWA) para o autoexame diário e o cultivo de virtudes: Prólogo pela
manhã, Epílogo à noite, práticas, leituras e o Módulo GDVE/FV.

## Como rodar

```bash
npm install
npm run dev      # servidor local do Vite
npm run build    # gera a versão de produção em dist/
```

As credenciais do Firebase do front end ficam em `.env` / `.env.local`
(variáveis `VITE_FIREBASE_*`).

## Estrutura

- `src/App.jsx`: estado principal, tela de hoje, login e modais.
- `src/views/`: telas carregadas sob demanda (Leituras, GDVE, Histórico,
  Estatísticas, Metas, Guardião, Painel admin, Práticas guiadas).
- `src/components/DeferredField.jsx`: campo de texto que só avisa o App numa
  pausa da digitação, para a tela não redesenhar a cada tecla.
- `src/lib/helpers.js`: funções puras compartilhadas.
- `src/constants/`: dados fixos (virtudes, frases, catálogo dos Bastiões).
- `src/App.css`: paleta e tokens de tema (`--t-*`), que trocam entre claro e
  escuro pelo atributo `data-theme` do `<html>`.

## API (Vercel Functions, pasta `api/`)

| Endpoint | Função |
|---|---|
| `fv-access` | Confere a whitelist e o acesso ao módulo FV no login. |
| `fv-admin` | Painel de pedidos de acesso, admins e unidades. |
| `gdve-groups` | Grupos de estudo: criar, entrar, avisar membros. |
| `carta-degrau` | Síntese da Carta de Degrau com a API da Anthropic. |
| `lembretes` | Cron das 08:00 e 20:00 (horário de Brasília): push e WhatsApp. |

`api/_lib/shared.js` reúne a inicialização do Firebase Admin, a checagem do
token e o endereço do app. Arquivos com `_` no início não viram endpoint.

Variáveis de ambiente do servidor: `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ANTHROPIC_API_KEY`,
`CRON_SECRET` e, para o WhatsApp, `ZAPI_INSTANCE_ID`,
`ZAPI_INSTANCE_TOKEN` e `ZAPI_CLIENT_TOKEN`.

## Lembretes

O plano Hobby da Vercel permite só dois disparos de cron por dia, então todos
os lembretes saem às 08:00 e às 20:00. Quem já fez aquela parte do dia não
recebe o lembrete. Os alertas do Guardião (diário, práticas e leituras parados
há 3 dias, reunião do GDVE em 7 dias) vão junto com a mensagem das 20:00.
