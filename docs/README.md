# Documentação do Sistema de Gestão de Clínica Médica

Esta pasta reúne a documentação técnica e funcional do MVP do Sistema de Gestão de Clínica Médica.

## Documentos

### [API.md](API.md)

Inventário das 59 rotas do backend, autenticação, autorização, permissões e regras de escopo por consultório.

### [EXECUCAO.md](EXECUCAO.md)

Guia completo para preparar o PostgreSQL, configurar variáveis de ambiente, instalar dependências, executar migrations e iniciar backend e frontend.

### [CENARIO_DEMONSTRATIVO.md](CENARIO_DEMONSTRATIVO.md)

Descrição do seeder demonstrativo, dados criados, credenciais locais, execução idempotente e roteiro de apresentação.

### [VALIDACAO.md](VALIDACAO.md)

Checklist técnico e funcional para conferir banco, autenticação, autorização, módulos do sistema, testes e builds.

### [ARQUITETURA.md](ARQUITETURA.md)

Visão da arquitetura, organização do código, modelo multi-consultório, decisões de segurança e persistência.

### [CONGELAMENTO_MVP.md](CONGELAMENTO_MVP.md)

Registro do escopo concluído, evidências de validação, limitações conhecidas e funcionalidades deixadas para evoluções posteriores.

## Ordem recomendada de leitura

### Para instalar e executar

1. [EXECUCAO.md](EXECUCAO.md)
2. [CENARIO_DEMONSTRATIVO.md](CENARIO_DEMONSTRATIVO.md)
3. [VALIDACAO.md](VALIDACAO.md)

### Para compreender o funcionamento técnico

1. [ARQUITETURA.md](ARQUITETURA.md)
2. [API.md](API.md)

### Para consultar o estado final da entrega

1. [CONGELAMENTO_MVP.md](CONGELAMENTO_MVP.md)

## Estado da documentação

A documentação de encerramento do MVP está concluída e inclui:

- visão geral do projeto;
- arquitetura;
- instalação e execução;
- configuração do banco;
- migrations e seeds;
- cenário demonstrativo;
- inventário da API;
- autenticação e autorização;
- checklist de validação;
- limitações conhecidas;
- registro de congelamento técnico.

## Escopo documentado

O conjunto documental cobre o estado validado do MVP:

- autenticação e sessão;
- administração global e local;
- perfis, permissões e menor privilégio;
- isolamento por consultório;
- pacientes;
- profissionais;
- agendas;
- agendamentos;
- prontuário eletrônico;
- anexos privados;
- auditoria;
- cenário demonstrativo reproduzível;
- testes e builds.

## Observação

A documentação descreve o MVP acadêmico validado localmente em Windows com Node.js, npm e PostgreSQL instalados no sistema operacional.

O repositório não possui atualmente uma configuração oficial de Docker, implantação em nuvem ou infraestrutura de produção.
