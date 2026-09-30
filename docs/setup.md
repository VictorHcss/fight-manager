# Instalação e configuração

## Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão com o PostgreSQL da aplicação |
| `TEST_DATABASE_URL` | Banco usado pelos testes (é apagado e recriado a cada execução; nunca aponte para o banco real) |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL no `docker-compose.yml` |
| `APP_TIMEZONE` | Fuso usado para "hoje" e atrasos (padrão `America/Sao_Paulo`) |
| `COOKIE_SECURE` | `false` apenas para testar o build de produção sem HTTPS em rede local |

O `.env` está no `.gitignore` e no `.dockerignore`. Nenhuma senha ou token fica no código.

## Com Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run db:seed    # opcional
```

- Aplicação: http://localhost:3000
- PostgreSQL: localhost:5432 (usuário `fight`, banco `fight_manager`)
- As migrations rodam automaticamente sempre que o container da aplicação inicia.

| Ação | Comando |
| --- | --- |
| Subir | `docker compose up -d --build` |
| Parar | `docker compose down` |
| Logs | `docker compose logs -f app` (ou `db`) |
| Migrations | `docker compose exec app npm run db:migrate` |
| Seed | `docker compose exec app npm run db:seed` |
| Reset do banco (apaga tudo) | `docker compose down -v && docker compose up -d --build` |

## Sem Docker

1. Instale Node.js 20+ e PostgreSQL 14+.
2. Crie os bancos: `createdb fight_manager` e `createdb fight_manager_test`.
3. `npm install`, `cp .env.example .env` e ajuste as URLs.
4. `npm run db:migrate` e, se quiser, `npm run db:seed`.
5. `npm run dev` para desenvolvimento, ou `npm run build && npm start` para produção.

Reset sem Docker: `dropdb fight_manager && createdb fight_manager && npm run db:migrate`.

## Contas

- Com o seed, todas com a senha `fightmanager123`: `plataforma@fightmanager.dev` (plataforma), `admin@academia.dev` (academia), `aluno@academia.dev` (aluno aprovado), `pendente@academia.dev` (aluno aguardando aprovação) e `semacademia@academia.dev` (aluno sem academia). A tela de login mostra essas contas em desenvolvimento ou com `SHOW_TEST_ACCOUNTS=true`.
- Os scripts (`db:migrate`, `db:seed`, `db:create-admin`, `email:test`) leem o `.env` da raiz sozinhos; variáveis já definidas no ambiente têm prioridade.
- E-mail: veja [email.md](email.md).
- Uso real: crie o administrador da plataforma com `ADMIN_PASSWORD="..." npm run db:create-platform-admin -- "Seu Nome" voce@email.com` e, pela tela `/plataforma`, as academias. O script `ADMIN_PASSWORD="..." npm run db:create-admin -- "Academia" "Nome" email@dominio.com` continua disponível para criar uma academia direto pelo terminal.
