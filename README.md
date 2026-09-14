# Santa Cruz Acessível

Protótipo escolar de Design Thinking para participação cidadã, mobilidade e acessibilidade em Santa Cruz do Rio Pardo — SP.

## Arquivos
- `index.html` — interface completa.
- `css/styles.css` — identidade visual e responsividade.
- `js/app.js` — mapa, filtros, formulários, autenticação, dashboard e tempo real.
- `js/config.js` — URL e chave pública do Supabase.
- `supabase.sql` — tabelas, RLS, Storage, trigger e dados fictícios.
- `README.md` — este guia.

## 1. Criar o projeto no Supabase
1. Crie um projeto em https://supabase.com/.
2. Abra **SQL Editor** e execute todo o conteúdo de `supabase.sql`.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon/public**.
4. Cole os valores em `js/config.js`.
5. Nunca use a chave `service_role` no frontend.

## 2. Criar o primeiro usuário da Prefeitura
1. Em **Authentication → Users**, crie um usuário com e-mail e senha.
2. Copie o UUID desse usuário.
3. No SQL Editor, execute:
   `update public.profiles set role='prefeitura' where id='UUID_DO_USUARIO';`
4. Para administrador, use `role='admin'`.

## 3. Fotos
O SQL cria o bucket `report-photos` no Supabase Storage. A interface envia fotos para esse bucket e salva a URL em `reports.photo_url`.

Para produção, recomenda-se restringir upload por autenticação e criar um fluxo de aprovação das imagens antes de torná-las públicas.

## 4. Rodar localmente
Como o projeto usa módulos/CDNs e geolocalização, é melhor servir a pasta por HTTP:
- VS Code + extensão Live Server; ou
- `python -m http.server 8000`
Depois abra `http://localhost:8000`.

## 5. Publicar
- **Netlify:** arraste a pasta para o deploy manual ou conecte um repositório Git.
- **Vercel:** importe o repositório.
- **GitHub Pages:** publique a raiz do projeto.

## 6. Segurança
A chave `anon/public` é própria para frontend. A segurança real depende das políticas RLS no Supabase. O dashboard verifica a role em `profiles`, e somente `prefeitura`/`admin` recebem autorização para alterar ocorrências.

## 7. Observações
- Sem Supabase configurado, o site entra em modo demonstração e mostra ocorrências fictícias; ele não substitui o banco online.
- Depois de configurar o Supabase, os dados passam a ser gravados online e as alterações em `reports` são recebidas em tempo real pelo canal Realtime.
- O heatmap não foi incluído como camada externa para manter o protótipo simples e leve; o mapa colaborativo e os filtros já estão funcionais. Para adicionar heatmap, pode-se incluir `leaflet.heat` e uma camada com as coordenadas das ocorrências.
