# Sistema de Gestão de Clínica Médica

Sistema web full stack desenvolvido como projeto acadêmico para apoiar a gestão administrativa e assistencial de clínicas médicas com múltiplos consultórios, profissionais e perfis de acesso.

O projeto implementa autenticação, autorização baseada em papéis, separação de dados por consultório, cadastro de pacientes e profissionais, gestão de agendas e agendamentos, prontuário eletrônico, anexos clínicos e registros de auditoria.

## Estado do projeto

O núcleo funcional do MVP está implementado e validado.

Principais módulos concluídos:

- autenticação e encerramento de sessão;
- administrador global;
- administração de consultórios;
- usuários e vínculos com consultórios;
- autorização baseada em papéis e permissões;
- pacientes com identidade global e vínculo local;
- profissionais e agendas;
- agendamentos e controle de conflitos;
- prontuário eletrônico global;
- correções sem sobrescrita do registro original;
- anexos clínicos privados;
- auditoria de acesso ao prontuário;
- cenário demonstrativo reproduzível.

O dashboard analítico avançado, a conteinerização e a implantação em infraestrutura de produção não fazem parte do escopo congelado deste MVP.

## Tecnologias

### Backend

- Node.js
- TypeScript
- AdonisJS 6
- Lucid ORM
- VineJS
- PostgreSQL
- autenticação por access token
- armazenamento privado com AdonisJS Drive
- testes funcionais com Japa

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- componentes ShadCN/Base UI

## Arquitetura

```text
Navegador
   |
   v
Frontend Next.js
http://localhost:3000
   |
   v
Backend AdonisJS
http://localhost:3333
   |
   v
PostgreSQL
127.0.0.1:5432
```

Estrutura principal:

```text
clinica-medica/
├── backend/
│   ├── app/
│   ├── commands/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── storage/private/
│   └── tests/
├── frontend/
│   └── src/
├── docs/
├── .gitignore
└── README.md
```

## Requisitos

O MVP foi validado no seguinte ambiente:

```text
Windows 10/11
Node.js 24.15.0
npm 11.16.0
PostgreSQL 18.4
Git 2.54.0.windows.1
```

Essas são as versões utilizadas durante a validação, e não uma declaração formal de versões mínimas suportadas.

Também são necessários:

- PostgreSQL ativo na porta `5432`;
- usuário de banco com permissão sobre os bancos do projeto;
- banco de desenvolvimento `clinic_system`;
- banco de testes `clinic_system_test`.

## Instalação rápida

### 1. Backend

```cmd
cd backend
npm ci
copy .env.example .env
notepad .env
```

Configure no arquivo `backend/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=clinic_app
DB_PASSWORD=SUA_SENHA_LOCAL
DB_DATABASE=clinic_system
```

Nunca coloque a senha real no `.env.example`.

Gere a chave da aplicação:

```cmd
node ace generate:key
```

Confirme que `APP_KEY` está preenchida no arquivo `backend/.env`.

Execute as migrations somente em um banco novo e vazio. A baseline granular substitui
os nomes das migrations anteriores; não a execute sobre um banco com o histórico
antigo. Consulte [Baseline de migrations](docs/MIGRATIONS.md) antes de reutilizar
qualquer banco existente.

```cmd
node ace migration:run
```

Inicie o backend:

```cmd
npm run dev
```

O backend será disponibilizado em:

```text
http://localhost:3333
```

### 2. Frontend

Em outro terminal:

```cmd
cd frontend
npm ci
copy .env.example .env.local
npm run dev
```

O arquivo `frontend/.env.local` deve conter:

```env
BACKEND_API_URL=http://localhost:3333
```

O frontend será disponibilizado em:

```text
http://localhost:3000
```

## Cenário demonstrativo

O projeto possui um seeder reproduzível para desenvolvimento e apresentação.

Execute dentro de `backend`:

```cmd
node ace db:seed --files=database/seeders/demo_scenario_seeder.ts
```

O seeder:

- atualiza o catálogo de permissões e perfis;
- cria duas clínicas fictícias;
- cria usuários com perfis diferentes;
- cria um paciente vinculado às duas clínicas;
- cria um profissional vinculado às duas clínicas;
- cria disponibilidades semanais;
- cria dois agendamentos futuros;
- pode ser executado novamente sem duplicar o cenário;
- recusa execução quando `NODE_ENV=production`.

Credenciais locais demonstrativas:

```text
Administrador:
admin.demo@clinica.local

Recepcionista:
recepcao.demo@clinica.local

Médico:
medico.demo@clinica.local

Senha compartilhada do cenário:
DemoClinic!123
```

Essas credenciais são exclusivamente demonstrativas e não devem ser reutilizadas em ambientes reais.

## Administrador global

Para criar um administrador global interativamente:

```cmd
cd backend
node ace admin:create
```

O comando solicita:

- nome completo;
- e-mail;
- senha com pelo menos 12 caracteres;
- confirmação da senha;
- confirmação final da operação.

## Testes

O backend usa o banco `clinic_system_test`, definido localmente em:

```text
backend/.env.test
```

Conteúdo esperado:

```env
DB_DATABASE=clinic_system_test
```

O restante da configuração é carregado do ambiente local do backend.

Execute:

```cmd
cd backend
npm test
```

A suíte aplica as migrations antes dos testes. Na validação atual da branch de adequação,
foram aprovados:

```text
98 testes funcionais
```

O banco de testes deve ser separado do banco de desenvolvimento.

## Verificações de qualidade

### Backend

```cmd
cd backend
npm run format
npm run typecheck
npm run lint
npm test
npm run build
```

### Frontend

```cmd
cd frontend
npm run typecheck
npm run lint
npm run build
```

O frontend não possui atualmente scripts próprios de teste automatizado ou formatação.

## Armazenamento de anexos

Os anexos clínicos são armazenados localmente em:

```text
backend/storage/private
```

Características:

- visibilidade privada;
- arquivos não são servidos diretamente pelo servidor;
- acesso ocorre somente pelas rotas autorizadas do backend;
- downloads relevantes geram registros de auditoria;
- o diretório é ignorado pelo Git.

Não use esse diretório como estratégia definitiva de armazenamento para uma implantação distribuída sem antes definir persistência, backup e recuperação.

## Segurança

O MVP inclui:

- senhas armazenadas por hash;
- autenticação por token;
- usuários e vínculos ativáveis e desativáveis;
- autorização por papel e permissão;
- princípio do menor privilégio;
- isolamento por consultório;
- validação de contexto de pacientes, profissionais e agendamentos;
- prevenção de sobreposição de agendamentos ativos;
- prontuário com registros imutáveis;
- correções encadeadas;
- anexos privados;
- auditoria de acesso clínico;
- segredos e arquivos locais excluídos do Git.

Este projeto é um protótipo acadêmico. Uma implantação real ainda exige revisão de infraestrutura, proteção operacional, backups, observabilidade, gestão de segredos e avaliação jurídica e de segurança.

## Docker

O repositório não possui atualmente:

- `Dockerfile`;
- `docker-compose.yml`;
- configuração oficial de execução por contêiner.

A execução validada do MVP é local, utilizando Node.js, npm e PostgreSQL instalados no sistema operacional.

## Documentação

Consulte a pasta [`docs`](docs/README.md) para:

- instalação e execução detalhadas;
- cenário demonstrativo;
- roteiro de validação;
- arquitetura e decisões principais;
- escopo congelado do MVP;
- limitações e evoluções futuras.

## Licença

O backend está marcado como `UNLICENSED`.

O projeto não deve ser considerado software distribuível sob uma licença pública até que uma licença seja formalmente escolhida e adicionada ao repositório.
