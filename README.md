# 🌾 Cobrança Pro — Plataforma de Gestão de Títulos

Sistema SaaS profissional de cobrança de títulos para empresa de peças agrícolas.

## 🚀 Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS**
- **Recharts** (gráficos)
- **React Context** (estado global)

## 📦 Instalação

```bash
npm install
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 🗂 Módulos

| Página | Rota |
|--------|------|
| Dashboard | `/dashboard` |
| Títulos | `/titulos` |
| Gestão de Recebimentos | `/gestao-recebimentos` |
| Importações CSV | `/importacoes` |
| Disparos WhatsApp | `/disparos` |
| Configurações | `/configuracoes` |

## 📥 Importação CSV

Formato esperado:

```
nome;telefone;numero_nf;numero_titulo;valor_principal;juros;total;dias_atraso
Fazenda São João;+5565999990001;NF-12401;DUP-001;15000;750;15750;12
```

Suporta `;` ou `,` como separador. Colunas em qualquer ordem.

## 🔌 Integração Z-API (WhatsApp)

Configure na tela de **Configurações**:
- Instance ID
- Token de acesso
- Webhook URL (opcional)

## 🗺 Próximos Passos

- [ ] Backend Node.js + Express
- [ ] MongoDB Atlas (persistência)
- [ ] Deploy Render (API)
- [ ] Integração real Z-API
- [ ] Autenticação (NextAuth)
- [ ] Importação de PDF

## 📁 Estrutura

```
src/
  app/
    (app)/
      dashboard/
      titulos/
      gestao-recebimentos/
      importacoes/
      disparos/
      configuracoes/
  components/
    layout/
      sidebar.tsx
      topbar.tsx
  lib/
    store.tsx       ← Estado global (React Context)
    csv.ts          ← Parser CSV
    utils.ts
    mock/data.ts    ← Dados mock
  types/index.ts
```
