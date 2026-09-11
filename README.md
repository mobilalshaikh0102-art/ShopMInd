# ShopMind — AI-Powered Autonomous E-Commerce Operations Platform

> **A production-grade LangGraph multi-agent platform** that centralises all e-commerce operations behind an AI orchestrator with 7 specialised agents, RAG-powered customer support, ML demand forecasting, human approval workflows, and a premium real-time dashboard.

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ (v19 works) | [nodejs.org](https://nodejs.org) |
| Docker Desktop | Latest | For PostgreSQL + Redis |
| Google Gemini API Key | — | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

---

### Step 1 — Start PostgreSQL + Redis

```bash
docker-compose up -d
```

This starts:
- `postgres:pgvector/pgvector` on port **5432**
- `redis:7` on port **6379**

---

### Step 2 — Configure Backend

```bash
cd backend
copy .env.example .env
```

Open `backend\.env` and set your Gemini API key:
```env
GEMINI_API_KEY=your-actual-gemini-api-key-here
```

---

### Step 3 — Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

---

### Step 4 — Start Backend Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend auto-initialises:
- ✅ Creates all database tables
- ✅ Seeds 5 default user accounts (Admin, Ops, Analyst, Support, Customer)
- ✅ Loads 6 RAG knowledge base documents with embeddings

---

### Step 5 — Seed Demo Data (optional but recommended)

In a new terminal:
```bash
cd backend
python ..\scripts\seed_demo_data.py
```

Creates:
- 20 products across 8 categories
- 12 realistic customers
- 35 orders with varied statuses
- Shipments with delayed status examples
- 15 support tickets
- 20 agent execution records
- 8 audit log entries

---

### Step 6 — Start Frontend

```bash
cd frontend
npm install   # first time only
npm run dev
```

---

### Step 7 — Open the App

| URL | Description |
|---|---|
| **http://localhost:5173** | ShopMind Dashboard |
| http://localhost:8000/api/docs | FastAPI Swagger UI |
| http://localhost:8000/api/redoc | ReDoc API reference |

---

## 🔑 Demo Login Accounts

| Role | Email | Password | Access |
|---|---|---|---|
| **Admin** | admin@shopmind.ai | Admin@123 | Full access — all modules |
| **Ops Manager** | ops@shopmind.ai | Ops@1234 | Orders, inventory, approvals |
| **Analyst** | analyst@shopmind.ai | Analyst@1 | Read-only analytics |
| **Support Agent** | support@shopmind.ai | Support@1 | Tickets, orders, shipments |
| **Customer** | customer@shopmind.ai | Customer@1 | Own orders and tickets only |

---

## 🤖 AI Agent System

ShopMind uses a **LangGraph supervisor + 7 specialised agents** powered by **Google Gemini 2.0 Flash**:

```
USER QUERY
    ↓
Supervisor (Intent routing)
    ↓
┌─────────────────────────────────────────────┐
│  Inventory  │  Order   │  Support  │ Pricing │
│    Agent    │  Agent   │   Agent   │  Agent  │
├─────────────┼──────────┼───────────┼─────────┤
│  Logistics  │Marketing │ Analytics │         │
│    Agent    │  Agent   │   Agent   │         │
└─────────────────────────────────────────────┘
    ↓
HUMAN APPROVAL (for HIGH risk actions)
    ↓
AUDIT LOG
```

### Agent Routing Keywords
- **Inventory Agent** — stock, inventory, restock, SKU, warehouse
- **Order Agent** — order, purchase, cancel order, order status
- **Logistics Agent** — shipment, delivery, shipping, tracking, delay
- **Support Agent** — refund, return, policy, warranty, complaint
- **Pricing Agent** — price, pricing, discount, cost, margin
- **Analytics Agent** — sales, revenue, metrics, report, KPI
- **Marketing Agent** — campaign, promotion, marketing, ad, email

### Human Approval Workflow
Actions flagged as **HIGH RISK** (e.g., restock cost > ₹5,000) are:
1. Paused and written to the `approvals` table
2. Shown in the **Approvals** dashboard tab with full context
3. Executed or rejected by an authorised human

---

## 📦 Architecture

```
d:\ShopMind1\
├── backend/                    # FastAPI + LangGraph
│   ├── app/
│   │   ├── main.py             # FastAPI app + lifespan
│   │   ├── core/               # Config, security, logging, Redis
│   │   ├── models/             # 17 SQLModel tables (pgvector)
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── repositories/       # Data access layer
│   │   ├── services/           # Business logic
│   │   ├── api/v1/             # REST API routes
│   │   ├── agents/             # LangGraph orchestrator + 7 agents
│   │   ├── rag/                # Embedder, retriever, knowledge loader
│   │   ├── ml/                 # Demand forecaster (LinearRegression + EMA)
│   │   └── events/             # Redis pub/sub producer + consumer
│   └── requirements.txt
├── frontend/                   # React + TypeScript + Vite 3
│   └── src/
│       ├── App.tsx             # Full app (8 pages + AI Copilot)
│       ├── api.ts              # API client
│       ├── types.ts            # TypeScript interfaces
│       └── index.css           # Premium dark-theme design system
├── scripts/
│   ├── seed_demo_data.py       # Rich demo data seeder
│   └── start_dev.py            # Combined dev server launcher
└── docker-compose.yml          # PostgreSQL (pgvector) + Redis
```

---

## 🎨 Frontend Features

| Page | Description |
|---|---|
| **Dashboard** | KPI cards, agent activity feed, real-time metrics |
| **Inventory** | Stock table with low-stock alerts and reorder info |
| **Orders** | Order queue with status filter and revenue totals |
| **Shipments** | Shipment tracker with delayed-only filter |
| **Support Tickets** | Ticket queue with priority and status badges |
| **Approvals** | HIGH-RISK action review with one-click approve/reject |
| **Agent Executions** | Full history of AI agent runs with duration |
| **Audit Logs** | Tamper-evident action log with risk levels |
| **AI Copilot** | Live chat panel routed to the best agent automatically |

---

## 🔧 Technology Stack

| Layer | Technology |
|---|---|
| Backend Framework | FastAPI 0.115 |
| ORM | SQLModel + SQLAlchemy |
| Database | PostgreSQL 16 + pgvector |
| Cache / Events | Redis 7 |
| AI Agents | LangGraph 0.2 + LangChain |
| LLM | Google Gemini 2.0 Flash |
| Embeddings | Google text-embedding-004 (768-dim) |
| ML Forecasting | scikit-learn LinearRegression |
| Auth | JWT (python-jose + passlib bcrypt) |
| Frontend | React 18 + TypeScript + Vite 3 |
| Deployment | Docker Compose |

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Remove volumes (reset data)
docker-compose down -v

# Check logs
docker-compose logs -f postgres
```

---

## 📡 Key API Endpoints

```
POST   /api/v1/auth/login              Login
POST   /api/v1/auth/register           Register
GET    /api/v1/auth/me                 Current user

GET    /api/v1/dashboard/metrics       Dashboard KPIs
GET    /api/v1/products                List products
GET    /api/v1/inventory               All inventory
GET    /api/v1/inventory/low-stock     Low stock items
GET    /api/v1/orders                  List orders
GET    /api/v1/shipments               All shipments
GET    /api/v1/shipments/delayed       Delayed shipments
GET    /api/v1/support/tickets         Support tickets
GET    /api/v1/approvals/pending       Pending approvals
POST   /api/v1/approvals/{id}/decide   Approve/reject
GET    /api/v1/agents/executions       Agent run history
GET    /api/v1/audit/logs              Audit trail
POST   /api/v1/agents/chat             AI chat
GET    /api/v1/forecast/{product_id}   Demand forecast
```

---

## ⚙️ Without Gemini API Key

The platform works without a Gemini API key — the AI chat will return a friendly message asking you to configure the key. All other features (dashboard, inventory, orders, approvals, etc.) work fully.
#   S h o p M I n d  
 