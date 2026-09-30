# Banco de dados

PostgreSQL 16 com Drizzle ORM. O schema fica em `db/schema.ts` e as migrations em `drizzle/`.

## Tabelas

| Tabela | Conteúdo | Relações |
| --- | --- | --- |
| `academies` | Academias (nome, ativa ou suspensa) | — |
| `users` | Usuários com perfil `PLATFORM_ADMIN`, `ACADEMY_ADMIN` ou `STUDENT` | `academy_id` → academies (nulo para PLATFORM_ADMIN) |
| `sessions` | Sessões de login (hash do token e validade) | `user_id` → users |
| `modalities` | Modalidades de cada academia, com valor mensal sugerido; desativar tira das opções sem afetar quem já está nelas | `academy_id` → academies |
| `guardians` | Responsáveis legais (nome, CPF, telefone, e-mail, endereço), por academia | `academy_id` → academies |
| `student_guardians` | Ligação aluno ↔ responsável, com parentesco e responsável principal | `student_id` → students, `guardian_id` → guardians |
| `invites` | Convites de entrada (token do QR Code, validade, limite e contagem de usos, revogação) | `academy_id` → academies |
| `students` | **Vínculo** de uma pessoa com uma academia: dados da academia e status | `academy_id` → academies, `user_id` → users (conta, opcional), `invite_id` → invites |
| `fees` | Mensalidades | `academy_id`, `student_id` → students |
| `payments` | Pagamentos, opcionalmente ligados a uma mensalidade | `academy_id`, `student_id`, `fee_id` → fees, `created_by` → users |
| `financial_entries` | Entradas e saídas do financeiro | `academy_id`, `payment_id` → payments (único) |
| `audit_logs` | Registro das ações importantes | `academy_id`, `user_id` → users |

Todas as chaves primárias são UUID. Tabelas editáveis têm `created_at` e `updated_at`.

## Tipos enumerados

- `student_status`: `pending` (pedido pelo convite), `active`, `inactive`, `rejected` (pedido recusado), `suspended` (reservado para o futuro)
- `fee_status`: `pending`, `paid`, `canceled` (**"atrasada" não é armazenado**; ver architecture.md)
- `payment_status`: `paid`, `pending`, `canceled`
- `payment_method`: `cash`, `pix`, `debit`, `credit`, `other`
- `entry_type`: `income`, `expense`; `entry_status`: `active`, `canceled`

## Dinheiro e datas

- Valores em **centavos**, colunas `integer` (`amount_cents`, `monthly_fee_cents`). Totais são somados como `bigint` no banco.
- Vencimento, pagamento, entrada e datas do financeiro são `date` (sem hora); referência da mensalidade é texto `YYYY-MM`.

## Regras garantidas pelo banco

- `users`: e-mail único sem diferenciar maiúsculas (`lower(email)`).
- `fees`: um aluno não tem duas mensalidades **não canceladas** no mesmo período (índice único parcial `fees_student_reference_unique`).
- `financial_entries.payment_id` único: um pagamento gera no máximo uma entrada.
- `students`: uma conta tem no máximo um vínculo **em aberto** por academia (`students_user_academy_unique`, que ignora vínculos com `closed_at` preenchido).
- `students`: aluno fora de `pending`/`rejected` precisa ter modalidade, data de início e valor mensal (check `students_complete_when_approved`).
- `invites.token` único.
- `modalities`: nome único por academia, sem diferenciar maiúsculas.
- `student_guardians`: no máximo um responsável principal por aluno (`student_guardians_one_primary`). Um responsável ligado a algum aluno não pode ser apagado (`RESTRICT`).
- `students.modality_id` → `modalities` com `RESTRICT`: modalidades com alunos não são apagadas, só desativadas.
- `students`, `fees` e `payments` usam `ON DELETE RESTRICT` entre si: o histórico financeiro não pode ser apagado em cascata.

## Índices

`students` por academia com status, nome (minúsculo) e telefone; `fees` por academia, status e vencimento, e por aluno; `payments` por academia e data, por mensalidade e por aluno; `financial_entries` e `audit_logs` por academia e data.

## Migrations

```bash
npm run db:generate   # gera uma nova migration a partir de mudanças em db/schema.ts
npm run db:migrate    # aplica as pendentes (também roda sozinho ao subir o container)
```

## Dados de desenvolvimento

`npm run db:seed` cria uma academia de exemplo com 10 alunos fictícios, mensalidades do mês passado (pagas) e do atual (algumas pagas, parciais e atrasadas), despesas e dois usuários com senha conhecida. **São dados de desenvolvimento**: o script se recusa a rodar com `NODE_ENV=production`, a menos que `ALLOW_SEED=1`.

## Conta e vínculo

A **conta** (`users`, perfil `STUDENT`) guarda os dados da pessoa (nome, e-mail, senha) e não pertence a nenhuma academia (`academy_id` nulo). O **vínculo** (`students`) guarda o que é da academia: modalidade, início, mensalidade, observações e status, além de uma cópia do nome e dos contatos. Alunos cadastrados pelo administrador não têm conta (`user_id` nulo). Essa separação permite, no futuro, que a mesma pessoa treine em mais de uma academia com uma só conta.

Enquanto o pedido está `pending`, os dados da academia ficam vazios; eles são preenchidos na aprovação. O vínculo também registra quem decidiu e quando (`decided_by`, `decided_at`) e o motivo da recusa (`rejection_reason`).

Um pedido recusado recebe `closed_at` (vínculo encerrado): ele continua no histórico e na auditoria, e a estrutura já permite que a mesma pessoa faça um novo pedido depois, sem apagar o anterior. No MVP, a tela ainda não oferece esse novo pedido: quem foi recusado vê a orientação de falar com a recepção.

A regra de unicidade usa `closed_at` e não o status porque o PostgreSQL não permite, na condição de um índice, nem converter um enum para texto (operação não imutável) nem usar um valor de enum criado na mesma transação da migration.

## Cadastro completo (0.4.0)

- **Academia:** `document` (CPF ou CNPJ), `phone`, `email`, endereço (`zip`, `street`, `number`, `complement`, `district`, `city`, `state`) e `enrollment_terms` (termos da ficha).
- **Aluno:** `modality_id` (substitui o texto `modality`), `cpf`, endereço, contato de emergência (`emergency_name`, `emergency_phone`, `emergency_relation`), `image_consent` (nulo = não perguntado) com `image_consent_at`, `health_notes` com `health_consent_at` e `enrollment_signed_at` (ficha assinada).
- **Saúde:** `health_notes` nunca é lido pela consulta comum do aluno (`getStudent`), só por `getHealth`, usada pela aba Saúde e, se marcado, pela ficha.

### Migração das modalidades

As migrations `0003_cadastro_completo` e `0004_modalidade_ligada` convertem os dados existentes: cada texto de modalidade usado numa academia vira uma modalidade dela (sem diferenciar maiúsculas), os alunos são ligados a ela, e só então a coluna de texto é removida. São duas migrations porque a remoção da coluna precisa acontecer depois da cópia dos dados.
