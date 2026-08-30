# NEXALINE — Monitoramento de Produção Industrial em Tempo Real

Sistema completo de monitoramento de produção industrial (MES/OEE) alimentado **exclusivamente por MQTT**
publicado pelo Node-RED. Todos os dados vivem **apenas em memória** — sem banco de dados e sem Docker.

```
frontend/  → aplicação React 19 + Vite + TypeScript + Tailwind + Shadcn/UI (raiz deste projeto)
backend/   → Express + MQTT.js + WebSocket em TypeScript
node-red/  → flow.json pronto para importar (manual + modo automático)
README.md  → esta documentação
```

> O **frontend** está na raiz do repositório (`src/`), executado por Vite/TanStack Start.
> O diretório `frontend/` é um atalho documental para essa aplicação.

---

## 1. Requisitos

- Node.js 20+
- Um broker MQTT acessível (ex.: Mosquitto local em `localhost:1883`)
- Node-RED (opcional, para simular a linha de produção)

---

## 2. Instalação e execução

### Frontend (raiz do projeto)

```bash
npm install
npm run dev          # desenvolvimento  → http://localhost:8080
npm run build        # produção
npm run preview      # servidor de produção
```

Crie um `.env` (baseado em `.env.example`) apontando para o backend:

```
VITE_WS_URL=ws://localhost:4000/ws
```

Se o WebSocket não estiver disponível, o frontend ativa automaticamente o
**simulador interno de ciclos** (mesma lógica do modo automático do Node-RED),
de modo que o dashboard sempre pode ser demonstrado.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev          # http://localhost:4000/api  ·  ws://localhost:4000/ws
npm run build && npm start
```

Endpoints:

| Método | Rota            | Descrição                                      |
| ------ | --------------- | ---------------------------------------------- |
| GET    | `/api/health`   | Status do serviço e do MQTT                    |
| GET    | `/api/snapshot` | Estado completo em memória (turno atual)       |
| GET    | `/api/metrics`  | Indicadores por `?date=YYYY-MM-DD&shift=1|2`   |
| WS     | `/ws`           | Stream em tempo real de eventos e status MQTT  |

---

## 3. Como alterar o IP do broker MQTT

Edite `backend/.env`:

```
MQTT_URL=mqtt://192.168.0.50:1883
```

Também é possível usar credenciais (`MQTT_USERNAME`, `MQTT_PASSWORD`) e TLS (`mqtts://`).
No Node-RED, altere o nó `mqtt-broker` ("Broker Local") para o mesmo endereço.

## 4. Como alterar os tópicos

1. `backend/.env` → `MQTT_TOPIC=sua/rota`
2. Node-RED → nó `MQTT Out - producao/eventos` e a função `Montar Evento`
   (variável `TOPIC` no nó `Ciclo Automatico`).

---

## 5. Eventos MQTT

Payload JSON no tópico `producao/eventos`:

```json
{ "event": "pieceProduced" }
```

`pieceProduced` e o unico sinal da maquina. Regras aplicadas pelo backend e pelo frontend:

- Primeiro pulso → guarda o horario de inicio do ciclo.
- Cada pulso seguinte → calcula e registra o ciclo anterior, incrementa uma peca e inicia imediatamente o proximo ciclo.
- O ciclo atualmente em andamento nao e contabilizado ate chegar o proximo pulso.

### Turnos

| Turno | Janela              |
| ----- | ------------------- |
| 1     | 06:00 — 13:59:59    |
| 2     | 14:00 — 21:59:59    |

A partir das 22:00 o contexto avança automaticamente para o **Turno 1 do próximo dia**
(não existe terceiro turno). Todos os indicadores são segregados por data + turno.

### Indicadores

Quantidade produzida · tempo médio · maior tempo · menor tempo · último tempo · tempo atual ·
quantidade de ciclos · quantidade acima de 7,5 s · percentual acima de 7,5 s · meta de 7,5 s.

---

## 6. Node-RED

1. Abra o Node-RED (`http://localhost:1880`).
2. Menu ☰ → **Import** → **select a file to import** → escolha `node-red/flow.json`.
3. Clique em **Deploy**.
4. Ajuste o nó `Broker Local` se o broker não estiver em `localhost:1883`.

O flow contem:

- `TESTE - Sinal Unico` (teste manual; representa o unico pulso vindo da maquina)
- `Montar Evento` (function que valida e normaliza o pulso JSON)
- `MQTT Out - producao/eventos`
- `Eventos Publicados` (debug)

Em produção, substitua o nó `TESTE - Sinal Unico` pela entrada digital da máquina e mantenha a saída ligada ao `Montar Evento`.

---

## 7. Como testar

1. Suba o broker MQTT.
2. `cd backend && npm run dev` → deve exibir `[mqtt] status: online`.
3. Importe o flow no Node-RED e faça o deploy.
4. `npm run dev` na raiz e abra o dashboard.
5. Clique nos injects manuais e observe a atualização imediata (sem recarregar a página).
6. Verifique o badge **MQTT conectado** no header e a tabela "Últimos ciclos".
7. Na tela **Relatório**, filtre por data/turno e clique em **Exportar PDF**.

Teste direto por linha de comando:

```bash
mosquitto_pub -h localhost -t producao/eventos -m '{"event":"pieceProduced"}'
mosquitto_pub -h localhost -t producao/eventos -m '{"event":"pieceProduced"}'
```

---

## 8. Estrutura do projeto

```
.
├── src/                          # FRONTEND
│   ├── components/
│   │   ├── dashboard/            # MetricCard, SectionCard, CycleTable, charts
│   │   ├── layout/               # AppHeader (navegação, relógio, status MQTT)
│   │   └── ui/                   # Shadcn/UI
│   ├── context/ProductionContext.tsx   # estado em memória + eventos
│   ├── hooks/useProduction.ts
│   ├── lib/production.ts         # turnos, métricas, formatação
│   ├── services/
│   │   ├── realtime.ts           # WebSocket + simulador de fallback
│   │   └── pdfReport.ts          # geração do PDF profissional
│   ├── routes/
│   │   ├── __root.tsx            # layout global
│   │   ├── index.tsx             # Dashboard
│   │   └── relatorio.tsx         # Relatório + exportação PDF
│   ├── types/production.ts
│   └── styles.css                # design system (tema claro + dark preparado)
├── backend/
│   └── src/
│       ├── index.ts              # bootstrap Express + HTTP + WS
│       ├── config.ts             # variáveis de ambiente
│       ├── mqtt.ts               # cliente MQTT
│       ├── websocket.ts          # broadcast em tempo real
│       ├── routes.ts             # REST API
│       ├── store.ts              # estado em memória e indicadores
│       ├── shifts.ts             # regras de turno e meta
│       └── types.ts
├── node-red/flow.json
└── README.md
```

---

## 9. Dashboard

- Cards: Produção, Tempo médio, Tempo atual, Último ciclo, Maior ciclo, Menor ciclo,
  Ciclos > 7,5 s, Percentual > 7,5 s, Turno atual, Status MQTT e horário atual (header).
- Gráficos: barras (produção por turno), linha/área (tempos de ciclo com linha de meta),
  gauge radial (percentual acima de 7,5 s) e donut (dentro da meta x acima de 7,5 s).
- Tabela de últimos ciclos com status verde (≤ 7,5 s) e vermelho (> 7,5 s).
- Skeletons, tooltips, animações Framer Motion, hover nos cards e responsividade total.
- Tema claro por padrão, com tokens de dark mode já preparados (`.dark` em `src/styles.css`).

## 10. Relatório e PDF

Filtros por data e turno, resumo de indicadores, gráficos, histórico completo e botão
**Exportar PDF** que gera um documento com cabeçalho, logo, resumo, indicadores, gráficos,
tabela paginada, data, hora, rodapé e numeração de páginas.
