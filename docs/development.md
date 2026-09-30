# Desenvolvimento

## Rotina

```bash
npm run dev         # servidor de desenvolvimento
npm test            # testes (PostgreSQL real, banco de TEST_DATABASE_URL)
npm run typecheck   # checagem de tipos
npm run build       # build de produção
```

## Onde colocar cada coisa

- **Regra de negócio ou consulta nova:** em `services/`, recebendo o `AcademyContext` e filtrando por `academyId`.
- **Validação de formulário:** em `lib/validation.ts` (Zod), com mensagens em português.
- **Ação de formulário:** `actions.ts` da página, sempre começando com `requireAcademyAdmin()`.
- **Mudança no banco:** edite `db/schema.ts` e rode `npm run db:generate`; revise o SQL gerado em `drizzle/`.

Cuidado conhecido: em subconsultas SQL escritas à mão, refira-se à coluna externa com o nome da tabela por extenso (`fees.id`), não com `${fees.id}`. Em consultas de uma só tabela, o Drizzle omite o nome da tabela e `id` passaria a apontar para a tabela interna. Há um teste de regressão para isso.

## Ferramentas

- **TypeScript 6.0**, fixado de propósito: o TypeScript 7 ainda não é suportado pelo `typescript-eslint`, usado no lint do Next.js.
- **Lint:** `npm run lint` (regras do Next.js para React, hooks e acessibilidade básica, e TypeScript).
- **Integração contínua:** `.github/workflows/ci.yml` roda tipos, lint, testes, build e ponta a ponta com um PostgreSQL real.

## Testes

`tests/setup.ts` apaga o schema do banco de testes, aplica as migrations e cada teste cria a própria academia (`tests/helpers.ts`), então os testes não dependem uns dos outros.

| Arquivo | O que verifica |
| --- | --- |
| `money-and-dates.test.ts` | Conversão e soma de valores em centavos, formatação, fuso de Brasília, cálculo de atraso, último dia do mês, mensagens de validação |
| `business.test.ts` | Cadastro e pesquisa de alunos, isolamento entre academias, atraso calculado, período duplicado, geração do mês, pagamento parcial e acima do saldo, cancelamento, bloqueio de edição, pagamento pendente, entradas automáticas, totais do financeiro, auditoria, totais agregados |
| `auth.test.ts` | Hash de senha, login, usuário inativo, academia suspensa e limite de tentativas |
| `enrollment.test.ts` | Token do convite, revogação, validade e limite de usos, cadastro só na academia do convite, isolamento da fila, pendentes fora das listas e cobranças, maioridade, e-mail repetido, aprovação, área do aluno restrita aos próprios dados, vínculo com aluno existente, recusa (sem bloquear um novo pedido futuro) e entrada em outra academia |

| `registration.test.ts` | CPF e CNPJ, modalidades por academia, menores e responsáveis, irmãos, saúde restrita e primeira utilização |
| `hardening.test.ts` | Totais sobre o filtro inteiro, paginação sem repetir registros, consentimento registrado, sessões encerradas e **concorrência**: pagamentos simultâneos, convite de uso único, e-mail repetido e aprovação dupla |

### Ponta a ponta (`tests/e2e`, Playwright)

Rodam no navegador contra o build de produção e um banco próprio (`E2E_DATABASE_URL`), recriado com os dados de exemplo: login, pagamento pela busca com erro de validação e cancelamento, geração de mensalidades, convite com aprovação e área do aluno, criança com responsável, saúde e ficha, totais e paginação, e navegação no celular. Uma confirmação nativa do navegador em qualquer fluxo faz o teste falhar.

Antes desses, também foram feitos testes de ponta a ponta no navegador sobre o build de produção: login, pagamento parcial e cancelamento, financeiro, auditoria, acesso a outra academia pela URL, telas no celular e no computador, busca de aluno, janela de confirmação, filtros recolhíveis, geração de mensalidades, área do aluno e o fluxo completo do convite (menor de idade barrado, cadastro, fila isolada por academia, aprovação, vínculo com aluno existente, área do aluno e revogação do código). Ele não faz parte do `npm test`.
