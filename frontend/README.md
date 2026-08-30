# Frontend

A aplicação frontend (React 19 + Vite + TypeScript + TailwindCSS + Shadcn/UI + Framer Motion +
Recharts + Lucide Icons + React Icons) está na **raiz do repositório**, em `src/`.

Execute na raiz:

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
npm run preview
```

Configuração do WebSocket do backend: `.env` na raiz com `VITE_WS_URL=ws://localhost:4000/ws`.

Mapa de pastas relevantes:

- `src/routes/` — páginas (Dashboard `/`, Relatório `/relatorio`) e layout global
- `src/components/dashboard/` — cards, gráficos e tabela de ciclos
- `src/components/layout/` — header com navegação, relógio e status MQTT
- `src/context/` — estado de produção em memória
- `src/hooks/`, `src/services/`, `src/lib/`, `src/types/`
