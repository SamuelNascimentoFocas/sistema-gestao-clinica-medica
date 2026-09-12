# AGENTS.md — Instruções de Trabalho para o Codex

## 1. Contexto do projeto

Este repositório contém o **Sistema de Gestão de Clínica Médica**, desenvolvido como projeto de iniciação científica.

Stack principal:

- Backend: AdonisJS v6
- ORM: Lucid ORM
- Banco: PostgreSQL
- Frontend: Next.js App Router
- UI: shadcn/ui + Tailwind CSS
- Linguagem: TypeScript/JavaScript

## 2. Objetivo atual

O objetivo desta etapa é **adequar o projeto ao parecer técnico recebido da empresa**, preservando o funcionamento já validado e sem ampliar automaticamente o escopo.

A fonte primária do parecer é:

`docs/PARECER_TECNICO_EMPRESA.md`

Esse arquivo contém:

1. o texto original integral do desenvolvedor;
2. uma organização operacional auxiliar;
3. uma regra explícita de interpretação.

## 3. Hierarquia de fontes

Antes de alterar qualquer código, leia nesta ordem:

1. `docs/PARECER_TECNICO_EMPRESA.md`;
2. o documento descritivo original do projeto;
3. `README.md`;
4. `docs/API.md`;
5. `docs/ARQUITETURA.md`;
6. `docs/EXECUCAO.md`;
7. `docs/VALIDACAO.md`;
8. `docs/CENARIO_DEMONSTRATIVO.md`;
9. `docs/CONGELAMENTO_MVP.md`;
10. `database_schema.sql`, quando necessário.

### Regra de precedência

- O **texto original do desenvolvedor** dentro de `docs/PARECER_TECNICO_EMPRESA.md` é a fonte primária para o parecer técnico.
- A organização operacional do mesmo arquivo é auxiliar.
- Em caso de divergência, prevalece o texto original.
- O descritivo original continua sendo a referência funcional do sistema.
- Se o parecer técnico e o descritivo funcional parecerem conflitar, **não decidir silenciosamente**: interromper a alteração, explicar o conflito e pedir aprovação.
- Não incorporar automaticamente achados de auditorias internas ou melhorias não solicitadas nesta etapa.

## 4. Interpretação da linguagem do parecer

Não transformar automaticamente recomendações em obrigações absolutas.

Preservar a força das palavras usadas pelo desenvolvedor, especialmente:

- “considerar”;
- “ideal”;
- “seria ideal”;
- “costuma-se”;
- “tende a ser o mais recomendado”;
- “podem ser melhor organizadas”.

Para esses itens:

1. analisar a implementação atual;
2. avaliar impacto e compatibilidade;
3. propor a adoção ou uma alternativa tecnicamente melhor;
4. justificar;
5. pedir aprovação antes de uma decisão que amplie significativamente o escopo.

## 5. Regra de ouro antes de qualquer alteração

Na primeira interação desta etapa:

1. inspecionar todo o repositório relevante;
2. informar o diretório de trabalho;
3. informar o repositório Git detectado;
4. informar a branch atual;
5. informar o `origin`;
6. informar se está trabalhando na pasta local, em worktree local ou cloud;
7. ler integralmente `docs/PARECER_TECNICO_EMPRESA.md`;
8. localizar os arquivos atingidos por cada item;
9. produzir um plano de execução ordenado por dependências, risco e impacto;
10. mapear cada item do parecer para os arquivos/áreas afetados;
11. identificar recomendações já atendidas parcial ou integralmente;
12. indicar as validações que serão executadas;
13. **não modificar nenhum arquivo até o plano ser aprovado pelo usuário**.

## 6. Git e proteção do histórico

- Nunca desenvolver diretamente na `main`.
- Preservar a tag histórica `v0.1.0-mvp`.
- Antes da primeira alteração, criar ou utilizar uma branch específica.
- Branch sugerida:
  `refactor/company-review-compliance`
- Não fazer force push.
- Não reescrever a história da `main`.
- Não mover nem apagar tags existentes.
- Não fazer merge na `main` sem aprovação explícita.
- Não executar `git push` sem aprovação explícita.
- `git pull`/`fetch` só devem ser executados quando necessários e sem descartar alterações locais.
- Nunca usar comandos destrutivos como `git reset --hard`, `git clean -fd`, rebase destrutivo ou checkout que descarte trabalho sem aprovação.
- Preferir commits pequenos e coerentes por fase.
- Antes de cada commit, apresentar resumo preciso do diff e dos checks executados.

## 7. Estratégia de execução

Trabalhar em fases pequenas e verificáveis.

Para cada fase:

1. explicar o objetivo;
2. indicar o item ou itens exatos do parecer atendidos;
3. listar arquivos afetados;
4. implementar somente o necessário;
5. preservar contratos e comportamento público quando possível;
6. executar testes/checks;
7. corrigir regressões introduzidas;
8. mostrar resumo do diff;
9. indicar o estado de cada item: concluído, parcial, não adotado com justificativa ou bloqueado;
10. aguardar aprovação antes de avançar para uma fase grande seguinte.

Não realizar uma refatoração massiva de todo o repositório em uma única alteração.

## 8. Regras gerais de engenharia

- Não remover validações, constraints, autorização ou testes para fazer a suíte passar.
- Não enfraquecer segurança existente.
- Não expor tokens ao JavaScript do navegador.
- Preservar isolamento multi-clínica.
- Backend continua sendo a autoridade final de autorização.
- Evitar duplicação.
- Preferir responsabilidades pequenas e coesas.
- Não criar abstrações sem necessidade real.
- Manter TypeScript estrito.
- Não usar `any` como atalho sem justificativa.
- Não alterar contrato público silenciosamente.
- Se um contrato mudar, atualizar consumidores, testes e documentação.
- Não registrar senha, token ou conteúdo clínico sensível em logs.
- Não adicionar segredos ao Git.
- Não adicionar dependência nova sem explicar necessidade, impacto e alternativa.
- Não alterar regra de negócio ambígua sem aprovação.

## 9. Backend — padrão esperado

### 9.1 Controllers

Para CRUD, seguir resource pattern quando aplicável:

- `index`
- `store`
- `show`
- `update`
- `destroy`

Ações não CRUD devem ficar em controllers especializados.

Controllers devem se concentrar em:

1. receber a requisição HTTP;
2. validar entrada;
3. chamar service/caso de uso;
4. transformar resultado em resposta HTTP.

Evitar helpers extensos e regras de aplicação diretamente no controller.

### 9.2 Services

- Extrair regras auxiliares e de aplicação para `app/services`.
- Priorizar controllers com maior concentração de lógica, especialmente medical record attachments.
- Evitar “god services”.
- Separar serviços por responsabilidade/domínio/operação.
- Preservar transações e invariantes de domínio.
- Não mover lógica para service apenas para deslocar linhas: a extração deve melhorar coesão e testabilidade.

### 9.3 Validação

- Toda action que recebe input deve validar antes do uso.
- Preferir VineJS conforme os padrões do AdonisJS.
- Validar body, params/query quando aplicável.
- Backend permanece autoridade final mesmo que o frontend valide.

### 9.4 Rotas

Avaliar uma estrutura com:

- grupo `/api/v1`;
- grupo autenticado;
- grupo de Administrador Geral;
- grupos por contexto/módulo.

Preservar URLs públicas sempre que possível.

A reorganização deve reduzir repetição sem tornar a árvore de rotas difícil de compreender.

### 9.5 Migrations

- Novas alterações estruturais devem ser feitas por novas migrations.
- Não editar migrations históricas já aplicadas/publicadas sem aprovação explícita.
- Preferir APIs de schema/migration quando representarem corretamente a operação.
- SQL raw deve ser evitado quando houver suporte adequado do schema builder.
- SQL raw continua permitido quando necessário para recursos específicos do PostgreSQL que não sejam bem representados pelas APIs disponíveis, como:
  - extensões;
  - exclusion constraints;
  - ranges;
  - triggers;
  - funções;
  - constraints avançadas.
- Quando raw SQL for necessário:
  - manter trecho pequeno;
  - explicar por que foi necessário;
  - cobrir com testes/validação quando possível.
- Preferir uma operação lógica clara por migration.

### 9.6 Testes e factories

- Criar Lucid factories para dados recorrentes.
- Substituir criação manual repetitiva quando isso melhorar clareza.
- Não forçar factory em testes onde um registro manual explícito torna a regra mais clara.
- Preservar cobertura existente.
- Adicionar teste para comportamento alterado.
- Cobrir caminho feliz, erros, autorização e concorrência quando relevante.

## 10. Frontend — padrão esperado

### 10.1 Cliente HTTP

Avaliar a recomendação de Axios em relação à arquitetura atual.

Se Axios for adotado:

- criar instância centralizada;
- evitar múltiplas configurações duplicadas;
- padronizar tratamento de erros/timeouts quando adequado;
- respeitar o BFF;
- não transformar Server Components em Client Components sem necessidade;
- não expor token no browser.

Se `fetch` continuar necessário em partes server-side, documentar a razão. A intenção do parecer é centralização e consistência, não substituição cega de toda chamada HTTP.

### 10.2 Formulários

- Preferir React Hook Form nos CRUDs onde trouxer benefício.
- Adicionar validação client-side estruturada.
- Preferir schemas reutilizáveis quando apropriado.
- Backend continua validando definitivamente.
- Unificar create/edit quando os campos e regras forem compatíveis.
- Com `id`: edição e valores preenchidos.
- Sem `id`: criação e valores vazios.
- Preferir Dialog do shadcn/ui para fluxos curtos/adequados.
- Usar tela própria quando tamanho, acessibilidade ou complexidade justificarem.

### 10.3 Sidebar e múltiplas clínicas

- Avaliar `sidebar-07` do shadcn/ui.
- Adaptar o seletor para clínicas.
- Preservar clínica atual, permissões e navegação existente.
- Não perder funcionalidades apenas para aderir visualmente ao bloco.

### 10.4 Query, filtros e paginação

- Padronizar query params.
- Usar filtros e paginação no backend.
- Evitar carregar conjuntos inteiros sem necessidade.
- Não introduzir limites artificiais silenciosos.
- Manter estados de loading, erro e vazio claros.

### 10.5 Data Table

- Criar/reutilizar um componente de Data Table para listagens CRUD quando adequado.
- Encapsular paginação, filtros, sorting e ações de linha.
- Considerar a convenção da empresa de passar rota/configuração e o componente realizar a query.
- Não aplicar a convenção de forma cega onde um Server Component ou outra estrutura atual for tecnicamente superior; nesse caso explicar a decisão.

### 10.6 Estado e contratos

- Centralizar tratamento HTTP repetido.
- Evitar respostas externas tratadas apenas por type assertion quando houver risco de contrato inconsistente.
- Preservar benefícios de Server Components.
- Evitar estados locais duplicados desnecessariamente.

## 11. Ordem inicial recomendada para o planejamento

O Codex deve reavaliar esta ordem após ler o código, mas considerar inicialmente:

1. mapear o parecer contra a implementação atual;
2. refatorar Services e controllers resource;
3. reorganizar route groups;
4. auditar validators;
5. introduzir factories e migrar testes repetitivos;
6. decidir a estratégia das migrations históricas sem reescrevê-las automaticamente;
7. centralizar camada HTTP do frontend;
8. introduzir React Hook Form/validação;
9. implementar padrão Data Table/query;
10. unificar create/edit com Dialog quando apropriado;
11. migrar sidebar/múltiplas clínicas;
12. executar validação integral;
13. atualizar documentação.

Não seguir esta ordem mecanicamente se a análise revelar dependências melhores; justificar qualquer reordenação.

## 12. Compatibilidade e não regressão

Após cada fase relevante, executar os scripts existentes.

### Backend

```bash
npm run format
npm run typecheck
npm run lint
npm test
npm run build
```

### Frontend

```bash
npm run lint
npm run typecheck
npm run build
```

Se novos testes forem introduzidos, executá-los também.

Não declarar fase concluída com checks quebrados sem apresentar claramente:

- comando;
- erro;
- causa provável;
- se foi introduzido pela alteração;
- próximo passo.

## 13. Banco de dados

- `database_schema.sql` serve como referência do estado estrutural auditado.
- As migrations continuam sendo a fonte versionável da evolução do schema.
- Não aplicar alteração destrutiva no banco real sem aprovação.
- Preservar constraints existentes salvo necessidade explícita e justificada.
- Novas migrations devem ser reversíveis quando tecnicamente seguro.
- Não apagar dados ou resetar banco do usuário sem autorização.

## 14. Documentação

Atualizar documentação quando uma mudança afetar:

- API;
- arquitetura;
- execução;
- variáveis de ambiente;
- banco;
- scripts;
- comportamento funcional;
- padrões de frontend/backend.

Não marcar uma recomendação como implementada antes dos checks correspondentes.

## 15. Escopo e contenção

A prioridade desta etapa é **exclusivamente o parecer técnico da empresa**.

Não implementar automaticamente:

- achados adicionais de auditorias internas;
- features novas;
- melhorias opcionais;
- requisitos não solicitados.

Exceção: se durante a implementação surgir problema crítico que possa comprometer:

- segurança;
- integridade de dados;
- funcionamento;
- compatibilidade;
- requisito funcional original;

interromper, explicar e solicitar aprovação antes de ampliar o escopo.

## 16. Interação esperada com o usuário

O usuário está acompanhando o projeto de forma orientada e precisa compreender as mudanças.

Ao concluir uma fase:

- explicar em linguagem clara o que mudou;
- indicar por que mudou;
- relacionar com o item exato do parecer;
- informar os testes executados;
- não ocultar erros;
- destacar decisões que ainda precisam de aprovação.

## 17. Critério final de conclusão

A etapa de adequação ao parecer só estará concluída quando:

1. todos os itens do parecer tiverem sido avaliados;
2. os itens adotados estiverem implementados e validados;
3. os itens não adotados tiverem justificativa técnica explícita;
4. nenhum requisito funcional original tiver sido quebrado;
5. todos os checks relevantes estiverem verdes;
6. documentação estiver atualizada;
7. working tree estiver em estado conhecido;
8. mudanças estiverem em branch própria;
9. merge/push só ocorrerem após aprovação do usuário.

Objetivo: adequar o CRUD aos padrões solicitados pela empresa com o menor risco possível, mantendo qualidade, rastreabilidade e compreensão das decisões.
