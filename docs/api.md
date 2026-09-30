# API: Server Actions

O MVP **não expõe uma API REST**. Todas as operações são **Server Actions** do Next.js, chamadas pelos formulários da própria aplicação. Toda action:

- exige sessão válida de `ACADEMY_ADMIN` (`requireAcademyAdmin()`); sem ela, redireciona para `/login`;
- opera **somente** sobre dados da academia do usuário logado;
- valida os dados no servidor (Zod) antes de qualquer gravação.

Actions com formulário (`useActionState`) devolvem `ActionState`:

```ts
{ message?: string; errors?: Record<string, string>; values?: Record<string, string> }
```

Em caso de sucesso, redirecionam com `?ok=<código>` (a mensagem de sucesso aparece na tela de destino). Actions de botão (sem estado) redirecionam de volta com `?ok=` ou `?erro=<mensagem>`.

Valores monetários são enviados como texto no formato brasileiro (`"150,00"`, `"1.234,56"`); datas como `YYYY-MM-DD`; período como `YYYY-MM`.

## Autenticação (`app/login/actions.ts`)

| Action | Campos | Resultado | Erros |
| --- | --- | --- | --- |
| `login` | `email`, `password` | cria a sessão e redireciona para `/` (ou `/plataforma`) | "E-mail ou senha incorretos.", "Muitas tentativas. Aguarde 15 minutos..." |
| `logout` | — | apaga a sessão e redireciona para `/login` | — |

## Alunos (`app/(app)/alunos/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createStudentAction` | `name`*, `modality`*, `joinedAt`*, `monthlyFee`*, `dueDay`* (1–31), `status`* (`active`/`inactive`), `phone`, `email`, `birthDate`, `notes` | `/alunos/{id}?ok=aluno-criado` | campo obrigatório, e-mail ou telefone inválido, valor inválido, data inválida |
| `updateStudentAction(id)` | mesmos campos | `/alunos/{id}?ok=aluno-salvo` | os mesmos, "Aluno não encontrado." |
| `toggleStudentStatusAction` | `id`, `status` | `/alunos/{id}?ok=aluno-status` | aluno de outra academia: 404 |

## Mensalidades (`app/(app)/mensalidades/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createFeeAction` | `studentId`*, `amount`*, `dueDate`*, `reference`* (`YYYY-MM`), `notes` | perfil do aluno, aba mensalidades | "Este aluno já tem uma mensalidade para esse período." |
| `updateFeeAction(id)` | `amount`*, `dueDate`*, `reference`*, `notes`, `back` | página de origem `?ok=mensalidade-salva` | "Mensalidade paga não pode ser editada...", "Esta mensalidade já recebeu pagamento..." |
| `cancelFeeAction` | `id`, `back` | `?ok=mensalidade-cancelada` | "Cancele os pagamentos desta mensalidade antes de cancelá-la." |
| `generateFeesAction` | `reference`* | `/mensalidades?...&ok=mensalidades-geradas&geradas=N` | "Escolha um mês válido." |

## Pagamentos (`app/(app)/pagamentos/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createPaymentAction` | `studentId`*, `amount`*, `paidAt`*, `method`* (`cash`/`pix`/`debit`/`credit`/`other`), `status`* (`paid`/`pending`), `feeId`, `reference`, `notes` | perfil do aluno, aba pagamentos | "O valor passa do saldo da mensalidade (R$ X).", "Esta mensalidade já está paga.", "Esta mensalidade é de outro aluno." |
| `confirmPaymentAction` | `id`, `back` | `?ok=pagamento-confirmado` | "Só pagamentos pendentes podem ser confirmados." |
| `cancelPaymentAction` | `id`, `reason`* (3+ caracteres), `back` | `?ok=pagamento-cancelado` | "Informe o motivo do cancelamento.", "Este pagamento já foi cancelado." |

Efeitos: um pagamento `paid` cria a entrada no financeiro e recalcula a mensalidade; cancelar cancela a entrada e recalcula a mensalidade.

## Financeiro (`app/(app)/financeiro/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createEntryAction` | `type`* (`income`/`expense`), `category`*, `description`*, `amount`*, `date`*, `notes` | `/financeiro?ok=lancamento-criado` | "Categoria inválida para esse tipo de lançamento." |
| `cancelEntryAction` | `id`, `back` | `?ok=lancamento-cancelado` | "Esta entrada veio de um pagamento. Para desfazer, cancele o pagamento." |

Categorias de entrada: `Matrícula`, `Outros recebimentos`. De saída: `Equipamentos`, `Manutenção`, `Infraestrutura`, `Despesas operacionais`, `Outras despesas`.

## Configurações (`app/(app)/configuracoes/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `changePasswordAction` | `current`*, `next`* (10+), `confirm`* | `?ok=senha-alterada` | "Senha atual incorreta.", "As senhas não conferem." |
| `createUserAction` | `name`*, `email`*, `password`* (10+) | `?ok=usuario-criado` | "Já existe um usuário com esse e-mail." |
| `toggleUserAction` | `id`, `active` | `?ok=usuario-salvo` | "Você não pode desativar o seu próprio acesso." |

## Exemplo

Registrar R$ 100,00 de uma mensalidade de R$ 150,00, pelo formulário `/pagamentos/novo`:

```text
studentId=4f0c…  feeId=9a1e…  amount=100,00  paidAt=2026-09-10  method=pix  status=paid
```

Resultado: pagamento criado, entrada de R$ 100,00 no financeiro, mensalidade continua `pending` com saldo de R$ 50,00, registro `payment.created` na auditoria e redirecionamento para `/alunos/4f0c…?aba=pagamentos&ok=pagamento-registrado`.

## Convites e entrada de alunos

| Action | Arquivo | Acesso | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- | --- | --- |
| `regenerateInviteAction` | `app/(app)/convidar/actions.ts` | ACADEMY_ADMIN | — | `/convidar?ok=convite-novo` (o código anterior é revogado) | — |
| `signupAction(token)` | `app/convite/[token]/actions.ts` | público | `name`*, `phone`*, `email`*, `birthDate`* (18+), `password`* (10+), `confirm`*, `consent`* | cria a sessão e vai para `/aluno?ok=pedido-enviado` | "Este convite não é mais válido...", "Já existe uma conta com este e-mail...", "O cadastro pelo convite é para maiores de 18 anos...", limite de cadastros |
| `joinAction(token)` | `app/convite/[token]/actions.ts` | STUDENT | — | `/aluno?ok=pedido-enviado` | "Você já tem vínculo ou pedido nesta academia.", "Seu pedido para esta academia foi recusado..." |
| `approveAction(id)` | `app/(app)/solicitacoes/actions.ts` | ACADEMY_ADMIN | `modality`*, `joinedAt`*, `monthlyFee`*, `dueDay`*, `notes` | perfil do aluno `?ok=entrada-aprovada` | "Este pedido já foi analisado." |
| `linkAction` | idem | ACADEMY_ADMIN | `id` (pedido), `existing` (aluno já cadastrado) | perfil do aluno existente `?ok=entrada-vinculada` | "Escolha um aluno já cadastrado nesta academia e sem conta." |
| `rejectAction` | idem | ACADEMY_ADMIN | `id`, `reason` (opcional, até 200 caracteres, visível ao aluno) | `/solicitacoes?ok=entrada-recusada` | "Este pedido já foi analisado." |

O endereço do convite é `/convite/{token}`. O token tem 24 caracteres aleatórios (144 bits) e não contém dados da academia nem de pessoas. Um token inexistente, revogado, vencido ou esgotado mostra a mesma mensagem de "convite inválido", sem revelar qual é o caso.

## Recuperação de senha, recibo e LGPD (0.6.0)

| Operação | Tipo e arquivo | Acesso | Entrada | Resultado |
| --- | --- | --- | --- | --- |
| `requestResetAction` | Server Action, `app/esqueci-senha/actions.ts` | público | `email` | sempre `{ sent: true }`; envia o link se a conta existir e estiver ativa |
| `resetAction(token)` | Server Action, `app/redefinir-senha/[token]/actions.ts` | público (com token) | `next` (10+), `confirm` | redireciona para `/login?ok=senha-redefinida`; erro "Este link não é mais válido" |
| `GET /alunos/{id}/exportar` | Route Handler | ACADEMY_ADMIN | — | JSON (download) com os dados do aluno; 404 para aluno de outra academia |
| `GET /aluno/meus-dados` | Route Handler | STUDENT | — | JSON (download) com a conta e todos os vínculos da pessoa |
| `anonymizeAction(id)` | Server Action, `app/(app)/alunos/actions.ts` | ACADEMY_ADMIN | `confirmation` = ELIMINAR | perfil com `?ok=dados-eliminados`; erros: aluno ativo, mensalidade em aberto, pagamento aguardando confirmação |
| `/pagamentos/{id}/recibo`, `/aluno/recibo/{id}` | Páginas | ACADEMY_ADMIN, STUDENT (só os próprios) | — | recibo para imprimir; 404 para pagamento aguardando confirmação ou de outra academia |
