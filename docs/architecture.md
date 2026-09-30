# Arquitetura

## Camadas

```text
Páginas (app/**/page.tsx)         Server Components: buscam dados e desenham a tela
   │
Componentes (components/, *Form)  interface reutilizável; formulários são Client Components
   │
Server Actions (app/**/actions.ts) recebem o formulário, conferem o acesso, validam e chamam o serviço
   │
Serviços (services/)              regras de negócio e acesso a dados, em transações
   │
Drizzle ORM (db/)                 schema tipado e conexão com o PostgreSQL
```

Nenhuma página ou componente faz consulta ao banco diretamente: tudo passa por `services/`.

## Fluxo de uma ação (exemplo: registrar pagamento)

1. O formulário (`app/(app)/pagamentos/PaymentForm.tsx`) envia os campos para `createPaymentAction`.
2. A action chama `requireAcademyAdmin()` (`lib/auth/guards.ts`), que confere a sessão e devolve o contexto `{ userId, academyId }`. Sem sessão válida, redireciona para o login.
3. `handleForm` (`lib/action.ts`) valida os campos com Zod (`lib/validation.ts`). Erros voltam ao formulário com mensagens em português.
4. `createPayment(ctx, dados)` (`services/payments.ts`) abre uma transação que:
   - confere que o aluno e a mensalidade são da academia do contexto;
   - trava a mensalidade (`SELECT ... FOR UPDATE`), para dois pagamentos simultâneos não passarem do saldo;
   - grava o pagamento, a entrada no financeiro (se pago) e o registro de auditoria;
   - recalcula a situação da mensalidade a partir dos pagamentos.
5. A action revalida as páginas e redireciona para o perfil do aluno com a mensagem de sucesso.

## Fluxo do convite

```text
Administrador abre "Convidar alunos" → QR Code com /convite/{token}
Aluno escaneia → a página resolve a academia pelo token (servidor) → cadastro da conta
→ conta STUDENT + vínculo "pending" na academia do convite (uma transação, com o uso do convite contado)
→ "Solicitações": aprovar (completa modalidade, início e mensalidade) | vincular a aluno existente | recusar
→ aprovado: o aluno vê a própria área em /aluno
```

Serviços: `services/invites.ts` (gerar, revogar, resolver, consumir), `services/enrollment.ts` (cadastro, pedidos, decisões) e `services/student-portal.ts` (leitura da área do aluno, sempre pelo par vínculo e conta).

## Decisões importantes

- **Contexto obrigatório (multi-academia):** todo serviço de academia recebe um `AcademyContext` e filtra **todas** as consultas por `academy_id`. Não existe função que busque um registro só pelo ID. IDs são UUID.
- **Dinheiro em centavos inteiros:** `lib/money.ts` converte "1.234,56" em `123456` manipulando texto, sem ponto flutuante. Somas acontecem no PostgreSQL, em inteiros.
- **Datas de calendário no fuso de Brasília:** vencimentos e pagamentos são `date` (sem hora). "Hoje" é calculado em `America/Sao_Paulo` (`lib/dates.ts`).
- **Atraso é derivado, não armazenado:** `fees.status` guarda `pending`, `paid` ou `canceled`; "atrasada" é `pending` com vencimento antes de hoje (`lib/fee-status.ts` e filtros SQL em `services/fees.ts`).
- **Pagamentos são a fonte da verdade da mensalidade:** `recomputeFee` define `paid` ou `pending` somando os pagamentos confirmados. Nada é marcado como pago à mão.
- **Uma entrada por pagamento:** `financial_entries.payment_id` é único. Lançamentos manuais não aceitam a categoria "Mensalidade".
- **Nada financeiro é apagado:** pagamentos e lançamentos são cancelados (com motivo, no caso de pagamentos) e continuam no histórico.
- **Auditoria na mesma transação:** `audit()` grava junto com a ação; se a ação falhar, o registro também não existe.
- **Conta separada do vínculo:** `users` é a pessoa; `students` é a pessoa dentro de uma academia. Ver database.md.
- **Erros:** `DomainError` carrega mensagens seguras para o usuário. Erros inesperados vão para o log do servidor e o usuário vê uma mensagem genérica. `error.tsx` trata falhas ao carregar páginas.
