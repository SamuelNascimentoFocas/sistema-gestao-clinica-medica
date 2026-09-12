# Checklist de validação do sistema

Este documento organiza a validação técnica e funcional do Sistema de Gestão de
Clínica Médica. Ele descreve invariantes e categorias de checks, sem fixar
quantidades de testes, rotas ou componentes que mudam com a evolução do projeto.

Para preparação do ambiente, consulte [EXECUCAO.md](EXECUCAO.md). Os contratos
HTTP estão em [API.md](API.md), as decisões de segurança em
[ARQUITETURA.md](ARQUITETURA.md) e o comportamento das telas em
[FORMULARIOS.md](FORMULARIOS.md).

## 1. Objetivo e limites

A validação deve confirmar que:

- migrations são reproduzíveis em banco PostgreSQL isolado e autorizado;
- autenticação, sessão e onboarding por convite preservam credenciais;
- autorização global e clinic-scoped é decidida pelo backend;
- isolamento entre clínicas e menor privilégio permanecem ativos;
- módulos administrativos e clínicos funcionam de ponta a ponta;
- prontuário, anexos e logs respeitam os gates de recurso;
- testes, análise estática e builds relevantes passam;
- o diff contém apenas alterações intencionais e não inclui segredos.

Não execute migrations, rollback, seeders ou testes que alteram banco contra uma
base reutilizada ou com dados reais. Use bancos separados de desenvolvimento e
teste. As precauções específicas da baseline estão em
[MIGRATIONS.md](MIGRATIONS.md).

## 2. Preparação do ambiente

- [ ] Node.js, npm e PostgreSQL atendem aos requisitos descritos em
      [EXECUCAO.md](EXECUCAO.md).
- [ ] O backend possui `.env` próprio, sem segredos versionados.
- [ ] O frontend possui `.env.local` com `BACKEND_API_URL` apontando para o
      backend AdonisJS.
- [ ] Desenvolvimento e testes usam bancos PostgreSQL distintos.
- [ ] A extensão `btree_gist` pode ser instalada no banco isolado usado para a
      aplicação das migrations.
- [ ] O transporte SMTP e `FRONTEND_URL` estão configurados quando o fluxo de
      convite for exercitado.
- [ ] O limite configurado de anexos não excede o teto estrutural do banco.

O cenário opcional de demonstração e sua proteção contra `production` estão em
[CENARIO_DEMONSTRATIVO.md](CENARIO_DEMONSTRATIVO.md). O catálogo de autorização,
o cenário demonstrativo e o bootstrap do primeiro Global Admin são operações
distintas.

## 3. Topologia e limites de confiança

- [ ] O browser usa rotas same-origin `/api/**` do Next.js.
- [ ] Route Handlers do Next.js encaminham as chamadas ao AdonisJS.
- [ ] O access token do AdonisJS fica em cookie HTTP-only e não é devolvido ao
      JavaScript do browser.
- [ ] Componentes do browser não chamam diretamente a URL do AdonisJS.
- [ ] O BFF limita e normaliza payloads, mas não substitui autenticação,
      autorização, validação ou regra de negócio do backend.
- [ ] Respostas e mensagens de erro não expõem stack, SQL, credenciais, tokens ou
      outros detalhes internos.

## 4. Banco e migrations

Em banco novo, vazio e explicitamente autorizado:

```cmd
cd backend
node ace migration:status
node ace migration:run
node ace migration:status
```

Validar:

- [ ] A guarda de linhagem impede aplicar a baseline granular sobre um ledger
      legado incompatível.
- [ ] O schema `clinic` e suas estruturas são criados na ordem esperada.
- [ ] As FKs compostas preservam o escopo por clínica.
- [ ] A exclusion constraint impede sobreposição de agendamentos ativos.
- [ ] Entradas clínicas e logs de acesso possuem proteção de imutabilidade.
- [ ] Roles de sistema permanecem globais e Custom Roles exigem escopo de clínica.
- [ ] `users.password_hash` aceita `NULL` durante onboarding por convite.
- [ ] `user_invitation_tokens` mantém digest, expiração e estados terminais, sem
      coluna para token bruto.
- [ ] O rollback, quando fizer parte da validação planejada, ocorre somente em
      banco descartável e respeita as proteções descritas em `MIGRATIONS.md`.

Os scripts especializados `scripts/verify_migration_baseline.ts` e
`scripts/verify_migration_guard.ts` possuem pré-condições próprias. Não use suas
opções de execução contra bancos de desenvolvimento ou produção.

## 5. Autenticação e sessão

- [ ] Credenciais válidas autenticam pelo BFF.
- [ ] Senha incorreta retorna falha sanitizada.
- [ ] Usuário inativo não autentica.
- [ ] Usuário convidado cujo `passwordHash` ainda é nulo não autentica.
- [ ] A senha persistida é verificada por bcrypt e nunca aparece em resposta.
- [ ] A identidade segura retornada ao frontend não contém hash nem access token.
- [ ] Logout encerra a sessão frontend e revoga a credencial backend correspondente.
- [ ] Rotas autenticadas voltam a exigir login depois do logout.
- [ ] O cookie de sessão é HTTP-only e não é usado como armazenamento de clínica.

## 6. Onboarding por convite

### Convite global

- [ ] Somente Global Admin autorizado cria convite global.
- [ ] O payload contém nome, e-mail e, opcionalmente, memberships formadas por
      `clinicId` e `roleId`.
- [ ] O fluxo não aceita senha, confirmação de senha, `roleCode` ou
      `isGlobalAdmin`.
- [ ] Memberships iniciais são validadas pelo backend e não criam Professional.

### Convite clinic-scoped

- [ ] Administrador autorizado convida usuário dentro da clínica corrente.
- [ ] O membership inicial usa exclusivamente `roleId` atribuível na clínica.
- [ ] Clínica, role e autoridade do ator são revalidados pelo backend.
- [ ] Usuário sem permissão não consegue criar ou reenviar convite.

### Ciclo de vida

- [ ] O usuário define e confirma a própria senha no aceite.
- [ ] Convite válido pode ser aceito uma única vez.
- [ ] Convites inválidos, expirados, revogados ou já consumidos são rejeitados.
- [ ] Reenvio revoga o convite pendente anterior antes de criar o novo.
- [ ] Aceites concorrentes não configuram a senha duas vezes.
- [ ] O token bruto não é persistido; somente seu digest é armazenado.
- [ ] Respostas administrativas, URLs de API e logs não expõem o token bruto.
- [ ] Falha de SMTP produz mensagem sanitizada e preserva a possibilidade de
      reenvio conforme o estado persistido.

O comando `node ace admin:create`, implementado em
`backend/commands/create_admin.ts`, é somente o bootstrap inicial. Ele cria um
Global Admin diretamente no backend e não substitui o onboarding normal por
convite.

## 7. Global Admin

- [ ] `isGlobalAdmin=true` concede autoridade global com wildcard sem exigir
      membership.
- [ ] Global Admin sem membership acessa `/admin` após o login.
- [ ] Usuário comum não acessa `/admin` nem vê sua navegação global.
- [ ] `/admin` lista e pagina usuários por meio dos BFFs globais.
- [ ] Convite, edição permitida, status e reenvio de usuário usam os BFFs globais.
- [ ] `/admin` lista, cria, edita e altera o status de clínicas via BFF.
- [ ] Clínica ativa oferece entrada para sua administração clinic-scoped; clínica
      inativa não recebe atalho que contorne as proteções do backend.
- [ ] Convite global aceita somente memberships `clinicId` + `roleId`.
- [ ] Não existe campo ou ação para promover ou rebaixar Global Admin na UI.
- [ ] Não existe endpoint HTTP de promoção ou rebaixamento de Global Admin.
- [ ] O gate server-side da página é proteção de experiência; os endpoints AdonisJS
      continuam aplicando a autorização global definitiva.

## 8. RBAC, Custom Roles e membros

### Catálogo e concessão

- [ ] Permissões, roles e relações RolePermission são carregadas pelo catálogo de
      autorização.
- [ ] Roles de sistema são globais e imutáveis.
- [ ] Custom Roles pertencem a uma única clínica.
- [ ] Criação e atualização de Custom Role aceitam somente permissões que o ator
      pode conceder.
- [ ] Ativação ou reativação não permite recuperar uma combinação de permissões
      acima da autoridade atual do ator.
- [ ] O wildcard não pode ser atribuído a Custom Role.
- [ ] `roles.manage` e `users.assign_role` são capacidades independentes.
- [ ] O `RoleGrantService` aplica escopo, subconjunto e anti-escalation mesmo que a
      UI já tenha filtrado as opções.

### Membros da clínica

- [ ] A listagem usa paginação e filtros server-side sem atravessar a clínica.
- [ ] Novo usuário é incluído por convite clinic-scoped, não por senha definida
      pelo administrador.
- [ ] Criação e alteração de membership recebem `roleId`, nunca `roleCode` como
      input HTTP.
- [ ] Roles de sistema e Custom Roles atribuíveis são descobertas dinamicamente.
- [ ] Alteração de role, ativação e inativação preservam isolamento e
      anti-escalation.
- [ ] O último administrador local efetivo não pode ser removido ou inativado.
- [ ] Usuário sem `users.assign_role` não administra memberships.

## 9. Multi-clínica e navegação

- [ ] A clínica corrente deriva do pathname `/clinics/[clinicId]/**`.
- [ ] O backend revalida `clinicId`, clínica ativa, membership e permissões.
- [ ] Não existe clínica global persistida em cookie, `localStorage` ou React
      Context como autoridade.
- [ ] O switcher recebe clínicas já carregadas e não busca credenciais no browser.
- [ ] Itens clinic-scoped são filtrados por permissões e preservam o menu móvel.
- [ ] Global Admin pode entrar em uma clínica ativa sem criar clínica corrente
      fictícia para a área global.
- [ ] Acesso direto a recurso de outra clínica é rejeitado pelo backend.

## 10. Pacientes e profissionais

### Pacientes

- [ ] Patient mantém identidade global e CPF único quando informado.
- [ ] PatientClinic representa o vínculo, número local e status por clínica.
- [ ] Um paciente pode estar ligado a mais de uma clínica sem duplicar sua
      identidade global.
- [ ] Criação, busca, atualização e status preservam paginação e isolamento.
- [ ] Um único MedicalRecord global é associado ao paciente.

### Profissionais

- [ ] Professional é distinto de User e pode existir sem conta de acesso.
- [ ] ClinicProfessional é distinto de UserClinicRole e representa o vínculo
      profissional local.
- [ ] CRM e UF respeitam unicidade e normalização implementadas.
- [ ] Um profissional pode estar ligado a várias clínicas.
- [ ] Vínculo opcional com User respeita elegibilidade, unicidade e estado ativo.
- [ ] Duração padrão, aceite de agendamentos, código local e status são validados
      no vínculo correto.

## 11. Agenda profissional

- [ ] Disponibilidades semanais validam dia, intervalo e estado.
- [ ] Bloqueios pontuais validam período, motivo e sobreposição relevante.
- [ ] Horários são interpretados segundo o timezone da clínica.
- [ ] Usuário com gestão geral administra agendas autorizadas da clínica.
- [ ] Profissional com `schedules.manage_own` gerencia somente a própria agenda.
- [ ] Permissão de gestão própria não concede administração geral de agendas.
- [ ] Vínculos profissionais inativos impedem operações próprias.

## 12. Agendamentos

- [ ] Listagem usa intervalo, filtros e paginação server-side.
- [ ] Criação valida paciente, profissional, clínica, duração, disponibilidade e
      bloqueios.
- [ ] Estados aceitos são `scheduled`, `confirmed`, `completed`, `cancelled` e
      `no_show`.
- [ ] Confirmação, conclusão, cancelamento e ausência respeitam transições e regras
      temporais.
- [ ] Agendamentos ativos do mesmo profissional não se sobrepõem.
- [ ] Intervalos adjacentes continuam permitidos.
- [ ] Controle otimista rejeita versão desatualizada.
- [ ] Requisições concorrentes preservam a constraint de conflito.
- [ ] Reagendamento cria sucessor e preserva o agendamento anterior.
- [ ] Escopos `own` permitem operar somente sobre o Professional associado ao
      usuário; permissões gerais permanecem separadas.

## 13. Prontuário eletrônico

- [ ] Existe um MedicalRecord global por Patient.
- [ ] A timeline global é apresentada em ordem decrescente e respeita paginação.
- [ ] A finalidade do acesso é obrigatória e gera registro de auditoria.
- [ ] O acesso exige permissão, vínculo ativo PatientClinic e o gate relacional de
      recurso, salvo autoridade explícita `medical_records.access_all` ou wildcard.
- [ ] Relação profissional qualificante é validada no contexto da clínica e do
      paciente.
- [ ] O autor clínico é derivado pelo backend a partir de Professional e
      ClinicProfessional ativos.
- [ ] Entradas são imutáveis; correção cria uma nova entrada ligada à anterior.
- [ ] Correções concorrentes preservam uma única sucessora válida.
- [ ] `appointmentId` é opcional e, quando usado, referencia somente agendamento
      concluído e compatível.
- [ ] O conteúdo clínico usa o formato Markdown restrito e versionado aceito pelo
      contrato; HTML arbitrário não é tratado como capacidade clínica.
- [ ] Usuário sem relação clínica ou permissão recebe resposta sem dados do
      prontuário.

## 14. Anexos clínicos

- [ ] Upload exige autorização e vínculo válido com prontuário e entrada.
- [ ] Extensão, assinatura/tipo real, quantidade e tamanho são validados.
- [ ] Arquivos usam storage privado e chave opaca; nome original é apenas metadata.
- [ ] Não existe URL pública permanente para o conteúdo.
- [ ] Listagem e download exigem finalidade e passam pelo gate do prontuário.
- [ ] Download envia `private, no-store`, `nosniff` e disposição segura.
- [ ] Conteúdo ativo ou arbitrário não é habilitado como preview inline livre.
- [ ] Qualquer preview oferecido permanece limitado a conteúdo considerado seguro.
- [ ] Arquivo ausente, inconsistente ou não autorizado não é entregue.
- [ ] Operações relevantes geram logs sem conteúdo clínico ou caminho privado.

## 15. Auditoria e logging seguro

- [ ] Logs de acesso ao prontuário registram ator, clínica, paciente, finalidade,
      ação e metadata segura necessária.
- [ ] Consultas de auditoria são filtradas e paginadas dentro da clínica.
- [ ] Conteúdo clínico, CPF, credenciais, hashes e storage keys não aparecem na UI
      de auditoria.
- [ ] Senhas, access tokens e tokens brutos de convite não são gravados nos logs do
      servidor.
- [ ] Falhas conhecidas usam eventos e códigos sanitizados.
- [ ] Erros desconhecidos não são serializados integralmente para o browser.

## 16. Checks automatizados do backend

Os scripts disponíveis em `backend/package.json` são:

```cmd
cd backend
npm test
npm run test:contracts
npm run typecheck
npm run lint
npm run build
```

Critérios:

- [ ] Testes unitários e funcionais passam em banco isolado.
- [ ] Testes de contratos HTTP e segurança passam.
- [ ] TypeScript termina sem erros.
- [ ] ESLint termina sem erros.
- [ ] O build AdonisJS termina com sucesso.

`npm test` aplica migrations no setup do Japa. Confirme o banco de teste antes de
executá-lo. O script `npm run format` existe, mas escreve nos arquivos; use-o
somente durante implementação autorizada e sempre audite o diff resultante.

## 17. Checks automatizados do frontend

Os scripts disponíveis em `frontend/package.json` são:

```cmd
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Critérios:

- [ ] Testes de contratos, schemas, BFFs e componentes passam.
- [ ] TypeScript termina sem erros.
- [ ] ESLint termina sem erros.
- [ ] O build Next.js termina com sucesso.
- [ ] Rotas autenticadas e Route Handlers esperados são reconhecidos.
- [ ] DataTables preservam paginação e filtros server-side.
- [ ] Testes confirmam ausência de chamadas diretas do browser ao AdonisJS para os
      fluxos cobertos.

O frontend não possui script npm de formatação dedicado. Não documente um comando
inexistente como critério de aprovação.

## 18. Validação manual da interface

- [ ] Login, logout e redirecionamento por identidade funcionam.
- [ ] Aceite de convite trata estados válido, inválido, expirado e consumido.
- [ ] `/admin` funciona para Global Admin sem membership.
- [ ] Gestão global de usuários não apresenta senha ou promoção global.
- [ ] Gestão global de clínicas permite entrar somente em clínicas operacionais.
- [ ] Administração da clínica apresenta membros e Custom Roles conforme permissões.
- [ ] Pacientes, profissionais, agendas e agendamentos exibem loading, erro e vazio.
- [ ] Timeline clínica exige finalidade e não permite edição destrutiva.
- [ ] Anexos são enviados e baixados sem URL pública ou exposição de storage key.
- [ ] Navegação desktop e móvel preserva foco, labels e ações por botão.

O roteiro demonstrativo é útil para uma apresentação clinic-scoped, mas não
substitui os testes de autorização, concorrência ou isolamento.

## 19. Git e documentação

Na raiz do repositório:

```cmd
git diff --check
git status
```

- [ ] `git diff --check` não encontra whitespace inválido.
- [ ] O diff contém somente paths aprovados para a unidade de trabalho.
- [ ] `.env`, `.env.local`, anexos privados e referências locais não foram
      adicionados ao Git.
- [ ] Nenhum segredo, token ou dado clínico real aparece no diff.
- [ ] Documentos referenciados existem e os links relativos permanecem válidos.
- [ ] Mudanças de contrato possuem documentação coerente em API, arquitetura e
      formulários.

## 20. Critério de aprovação

Uma unidade pode ser considerada validada quando, conforme seu escopo:

1. as suítes relevantes passam em ambiente isolado;
2. typecheck, lint e builds aplicáveis passam;
3. migrations e contratos de banco são reproduzíveis e seguros para a linhagem;
4. autenticação, convite, autorização e isolamento preservam seus invariantes;
5. concorrência e regras de recurso são cobertas nos domínios afetados;
6. backend permanece a autoridade final e o BFF não expõe credenciais;
7. documentação corresponde ao comportamento implementado;
8. o working tree e o índice estão em estado conhecido e controlado.

Resultados numéricos pertencem ao log ou relatório da execução que os produziu,
não a este checklist permanente. O registro histórico do congelamento original
continua disponível em [CONGELAMENTO_MVP.md](CONGELAMENTO_MVP.md).
