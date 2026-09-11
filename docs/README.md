# Documentação do Sistema de Gestão de Clínica Médica

Este diretório reúne a documentação versionada do projeto. O README da raiz é a porta de entrada; os documentos abaixo aprofundam contratos, decisões, operação e evidências sem depender do histórico dos chats de desenvolvimento.

Documentos de entrada fora desta pasta:

- [README da raiz](../README.md): visão geral, stack, arquitetura resumida e início rápido;
- [README do frontend](../frontend/README.md): topologia BFF, sessão, rotas e comandos específicos da aplicação Next.js.

## Índice

### [API.md](API.md)

Inventário e contratos HTTP do backend, incluindo autenticação, autorização global e por clínica, convites, Custom Roles, módulos clínicos e anexos.

### [ARQUITETURA.md](ARQUITETURA.md)

Decisões arquiteturais e de segurança: AdonisJS, Next App Router/BFF, PostgreSQL, sessão HTTP-only, multi-clínica, autorização, prontuário, anexos e logging seguro.

### [FORMULARIOS.md](FORMULARIOS.md)

Telas, formulários, schemas e validações do frontend, incluindo onboarding por convite, administração global e fluxos clinic-scoped.

### [EXECUCAO.md](EXECUCAO.md)

Preparação do PostgreSQL, variáveis de ambiente, instalação, migrations, catálogo de autorização, bootstrap do Administrador Global, execução e comandos de qualidade.

### [MIGRATIONS.md](MIGRATIONS.md)

Baseline granular do banco, ordem de dependências, guarda de linhagem, SQL específico do PostgreSQL e cuidados com bancos que possuam histórico anterior.

### [VALIDACAO.md](VALIDACAO.md)

Estratégia e checklist de validação técnica e funcional do backend, frontend, banco e Git.

### [CENARIO_DEMONSTRATIVO.md](CENARIO_DEMONSTRATIVO.md)

Seeder opcional de demonstração, dados fictícios, credenciais locais e roteiro de apresentação.

### [CONGELAMENTO_MVP.md](CONGELAMENTO_MVP.md)

Registro histórico do congelamento do MVP, escopo avaliado, limitações e critérios usados naquele marco.

### [FACTORIES.md](FACTORIES.md)

Factories Lucid e helpers usados para preparar dados recorrentes nos testes do backend.

## Ordem recomendada

### Primeiro contato e execução

1. [README da raiz](../README.md)
2. [EXECUCAO.md](EXECUCAO.md)
3. [README do frontend](../frontend/README.md), para manutenção da aplicação Next.js
4. [CENARIO_DEMONSTRATIVO.md](CENARIO_DEMONSTRATIVO.md), se forem necessários dados de demonstração

### Compreensão técnica

1. [ARQUITETURA.md](ARQUITETURA.md)
2. [API.md](API.md)
3. [FORMULARIOS.md](FORMULARIOS.md)
4. [MIGRATIONS.md](MIGRATIONS.md)

### Revisão e evidências

1. [VALIDACAO.md](VALIDACAO.md)
2. [CONGELAMENTO_MVP.md](CONGELAMENTO_MVP.md), quando o marco histórico do MVP for relevante
3. [FACTORIES.md](FACTORIES.md), para manutenção dos testes backend

## Limites deste conjunto

A documentação descreve o sistema acadêmico e sua execução local. O repositório não entrega configuração oficial de contêiner, nuvem, TLS, proxy reverso, backup ou observabilidade de produção. Contratos detalhados devem ser consultados em seus documentos canônicos, evitando duplicação entre este índice, o README da raiz e os guias especializados.
