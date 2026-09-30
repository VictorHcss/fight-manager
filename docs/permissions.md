# Perfis e permissões

## Perfis

| Perfil | Situação no MVP |
| --- | --- |
| `ACADEMY_ADMIN` | **Implementado.** Acesso completo aos dados da própria academia: alunos, mensalidades, pagamentos, financeiro, auditoria e administradores. Todos os administradores de uma academia têm o mesmo nível de acesso. |
| `PLATFORM_ADMIN` | **Implementado de forma mínima.** Vê apenas `/plataforma`: lista de academias com nome, situação, número de alunos ativos e de administradores. **Não acessa alunos, mensalidades, pagamentos nem dados pessoais.** Se tentar abrir as telas da academia, é redirecionado. |
| `STUDENT` | **Implementado de forma mínima.** Conta criada pelo próprio aluno, pelo convite ou em "Criar conta" (sem academia). Sem academia ou com o pedido pendente, vê só o aviso correspondente. Depois de aprovado, vê em `/aluno` apenas os próprios dados (cadastro, mensalidades e pagamentos), somente leitura. Não acessa nenhuma tela da academia. |

## Isolamento entre academias

- Toda tabela de negócio tem `academy_id`.
- Todo serviço de academia recebe um `AcademyContext` (`services/context.ts`), obtido **da sessão**, nunca de um parâmetro da requisição, e filtra todas as consultas por `academy_id`, inclusive em gravações e atualizações.
- Não existe função que busque um aluno, mensalidade ou pagamento só pelo ID.
- Buscar o ID de outra academia pela URL mostra "Não encontramos o que você procurava", exatamente como um ID inexistente.
- Relações cruzadas são conferidas: não é possível lançar pagamento de um aluno numa mensalidade de outro.
- Há testes automatizados para isso (`tests/business.test.ts`, "isolamento entre academias").

## Privacidade do administrador da plataforma

Pelo princípio de menor privilégio, o `PLATFORM_ADMIN` não tem acesso aos dados das academias. Quando o suporte com acesso a dados for implementado, ele deve exigir liberação explícita por academia e gerar registro de auditoria (ver roadmap). Hoje, esse acesso **não existe**.

## Auditoria

Registradas em `audit_logs`, na mesma transação da ação: cadastro e alteração de alunos (com os campos alterados), mudança de status, criação, edição, cancelamento e geração de mensalidades, criação, confirmação e cancelamento de pagamentos (com o motivo), lançamentos e cancelamentos no financeiro, criação e desativação de administradores e troca de senha. Cada registro guarda o usuário, a academia e o horário. A consulta está em **Auditoria** no menu e no histórico de cada aluno. Os registros não podem ser editados pela interface.

## Planejado (não implementado)

Permissões por função dentro da academia (ex.: recepção sem acesso ao financeiro), recursos adicionais para o aluno, painel completo da plataforma, acesso de suporte auditado. Ver [roadmap.md](roadmap.md).

## Convites e entrada de alunos

- A Academia A só adiciona uma conta de aluno pelo e-mail exato (não há busca nem lista de contas), e o pedido criado é dela; a Academia B não o vê.
- Só o administrador da plataforma cria academias; ele vê números agregados, nunca alunos, mensalidades ou pagamentos.
- O convite da Academia A só cria vínculo com a Academia A: a academia vem do token, resolvida no servidor, nunca de um campo do formulário.
- A fila de solicitações e as ações de aprovar, vincular e recusar filtram pela academia do administrador. A Academia B não vê nem decide pedidos da Academia A (há testes para isso).
- A vinculação só aceita um aluno da mesma academia, sem conta e já aprovado.
- A área do aluno consulta sempre pelo par (vínculo, conta logada) e exige o status `active`. Não é possível ver dados de outro aluno trocando o ID.
- Pedidos pendentes e recusados não aparecem na lista de alunos, não recebem mensalidades nem pagamentos.

## Dados sensíveis (0.4.0)

- **Saúde:** lida só na aba Saúde do perfil e, se o administrador marcar, na ficha impressa. Exige consentimento registrado. A auditoria guarda que houve alteração, nunca o conteúdo. Não aparece em listas, buscas, mensagens, na área do aluno nem para o administrador da plataforma.
- **CPF:** completo no formulário e na ficha; mascarado (`529.***.***-25`) no perfil e nas listas.
- **Responsáveis e modalidades** são da academia: não é possível ligar um aluno a um responsável ou a uma modalidade de outra academia (há testes para isso).

## Direitos do titular (0.6.0)

- **Exportação:** no perfil, **Mais ações → Exportar dados (LGPD)** baixa um JSON com tudo o que o sistema guarda sobre o aluno (inclusive saúde, responsáveis, mensalidades e pagamentos). O aluno baixa os próprios dados em **Minha área → Baixar meus dados**. Cada exportação fica na auditoria.
- **Eliminação:** só para aluno inativo, sem mensalidade em aberto nem pagamento aguardando confirmação (enquanto há dívida, a academia tem motivo legítimo para manter os dados). Exige digitar ELIMINAR. Apaga nome, contatos, documentos, endereço, emergência, saúde, observações e consentimentos; remove os vínculos com responsáveis e apaga os responsáveis que não cuidam de mais ninguém; desativa e anonimiza a conta de acesso (se não tiver outros vínculos). Mensalidades, pagamentos e lançamentos continuam, com o nome trocado por "Aluno removido XXXXXX", inclusive nas descrições do financeiro e na auditoria.
- **Recibo:** o administrador vê os recibos da academia; o aluno, só os do próprio vínculo. Pagamento aguardando confirmação não tem recibo; pagamento cancelado sai marcado como cancelado.
