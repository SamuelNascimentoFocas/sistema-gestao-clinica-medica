# Cenário Demonstrativo

Este documento descreve o cenário demonstrativo reproduzível do MVP do Sistema de Gestão de Clínica Médica.

O cenário foi criado para facilitar:

- instalação inicial;
- validação funcional;
- apresentações acadêmicas;
- demonstração de perfis e permissões;
- verificação do isolamento entre consultórios;
- repetição segura em ambiente de desenvolvimento.

## 1. Arquivo responsável

O seeder está localizado em:

```text
backend/database/seeders/demo_scenario_seeder.ts
```

## 2. Requisitos

Antes da execução:

- PostgreSQL deve estar ativo;
- o banco `clinic_system` deve existir;
- o arquivo `backend/.env` deve apontar para o banco de desenvolvimento;
- as migrations devem estar aplicadas;
- `NODE_ENV` não pode ser `production`.

Execute as migrations, quando necessário:

```cmd
cd backend
node ace migration:run
```

## 3. Execução

Dentro de `backend`:

```cmd
node ace db:seed --files=database/seeders/demo_scenario_seeder.ts
```

Saída esperada:

```text
completed database/seeders/demo_scenario_seeder
```

## 4. Idempotência

O seeder usa chaves estáveis e operações de atualização ou criação.

Ele pode ser executado novamente:

```cmd
node ace db:seed --files=database/seeders/demo_scenario_seeder.ts
```

Uma nova execução:

- não duplica as clínicas;
- não duplica os usuários;
- não duplica vínculos;
- não duplica o paciente;
- não duplica o prontuário;
- não duplica o profissional;
- não duplica as disponibilidades;
- mantém dois agendamentos demonstrativos identificáveis;
- atualiza dados do cenário quando necessário.

A idempotência foi validada por duas execuções consecutivas sem erro de chave única, foreign key ou conflito de agenda.

## 5. Proteção contra produção

O seeder interrompe a execução quando:

```text
NODE_ENV=production
```

Teste validado:

```cmd
cmd /C "set NODE_ENV=production&& node ace db:seed --files=database/seeders/demo_scenario_seeder.ts"
echo Exit code: %ERRORLEVEL%
```

Resultado esperado:

```text
O seeder de cenário demonstrativo não pode ser executado em produção
Exit code: 1
```

Essa proteção não substitui controles de implantação. O seeder deve permanecer restrito a ambientes locais, acadêmicos e de demonstração.

## 6. Catálogo de autorização

Antes de criar o cenário, o seeder atualiza o catálogo padrão de permissões e perfis.

Perfis utilizados:

```text
clinic_admin
receptionist
doctor
```

O cenário não cria perfis adicionais.

## 7. Clínicas criadas

### Clínica Horizonte — Demonstração

```text
CNPJ:       00000000000191
Cidade:     Montes Claros
Estado:     MG
Fuso:       America/Sao_Paulo
Status:     ativo
```

### Clínica Vale — Demonstração

```text
CNPJ:       00000000000272
Cidade:     Montes Claros
Estado:     MG
Fuso:       America/Sao_Paulo
Status:     ativo
```

As clínicas são independentes para fins de autorização e contexto operacional.

## 8. Usuários e credenciais

Todos os usuários demonstrativos usam a senha local:

```text
DemoClinic!123
```

A senha é fornecida ao model como texto de entrada e armazenada como hash no banco.

### Administrador demonstrativo

```text
Nome:    Administrador Demonstrativo
E-mail:  admin.demo@clinica.local
Perfil:  clinic_admin
```

Vínculos:

- Clínica Horizonte — Demonstração;
- Clínica Vale — Demonstração.

### Recepcionista demonstrativa

```text
Nome:    Recepcionista Demonstrativa
E-mail:  recepcao.demo@clinica.local
Perfil:  receptionist
```

Vínculo:

- Clínica Horizonte — Demonstração.

### Médica demonstrativa

```text
Nome:    Dra. Helena Demonstrativa
E-mail:  medico.demo@clinica.local
Perfil:  doctor
```

Vínculos:

- Clínica Horizonte — Demonstração;
- Clínica Vale — Demonstração.

## 9. Distribuição dos vínculos

Resultado esperado:

```text
2 clínicas
3 usuários
5 vínculos entre usuário, clínica e perfil
```

Distribuição:

| Usuário | Horizonte | Vale |
|---|---|---|
| Administrador | `clinic_admin` | `clinic_admin` |
| Recepcionista | `receptionist` | sem vínculo |
| Médica | `doctor` | `doctor` |

Essa distribuição permite demonstrar:

- acesso a múltiplos consultórios;
- usuário restrito a um único consultório;
- perfil administrativo;
- perfil administrativo-operacional;
- perfil clínico;
- isolamento por vínculo ativo.

## 10. Paciente demonstrativo

```text
Nome:  Paciente Demonstrativo
CPF:   00000000191
Status: ativo
```

O paciente possui identidade global e dois vínculos locais:

### Vínculo com a Clínica Horizonte

```text
Número local: DEMO-HORIZONTE-001
Status:       ativo
```

### Vínculo com a Clínica Vale

```text
Número local: DEMO-VALE-001
Status:       ativo
```

O paciente possui um único prontuário global.

Resultado esperado:

```text
1 paciente
2 vínculos paciente-clínica
1 prontuário
```

## 11. Profissional demonstrativa

```text
Nome:          Dra. Helena Demonstrativa
CRM:           DEMO0001
UF do CRM:     MG
Especialidade: Clínica Médica
Usuário:       medico.demo@clinica.local
Status:        ativo
```

A profissional possui vínculo ativo com as duas clínicas.

Código local em cada vínculo:

```text
MED-DEMO-01
```

Duração padrão:

```text
30 minutos
```

Resultado esperado:

```text
1 profissional global
2 vínculos profissional-clínica
```

## 12. Disponibilidades semanais

Para cada vínculo profissional-clínica, o seeder cria disponibilidade ativa:

```text
Segunda a sexta-feira
08:00 às 17:00
```

Como existem dois vínculos profissionais, o resultado esperado é:

```text
10 disponibilidades semanais
```

As disponibilidades são independentes por clínica.

## 13. Agendamentos demonstrativos

O cenário mantém dois agendamentos:

### Clínica Horizonte

```text
Paciente:       Paciente Demonstrativo
Profissional:   Dra. Helena Demonstrativa
Horário-base:   10:00
Duração:        30 minutos
Status:         scheduled
Tipo:           consulta_demo
```

### Clínica Vale

```text
Paciente:       Paciente Demonstrativo
Profissional:   Dra. Helena Demonstrativa
Horário-base:   14:00
Duração:        30 minutos
Status:         scheduled
Tipo:           consulta_demo
```

## 14. Cálculo das datas

As datas não são fixadas no código.

O seeder:

1. considera o dia atual no fuso da clínica;
2. começa a busca no dia seguinte;
3. considera apenas segunda a sexta-feira;
4. procura até 90 dias;
5. verifica conflitos ativos do mesmo profissional na mesma clínica;
6. escolhe o primeiro dia disponível para o horário-base;
7. grava o instante em UTC.

Por isso, a data exibida depende do dia em que o seeder for executado e da existência de outros agendamentos ativos.

Em uma validação realizada em 31/07/2026, foram criados:

```text
Clínica Horizonte: 03/08/2026, 10:00–10:30
Clínica Vale:      03/08/2026, 14:00–14:30
```

Essas datas são apenas evidência daquela execução, não uma data permanente do cenário.

## 15. Quantidades esperadas

Após executar o seeder uma ou mais vezes, os dados identificáveis do cenário devem totalizar:

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

## 16. Conferência por SQL

### Usuários, clínicas e perfis

```cmd
psql -h 127.0.0.1 -p 5432 -U clinic_app -d clinic_system -c "SELECT u.email_normalized AS email, c.name AS clinic, r.code AS role, u.is_active AS user_active, ucr.is_active AS membership_active, (u.password_hash <> 'DemoClinic!123') AS password_is_hashed FROM clinic.users u JOIN clinic.user_clinic_roles ucr ON ucr.user_id = u.id JOIN clinic.clinics c ON c.id = ucr.clinic_id JOIN clinic.roles r ON r.id = ucr.role_id WHERE u.email_normalized IN ('admin.demo@clinica.local', 'recepcao.demo@clinica.local', 'medico.demo@clinica.local') ORDER BY u.email_normalized, c.name;"
```

Devem aparecer cinco linhas e:

```text
password_is_hashed = t
```

### Agendamentos

```cmd
psql -h 127.0.0.1 -p 5432 -U clinic_app -d clinic_system -c "SELECT c.name AS clinic, pat.full_name AS patient, pro.full_name AS professional, a.status, to_char(a.starts_at AT TIME ZONE c.timezone, 'YYYY-MM-DD HH24:MI') AS local_start, to_char(a.ends_at AT TIME ZONE c.timezone, 'YYYY-MM-DD HH24:MI') AS local_end, (a.starts_at > now()) AS is_future FROM clinic.appointments a JOIN clinic.clinics c ON c.id = a.clinic_id JOIN clinic.patient_clinics pc ON pc.id = a.patient_clinic_id JOIN clinic.patients pat ON pat.id = pc.patient_id JOIN clinic.clinic_professionals cp ON cp.id = a.clinic_professional_id JOIN clinic.professionals pro ON pro.id = cp.professional_id WHERE a.id IN ('7e7a03d4-5d62-4d0d-9e01-000000000001','7e7a03d4-5d62-4d0d-9e01-000000000002') ORDER BY c.name;"
```

Devem aparecer dois agendamentos, com:

```text
status = scheduled
is_future = t
duração = 30 minutos
```

## 17. Roteiro de demonstração no navegador

Com backend e frontend ativos, acesse:

```text
http://localhost:3000
```

### Etapa 1 — administrador

Entre com:

```text
admin.demo@clinica.local
DemoClinic!123
```

Demonstre:

- acesso às duas clínicas;
- seleção da Clínica Horizonte;
- paciente demonstrativo;
- profissional demonstrativa;
- agendamento futuro;
- administração de membros;
- acesso à auditoria;
- troca para a Clínica Vale;
- presença do mesmo paciente e da mesma profissional;
- agendamento independente da segunda clínica.

### Etapa 2 — recepcionista

Entre com:

```text
recepcao.demo@clinica.local
DemoClinic!123
```

Demonstre:

- acesso apenas à Clínica Horizonte;
- pacientes;
- profissionais;
- agenda e agendamentos;
- ausência de acesso ao prontuário clínico;
- ausência de acesso à auditoria;
- impossibilidade de acessar a Clínica Vale.

### Etapa 3 — médica

Entre com:

```text
medico.demo@clinica.local
DemoClinic!123
```

Demonstre:

- acesso às duas clínicas;
- visualização de pacientes e agendamentos;
- gestão somente da própria agenda;
- operações somente sobre os próprios agendamentos;
- acesso ao prontuário;
- criação de entrada clínica;
- correção sem sobrescrever o registro original;
- anexos privados;
- ausência de acesso à auditoria.

## 18. Auditoria durante a demonstração

Para gerar eventos de auditoria:

1. entre com a médica;
2. selecione uma clínica;
3. abra o prontuário do paciente;
4. informe uma finalidade de acesso;
5. visualize a linha do tempo;
6. liste ou baixe um anexo, quando existir;
7. saia da conta;
8. entre como administrador;
9. abra a área de Auditoria.

Eventos possíveis:

```text
view_timeline
view_entry
list_attachments
download_attachment
```

Finalidades possíveis:

```text
patient_care
care_coordination
legal_obligation
other
```

A auditoria exibe metadados seguros e não expõe conteúdo clínico, credenciais, hashes ou caminhos privados.

## 19. Resultado esperado da demonstração

O cenário deve comprovar:

- autenticação;
- seleção de consultório;
- autorização baseada em perfis;
- menor privilégio;
- isolamento por consultório;
- identidade global de paciente e profissional;
- vínculos locais;
- agenda profissional;
- prevenção de conflito;
- agendamentos futuros;
- prontuário global;
- registros clínicos imutáveis;
- anexos privados;
- auditoria de acesso.

## 20. Credenciais e segurança

As credenciais deste documento são públicas dentro do projeto e servem apenas para demonstração local.

Nunca:

- reutilize a senha em ambiente real;
- execute o cenário em produção;
- use os CPFs, CNPJs ou CRM demonstrativos como dados reais;
- trate o cenário como base de homologação com dados pessoais;
- versione senhas locais de banco ou chaves da aplicação.

## 21. Limpeza do cenário

O MVP não possui um comando específico para remover somente os dados demonstrativos.

Para manter previsibilidade:

- use um banco de desenvolvimento dedicado;
- não execute o seeder em bancos com dados reais;
- faça backup antes de alterações destrutivas;
- recrie o banco de desenvolvimento apenas quando essa operação for intencional e segura.

Não remova registros isoladamente sem considerar foreign keys, vínculos e rastreabilidade clínica.
