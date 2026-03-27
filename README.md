# ParkFlow Mobile

MVP fullstack de gestao de estacionamento com foco em operacao mobile, maquininha com navegador e camera.

## O que esta implementado

- Login com e-mail e senha, sessao persistida e rotas protegidas.
- Perfis `ADMIN` e `OPERATOR`.
- Entrada de veiculo com camera, captura da placa, OCR por `tesseract.js`, confirmacao manual obrigatoria e salvamento da foto.
- Ticket unico com QR Code, barcode e tela de reimpressao/compartilhamento.
- Saida com leitura por camera via `html5-qrcode`, busca manual por ticket/placa, calculo automatico e fechamento com pagamento.
- Pagamento manual preparado para evolucao futura com cartao, pix e dinheiro.
- Dashboard com filtros por periodo, receita, ticket medio, permanencia media, formas de pagamento e movimentacoes recentes.
- Configuracao administrativa de tabelas de preco.
- Gestao basica de usuarios.
- Auditoria para entrada, alteracao de placa/horario, cancelamento, desconto, saida e pagamento.
- PWA com `manifest`, `service worker`, cache basico e fila offline para entradas.
- Testes unitarios para calculo de preco e validacao de liquidacao do pagamento.

## Stack

- Next.js 16 + App Router + TypeScript
- Tailwind CSS 4
- PostgreSQL + Prisma
- PWA com `manifest.ts` + `public/sw.js`
- OCR com `tesseract.js`
- Leitura QR/barcode com `html5-qrcode`
- Graficos com `recharts`
- Testes com Vitest

## Como rodar

### 1. Preparar ambiente

Copie `.env.example` para `.env` se precisar ajustar valores:

```bash
cp .env.example .env
```

Variaveis esperadas:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/parking_mvp?schema=public"
APP_URL="http://localhost:3000"
AUTH_SECRET="troque-esta-chave-por-uma-string-longa-e-segura"
```

### 2. Subir o PostgreSQL

Com Docker Desktop ativo:

```bash
docker compose up -d
```

Observacao: no ambiente em que implementei, o Docker Desktop nao estava rodando, entao eu nao consegui executar `docker compose up`, `migrate` e `seed` aqui. O projeto, lint, build e testes foram validados; para banco local voce precisa ligar o Docker e executar os passos abaixo.

### 3. Aplicar schema e seed

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

Se estiver desenvolvendo do zero e quiser recriar migration localmente:

```bash
npm run prisma:migrate
```

Ja deixei uma migration inicial em `prisma/migrations/202603262247_init/migration.sql`.

### 4. Rodar a aplicacao

```bash
npm run dev
```

Abra:

- App: [http://localhost:3000](http://localhost:3000)
- Login: [http://localhost:3000/login](http://localhost:3000/login)

## Credenciais iniciais

- Admin
  - e-mail: `admin@parkflow.local`
  - senha: `Admin123!`
- Operador
  - e-mail: `operador@parkflow.local`
  - senha: `Operador123!`

## Comandos uteis

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
docker compose up -d
docker compose down
```

## Fluxos principais

### Entrada

1. Entrar no sistema.
2. Ir em `/entrada`.
3. Abrir camera e capturar a placa.
4. Conferir a sugestao do OCR e corrigir manualmente se necessario.
5. Ajustar horario, observacoes e tipo do veiculo.
6. Salvar e abrir o ticket gerado em `/ticket/[ticketNumber]`.

### Saida e pagamento

1. Ir em `/saida`.
2. Ler o ticket pela camera ou buscar manualmente.
3. Revisar resumo de entrada, saida, permanencia, regra aplicada e valor.
4. Escolher forma de pagamento e registrar valores.
5. Finalizar o fechamento e reabrir o ticket/comprovante.

### Dashboard

1. Ir em `/dashboard`.
2. Alternar entre hoje, 7 dias, 30 dias, semana e mes.
3. Consultar receita, operacao recente, performance por operador e mix de pagamentos.

## Offline / PWA

- A aplicacao expoe `manifest.webmanifest` e `public/sw.js`.
- Entradas feitas sem conexao sao salvas localmente no IndexedDB.
- Quando a conexao volta, o app tenta sincronizar as entradas pendentes automaticamente.
- Tickets recentes ficam em cache local para fallback na consulta.

Para testar instalacao/PWA localmente, prefira HTTPS em desenvolvimento:

```bash
npx next dev --experimental-https
```

## Estrutura do projeto

```text
src/
  app/
    (auth)/login
    (app)/
      dashboard
      entrada
      saida
      consulta
      historico
      configuracoes/precos
      configuracoes/usuarios
      ticket/[ticketNumber]
    api/
  components/
    app-shell
    dashboard
    entry
    exit
    forms
    offline
    ticket
    ui
  lib/
    auth
    data
    offline
    services
    utils
    validation
prisma/
  schema.prisma
  seed.ts
  migrations/
public/
  sw.js
```

## Decisoes tecnicas

- Persistencia de fotos de placa: armazenamento local em `public/uploads/plates` para manter o MVP simples e executavel.
- Sessao: cookie assinado com `jose`, sem dependencia externa de auth provider.
- Preco: regras desacopladas em `src/lib/services/pricing.ts`, com snapshot salvo no ticket fechado para auditoria.
- Pagamento: fluxo manual, mas isolado em service/API para futura integracao com adquirente ou Pix real.
- Offline: fila local apenas para operacoes criticas de entrada, que era o minimo operacional pedido.

## Validacoes executadas

```bash
npm run lint
npm run build
npm test
```
