# Fight Manager

**Gestão de academias de luta e artes marciais, do cadastro de alunos ao controle financeiro.**

O Fight Manager é um sistema web para administrar academias de luta, centralizando alunos, mensalidades, pagamentos e informações financeiras em uma única plataforma.

O projeto começou como uma iniciativa de portfólio e evoluiu para um MVP funcional, com autenticação, PostgreSQL, controle de acesso por academia, auditoria e testes automatizados.

**Versão:** 0.7.0 · **Status:** MVP funcional · **Licença:** MIT

---

## Visão geral

O Fight Manager foi desenvolvido para simplificar as principais tarefas administrativas de uma academia, com uma interface responsiva e foco na rotina de quem administra o negócio.

Entre as principais funcionalidades estão:

- Gestão de alunos, responsáveis e matrículas.
- Controle de mensalidades e pagamentos, incluindo pagamentos parciais.
- Acompanhamento de receitas, despesas e saldo financeiro.
- Convites de novos alunos por link e QR Code.
- Área do aluno para consultar mensalidades, pagamentos e recibos.
- Controle de acesso e isolamento de dados entre academias.
- Auditoria das principais operações do sistema.

## Conheça o sistema

O fluxo principal de utilização é simples:

**Localizar um aluno → Consultar seu perfil → Verificar as mensalidades → Registrar um pagamento.**

O painel inicial reúne informações importantes para a rotina administrativa, como mensalidades atrasadas, solicitações de entrada, vencimentos próximos e resumo financeiro do mês.

---

## Funcionalidades

### Gestão de alunos

- Cadastro e edição de alunos, com dados pessoais, endereço, contatos e informações de matrícula.
- Pesquisa por nome, telefone, e-mail, CPF e dados do responsável.
- Filtros por situação, além de ativação e inativação de cadastros.
- Definição de valor mensal e dia de vencimento individual para cada aluno.
- Cadastro de responsáveis legais, com suporte a irmãos vinculados ao mesmo responsável.
- Ficha de matrícula para impressão ou geração de PDF, com termos e assinaturas.
- Seção restrita para informações de saúde, com consentimento obrigatório.

### Mensalidades e pagamentos

- Geração individual de mensalidades ou geração em lote para todos os alunos ativos, sem duplicação.
- Controle de vencimentos e situações: a vencer, atrasada, paga e cancelada.
- Cálculo automático de atrasos, considerando o horário de Brasília.
- Registro de pagamentos vinculados a mensalidades ou avulsos.
- Suporte a pagamentos parciais, com acompanhamento do saldo restante.
- Confirmação de pagamentos pendentes e cancelamento com justificativa.
- Recibos para impressão, PDF ou compartilhamento pelo WhatsApp.

### Financeiro

- Acompanhamento de receitas, despesas e saldo por período.
- Geração automática de entradas financeiras a partir dos pagamentos confirmados.
- Cancelamento automático da entrada correspondente quando um pagamento é cancelado.
- Lançamentos manuais para despesas, matrículas e outros recebimentos.
- Prevenção de duplicidade entre pagamentos de mensalidades e lançamentos financeiros.

### Convites e área do aluno

- Geração de convites por link e QR Code.
- Cadastro de alunos por meio de convites, com aprovação pelo administrador.
- Possibilidade de vincular uma conta a um aluno já cadastrado.
- Histórico de solicitações aprovadas e recusadas.
- Área do aluno com acesso somente aos próprios dados, mensalidades, pagamentos e recibos.

### Segurança e privacidade

- Autenticação com senhas protegidas por hash bcrypt.
- Sessões armazenadas no banco e cookies `httpOnly`.
- Limite de tentativas de login.
- Isolamento de dados entre academias, com verificações no servidor.
- Auditoria de operações administrativas e financeiras.
- Exportação dos dados pessoais de um aluno e anonimização dos dados pessoais, preservando o histórico financeiro.

### Experiência de uso

- Interface responsiva, com navegação adaptada a celulares.
- Barra de navegação inferior para as principais ações em dispositivos móveis.
- Filtros recolhíveis e janelas próprias para confirmações.
- Cobrança pelo WhatsApp com mensagens pré-preenchidas, sem envio automático.
- Recuperação de senha e envio de convites por e-mail.

---

## Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| Next.js 16 | Aplicação web, App Router e Server Actions |
| React 19 | Interface e componentes |
| TypeScript | Tipagem estática |
| PostgreSQL 16 | Banco de dados relacional |
| Drizzle ORM | Consultas e gerenciamento do schema |
| Zod | Validação de dados |
| bcryptjs | Hash de senhas |
| Nodemailer | Envio de e-mails por SMTP |
| Resend | Alternativa para envio de e-mails |
| qrcode | Geração de QR Codes |
| Vitest | Testes automatizados |
| Playwright | Testes de ponta a ponta |
| Docker | Containerização |
| Docker Compose | Orquestração do ambiente local |

As fontes Manrope e Barlow Condensed são hospedadas localmente, sem dependência de serviços externos durante o build.

---

## Executando o projeto

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) com suporte ao Docker Compose.

### 1. Clone o repositório

```bash
git clone https://github.com/VictorHcss/fight-manager.git
cd fight-manager
```

### 2. Configure as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Revise as configurações do `.env` conforme necessário. Para o ambiente local com Docker, os valores de exemplo são suficientes para iniciar o sistema.

### 3. Inicie a aplicação

```bash
docker compose up -d --build
```

O Docker Compose inicia o PostgreSQL e a aplicação. As migrations são executadas automaticamente na inicialização.

### 4. Popule o banco de dados

Para carregar os dados de demonstração:

```bash
docker compose exec -e NODE_ENV=development app npm run db:seed
```

### 5. Acesse o sistema

Abra [http://localhost:3000](http://localhost:3000).

---

## Executando sem Docker

Também é possível executar o projeto diretamente no ambiente local.

**Pré-requisitos:**
- Node.js 20 ou superior.
- PostgreSQL 14 ou superior.

Instale as dependências:

```bash
npm install
```

Configure o ambiente:

```bash
cp .env.example .env
```

Ajuste as URLs de conexão com o PostgreSQL no `.env` e execute:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

A aplicação ficará disponível em [http://localhost:3000](http://localhost:3000).

---

## Testes e qualidade

O projeto utiliza testes automatizados para verificar as regras de negócio e os principais fluxos da aplicação.

| Comando | Finalidade |
|---|---|
| `npm test` | Executa os testes automatizados com PostgreSQL |
| `npm run lint` | Verifica padrões e possíveis problemas no código |
| `npm run build` | Gera a versão de produção |
| `npm run test:e2e` | Executa testes de ponta a ponta com Playwright |

Para executar os testes de ponta a ponta pela primeira vez:

```bash
npx playwright install chromium
```

O conjunto documentado de testes contempla **92 testes automatizados e 13 testes de ponta a ponta**, cobrindo regras financeiras, autenticação, isolamento entre academias, auditoria, convites e área do aluno.

O GitHub Actions executa a integração contínua por meio do fluxo definido em `.github/workflows/ci.yml`.

---

## Estrutura do projeto

```text
app/             Páginas e Server Actions
  (app)/         Área administrativa da academia
  login/         Autenticação
  criar-conta/   Cadastro de alunos
  plataforma/    Administração da plataforma
  convite/       Cadastro por convite
  aluno/         Área do aluno

components/      Componentes reutilizáveis
services/        Regras de negócio e acesso a dados
lib/             Autenticação, dinheiro, datas e validações
db/              Schema e conexão com o banco
drizzle/         Migrations
scripts/         Seed e comandos administrativos
tests/           Testes automatizados
docs/            Documentação técnica
```

---

## Documentação

Para conhecer melhor a arquitetura e as decisões do projeto, consulte:

- [Documentação geral](docs/README.md)
- [Guia de estudo do projeto](docs/guia-de-estudo.md)
- [Requisitos](docs/requisitos.md)
- [Desenvolvimento e testes](docs/development.md)
- [Configuração de e-mail](docs/email.md)
- [Solução de problemas](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)

---

## Roadmap

O projeto possui espaço para evoluir com funcionalidades como:

- Controle de presença e check-in.
- Notificações e lembretes automáticos.
- Recorrência automática de cobranças.
- Integrações financeiras.
- Relatórios avançados.
- Permissões administrativas mais detalhadas.
- Recursos adicionais para professores e alunos.

As funcionalidades planejadas e seu estado atual estão descritos no [roadmap](docs/roadmap.md).

---

## Licença

Este projeto está licenciado sob a licença MIT.

**Desenvolvido por Victor H.**
