# Checklist de Validação do MVP

Este documento reúne as verificações técnicas e funcionais executadas no MVP do Sistema de Gestão de Clínica Médica e fornece um roteiro reproduzível para novas validações.

## 1. Objetivo

A validação busca confirmar que:

- o projeto instala e executa localmente;
- as migrations são aplicadas;
- o cenário demonstrativo é reproduzível;
- autenticação e autorização funcionam;
- dados são isolados por consultório;
- os módulos principais operam de ponta a ponta;
- testes automatizados e builds passam;
- nenhuma informação clínica é exposta a perfis sem permissão.

## 2. Ambiente da validação final

```text
Windows 10/11
Node.js 24.15.0
npm 11.16.0
PostgreSQL 18.4
Git 2.54.0.windows.1
Backend: AdonisJS 6
Frontend: Next.js 16.2.10
```

## 3. Estado registrado

Na validação final do MVP:

```text
Backend: 88 testes aprovados
Backend: typecheck aprovado
Backend: lint aprovado
Backend: build aprovado
Frontend: typecheck aprovado
Frontend: lint aprovado
Frontend: build aprovado
Seeder demonstrativo: duas execuções consecutivas aprovadas
Seeder em production: bloqueado com exit code 1
```

## 4. Preparação do ambiente

### Banco de desenvolvimento

- [ ] PostgreSQL está ativo.
- [ ] A porta configurada é `5432`.
- [ ] O usuário `clinic_app` consegue conectar.
- [ ] O banco `clinic_system` existe.
- [ ] O banco `clinic_system_test` existe.
- [ ] O banco de testes é separado do banco de desenvolvimento.
- [ ] A extensão `btree_gist` está disponível nos bancos necessários.

Teste de conexão:

```cmd
psql -h 127.0.0.1 -p 5432 -U clinic_app -d clinic_system
```

### Variáveis do backend

- [ ] `backend/.env` existe.
- [ ] `APP_KEY` está preenchida.
- [ ] `NODE_ENV=development`.
- [ ] `DB_HOST=127.0.0.1`.
- [ ] `DB_PORT=5432`.
- [ ] `DB_DATABASE=clinic_system`.
- [ ] `DRIVE_DISK=private_fs`.
- [ ] Nenhuma senha real foi colocada em `.env.example`.

### Variáveis de teste

- [ ] `backend/.env.test` existe.
- [ ] Contém `DB_DATABASE=clinic_system_test`.

### Variáveis do frontend

- [ ] `frontend/.env.local` existe.
- [ ] Contém `BACKEND_API_URL=http://localhost:3333`.

## 5. Instalação e migrations

### Backend

```cmd
cd backend
npm ci
node ace migration:run
node ace migration:status
```

Verificar:

- [ ] Dependências instaladas sem falha.
- [ ] Todas as migrations estão concluídas.
- [ ] O schema `clinic` existe.
- [ ] As tabelas principais foram criadas.
- [ ] A restrição de sobreposição de agendamentos foi criada.
- [ ] As tabelas de prontuário, anexos e auditoria existem.

### Frontend

```cmd
cd frontend
npm ci
```

Verificar:

- [ ] Dependências instaladas sem falha.
- [ ] O arquivo `.env.local` foi carregado pelo Next.js.

## 6. Cenário demonstrativo

Execute duas vezes:

```cmd
cd backend
node ace db:seed --files=database/seeders/demo_scenario_seeder.ts
node ace db:seed --files=database/seeders/demo_scenario_seeder.ts
```

Verificar:

- [ ] As duas execuções terminam com sucesso.
- [ ] Não ocorre violação de chave única.
- [ ] Não ocorre conflito de agenda.
- [ ] Não há duplicação do cenário.

Quantidades esperadas:

```text
Clínicas:               2
Usuários:               3
Vínculos de usuários:   5
Pacientes:              1
Vínculos de paciente:   2
Prontuários:            1
Profissionais:          1
Vínculos profissionais: 2
Disponibilidades:      10
Agendamentos:           2
```

### Proteção contra produção

```cmd
cmd /C "set NODE_ENV=production&& node ace db:seed --files=database/seeders/demo_scenario_seeder.ts"
echo Exit code: %ERRORLEVEL%
```

Verificar:

- [ ] A execução é interrompida.
- [ ] A mensagem informa que o seeder não pode ser executado em produção.
- [ ] O código de saída é `1`.

## 7. Inicialização dos serviços

### Backend

```cmd
cd backend
npm run dev
```

Verificar:

- [ ] Servidor ativo em `http://localhost:3333`.
- [ ] `GET /` retorna `status: ok`.

### Frontend

Em outro terminal:

```cmd
cd frontend
npm run dev
```

Verificar:

- [ ] Frontend ativo em `http://localhost:3000`.
- [ ] Login é carregado sem erro.
- [ ] Não há erro de variável `BACKEND_API_URL`.

## 8. Autenticação

### Login válido

- [ ] Administrador demonstrativo consegue entrar.
- [ ] Recepcionista demonstrativa consegue entrar.
- [ ] Médica demonstrativa consegue entrar.

### Login inválido

- [ ] Senha incorreta é rejeitada.
- [ ] Usuário inativo não recebe token.
- [ ] Sessão autenticada retorna somente dados seguros do usuário.
- [ ] Senha e hash não aparecem em respostas.

### Logout

- [ ] Logout encerra a sessão.
- [ ] A sessão encerrada não acessa rotas protegidas.

## 9. Consultórios e isolamento

### Administrador demonstrativo

- [ ] Visualiza Clínica Horizonte.
- [ ] Visualiza Clínica Vale.
- [ ] Consegue alternar entre as duas clínicas.

### Recepcionista demonstrativa

- [ ] Visualiza somente Clínica Horizonte.
- [ ] Não acessa Clínica Vale pela interface.
- [ ] Acesso direto a recurso da Clínica Vale é bloqueado.

### Médica demonstrativa

- [ ] Visualiza as duas clínicas.
- [ ] O contexto selecionado é respeitado.
- [ ] Dados administrativos locais não se misturam indevidamente.

## 10. Administração de membros

Com administrador de consultório:

- [ ] Lista membros da clínica.
- [ ] Sem query, usa `page=1` e `perPage=20`.
- [ ] Retorna `{ data, meta }` com `total`, `perPage`, `currentPage` e `lastPage`.
- [ ] Filtra por busca de nome/e-mail, perfil e status do vínculo.
- [ ] Mantém isolamento por clínica durante filtros e paginação.
- [ ] Ordena por criação crescente e usa o identificador como desempate.
- [ ] Cria usuário local com perfil válido.
- [ ] Altera perfil de membro.
- [ ] Ativa ou inativa vínculo permitido.
- [ ] Não acessa vínculo pertencente a outra clínica.
- [ ] O último administrador local efetivo não pode ser removido ou desativado.

Com recepcionista:

- [ ] Administração de membros é bloqueada.

## 11. Pacientes

- [ ] Lista pacientes vinculados ao consultório.
- [ ] Cria paciente com dados válidos.
- [ ] Vincula uma identidade global a outro consultório.
- [ ] CPF global duplicado não gera paciente duplicado.
- [ ] Atualização respeita validações.
- [ ] Ativação ou inativação ocorre no vínculo local.
- [ ] Paciente de outro consultório não é acessado sem vínculo autorizado.

## 12. Profissionais

- [ ] Lista profissionais da clínica.
- [ ] Cria profissional com CRM válido.
- [ ] Vincula profissional global a mais de uma clínica.
- [ ] CRM duplicado é rejeitado.
- [ ] Usuário profissional opcional respeita unicidade.
- [ ] Ativação ou inativação do vínculo local funciona.
- [ ] Profissional de outra clínica não é acessado fora do contexto permitido.

## 13. Agenda profissional

### Administrador de consultório

- [ ] Visualiza agenda.
- [ ] Cria disponibilidade semanal.
- [ ] Atualiza disponibilidade.
- [ ] Ativa ou inativa disponibilidade.
- [ ] Cria bloqueio.
- [ ] Atualiza bloqueio.
- [ ] Ativa ou inativa bloqueio.
- [ ] Sobreposições inválidas são rejeitadas.

### Médica

- [ ] Visualiza agendas permitidas.
- [ ] Gerencia a própria agenda.
- [ ] Não gerencia agenda de outro profissional.
- [ ] Vínculo profissional inativo bloqueia gestão própria.

## 14. Agendamentos

### Operações básicas

- [ ] Lista por intervalo válido.
- [ ] Cria agendamento válido.
- [ ] Consulta agendamento.
- [ ] Atualiza dados administrativos.
- [ ] Confirma agendamento.
- [ ] Cancela com motivo válido.
- [ ] Conclui respeitando regras temporais.
- [ ] Marca ausência respeitando regras temporais.
- [ ] Reagenda preservando o registro anterior.

### Concorrência e consistência

- [ ] Agendamentos ativos do mesmo profissional não se sobrepõem.
- [ ] Intervalos adjacentes são permitidos.
- [ ] Reagendamento com conflito é revertido.
- [ ] Controle otimista de versão rejeita atualização desatualizada.
- [ ] Duas requisições concorrentes ao mesmo horário preservam apenas uma.
- [ ] Mudança direta de horário exige a operação de reagendamento.

### Escopo próprio

- [ ] Médica cria agendamento apenas para o próprio perfil.
- [ ] Médica atualiza apenas os próprios agendamentos.
- [ ] Médica altera status apenas dos próprios agendamentos.
- [ ] Médica não administra agendamento de outro profissional.

## 15. Prontuário eletrônico

### Autorização

- [ ] Médica possui acesso.
- [ ] Recepcionista não vê o módulo.
- [ ] Acesso direto por URL da recepcionista é bloqueado.
- [ ] Nenhum dado clínico é retornado a perfil sem permissão.

### Linha do tempo

- [ ] A finalidade de acesso é exigida.
- [ ] A linha do tempo global é carregada.
- [ ] Entradas de múltiplas clínicas autorizadas aparecem ordenadas.
- [ ] Contexto ativo do paciente é validado.
- [ ] Visualização gera log de auditoria.

### Entrada clínica

- [ ] Entrada é criada com profissional derivado pelo backend.
- [ ] Conteúdo obrigatório é validado.
- [ ] Agendamento incompatível é rejeitado.
- [ ] Usuário sem perfil profissional ativo não registra entrada.

### Correção

- [ ] Correção cria novo registro.
- [ ] Registro original permanece intacto.
- [ ] Cadeia de correção é linear.
- [ ] Correções concorrentes preservam apenas uma correção válida.

## 16. Anexos clínicos

- [ ] Envio exige permissão.
- [ ] Anexo fica em `backend/storage/private`.
- [ ] Arquivo não é servido diretamente.
- [ ] Extensão permitida é validada.
- [ ] Tipo real do arquivo é validado.
- [ ] Tamanho é validado.
- [ ] Quantidade é validada.
- [ ] Anexo é vinculado à entrada e clínica corretas.
- [ ] Listagem exige finalidade válida.
- [ ] Download exige finalidade válida.
- [ ] Listagem e download geram auditoria.
- [ ] Headers seguros são enviados no download.
- [ ] Arquivo ausente fisicamente não é entregue.
- [ ] Perfil sem permissão não acessa o anexo.

## 17. Auditoria

### Acesso administrativo

- [ ] Administrador de consultório vê Auditoria no menu.
- [ ] Médica não vê Auditoria no menu.
- [ ] Recepcionista não vê Auditoria no menu.
- [ ] Acesso direto sem `audit_logs.read` é bloqueado.

### Listagem

- [ ] Eventos aparecem em ordem decrescente.
- [ ] Usuário responsável aparece.
- [ ] Paciente aparece.
- [ ] Finalidade aparece.
- [ ] Data e hora respeitam o fuso da clínica.
- [ ] Identificador do prontuário aparece.
- [ ] Metadados seguros do anexo aparecem quando aplicável.
- [ ] Conteúdo clínico não aparece.
- [ ] E-mail, CPF, hash e caminho privado não aparecem.

### Filtros

- [ ] Data inicial.
- [ ] Data final.
- [ ] Usuário.
- [ ] Paciente.
- [ ] Ação.
- [ ] Finalidade.
- [ ] Combinação de filtros.
- [ ] Estado vazio.
- [ ] Limpar filtros.
- [ ] Paginação.

### Isolamento

- [ ] Logs de outra clínica não aparecem.
- [ ] Filtros não permitem atravessar o contexto da clínica.

## 18. Validação automatizada do backend

Execute:

```cmd
cd backend
npm run format
npm run typecheck
npm run lint
npm test
npm run build
```

Critérios:

- [ ] Prettier termina sem falha.
- [ ] TypeScript termina sem erros.
- [ ] ESLint termina sem erros.
- [ ] Todos os testes passam.
- [ ] Build termina com sucesso.

Evidência da validação final:

```text
Tests 98 passed (98)
Contratos HTTP: 59 rotas, 47 validações (12 query e 35 body/upload)
Novo contrato: GET /api/v1/clinics/:clinicId/members:query
Build completed
```

## 19. Validação do frontend

Execute:

```cmd
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Critérios:

- [ ] Os 24 testes frontend passam.
- [ ] TypeScript termina sem erros.
- [ ] ESLint termina sem erros.
- [ ] Build do Next.js termina com sucesso.
- [ ] Rotas autenticadas dinâmicas são reconhecidas.
- [ ] Não há script inexistente sendo usado como critério.
- [ ] As cinco DataTables consultam rotas BFF relativas e tratam loading, erro e vazio.
- [ ] Paginação usa metadados numéricos, sem URLs do paginator Lucid.

Evidência da Fase 9: membros direcionados `4/4`, contratos aprovados, backend
funcional `98/98`, frontend `24/24`, typecheck, lint, build e `git diff --check`
aprovados.

## 20. Validação do Git

Na raiz:

```cmd
git diff --check
git status
git log --oneline --decorate
```

Critérios:

- [ ] `git diff --check` não aponta whitespace inválido.
- [ ] Não há arquivos acidentais.
- [ ] Segredos não foram adicionados.
- [ ] `backend/storage/private` não está versionado.
- [ ] `.env` e `.env.local` não estão versionados.
- [ ] Cada módulo foi integrado à `main` por histórico identificável.
- [ ] A árvore está limpa antes do congelamento final.

## 21. Validação da documentação

- [ ] `README.md` principal existe.
- [ ] `docs/README.md` existe.
- [ ] `docs/API.md` existe.
- [ ] `docs/EXECUCAO.md` existe.
- [ ] `docs/CENARIO_DEMONSTRATIVO.md` existe.
- [ ] `docs/VALIDACAO.md` existe.
- [ ] `docs/ARQUITETURA.md` existe.
- [ ] `docs/CONGELAMENTO_MVP.md` existe.
- [ ] Links relativos funcionam.
- [ ] Arquivos estão em UTF-8.
- [ ] Comandos descritos existem no projeto.
- [ ] A documentação não promete Docker ou implantação não implementada.
- [ ] Credenciais demonstrativas estão claramente marcadas como locais.
- [ ] Senhas reais não aparecem.

## 22. Critério de aprovação

O MVP pode ser considerado tecnicamente validado quando:

1. uma instalação local nova consegue aplicar as migrations;
2. o cenário demonstrativo é criado sem duplicação;
3. backend e frontend iniciam;
4. os três perfis demonstrativos autenticam;
5. isolamento e menor privilégio são confirmados;
6. pacientes, profissionais, agendas e agendamentos funcionam;
7. prontuário, anexos e auditoria funcionam;
8. os 88 testes do backend passam;
9. builds de backend e frontend passam;
10. a documentação permite reproduzir o fluxo sem depender do histórico da conversa.

## 23. Resultado final registrado

Durante o desenvolvimento e fechamento do MVP, foram confirmados:

- autenticação e sessão;
- administração global e local;
- catálogo de papéis e permissões;
- menor privilégio;
- isolamento por consultório;
- pacientes e profissionais globais com vínculos locais;
- agenda profissional;
- agendamentos com concorrência e proteção temporal;
- prontuário global com correções imutáveis;
- anexos privados;
- auditoria segura;
- cenário demonstrativo idempotente;
- bloqueio de seed em produção;
- 88 testes aprovados;
- builds de backend e frontend aprovados.

As limitações e itens fora do escopo estão documentados em `CONGELAMENTO_MVP.md`.
