# Santa Cruz Acessível

Projeto de Design Thinking e participação cidadã para
Santa Cruz do Rio Pardo - SP.

## Tecnologias

- HTML
- CSS
- JavaScript
- Leaflet
- OpenStreetMap
- Supabase
- GitHub Pages

## Funcionalidades

- Cadastro de usuários
- Login
- Mapa colaborativo
- Registro de problemas
- Localização pelo navegador
- Seleção de localização no mapa
- Envio de fotos
- Categorias
- Prioridades
- Status
- Progresso de 0% a 100%
- Área da Prefeitura
- Área de administrador
- Estatísticas

## Estrutura

santa-cruz-acessivel/

index.html

css/
  styles.css

js/
  config.js
  app.js

supabase.sql

README.md

## Configuração do Supabase

1. Crie um projeto no Supabase.

2. Abra o SQL Editor.

3. Cole o conteúdo de `supabase.sql`.

4. Execute o SQL.

5. Vá em Project Settings > API.

6. Copie a Project URL.

7. Copie a chave pública anon.

8. Abra:

js/config.js

9. Coloque os dois valores:

const SUPABASE_URL = "...";

const SUPABASE_ANON_KEY = "...";

Nunca coloque a chave service_role no GitHub.

## Criar usuário da Prefeitura

Primeiro crie uma conta normalmente pelo site.

Depois, no SQL Editor do Supabase, descubra o e-mail
da conta e execute:

update public.profiles
set role = 'prefeitura'
where email = 'EMAIL_DA_PREFEITURA';

Para administrador:

update public.profiles
set role = 'admin'
where email = 'EMAIL_DO_ADMIN';

## GitHub Pages

Depois de criar os arquivos no GitHub:

1. Abra Settings.
2. Abra Pages.
3. Em Source escolha GitHub Actions ou Deploy from branch.
4. Escolha a branch principal.
5. Salve.
6. Aguarde a publicação.

O site poderá ser acessado pelo endereço fornecido pelo GitHub Pages.

## Segurança

A chave `anon/public` pode ser usada no frontend.

Nunca publique:

- service_role key
- senha do banco
- senha de usuários
- credenciais administrativas

A segurança dos dados é controlada pelas políticas RLS do Supabase.
