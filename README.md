# Top Lanches Impressao (Electron)

Aplicativo desktop de impressao conectado ao Supabase em tempo real.

## O que o app faz

- Escuta a tabela `fila_impressao` em realtime + polling de seguranca.
- Imprime automaticamente pedidos em `status = pendente`.
- Suporta dois escopos de impressao:
  - `pedido_completo`
  - `itens_novos` (imprime apenas os novos itens adicionados no pedido)
- Permite reimpressao manual de registros da fila.
- Exibe pedidos recentes e permite envio manual para impressao (cozinha/cliente).
- Detecta impressoras instaladas no sistema.
- Usa `public/icon.ico` no empacotamento Windows.

## Requisitos

- Node.js 20+
- NPM 10+
- Acesso ao projeto Supabase do Top Lanches

## Configuracao

Voce pode preencher as credenciais na tela do app ou usar variaveis de ambiente:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anon
```

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run empacotar:win
```

Artefatos gerados em `release/`.

## Segurança aplicada no Electron

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- bloqueio de navegacao externa via `setWindowOpenHandler`
- preload com API estritamente controlada

## Fluxo esperado com o Admin

1. Admin cria pedido ou envia manualmente para impressao.
2. Admin edita pedido e adiciona novos itens.
3. O web app enfileira um evento `escopo = itens_novos` na `fila_impressao`.
4. O app Electron detecta o evento em realtime e imprime apenas os novos itens.
