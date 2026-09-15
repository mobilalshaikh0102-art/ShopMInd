# ShopMind Solution Architecture

ShopMind is a modern, containerized, AI-powered e-commerce ERP. The architecture is designed to be highly scalable, using a decoupled frontend/backend approach, with robust asynchronous processing and dedicated AI agents.

## High-Level Architecture Diagram

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#3498db,stroke:#2980b9,stroke-width:2px,color:white;
    classDef backend fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:white;
    classDef db fill:#f1c40f,stroke:#f39c12,stroke-width:2px,color:black;
    classDef external fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:white;
    classDef ai fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:white;

    %% Nodes
    User("👤 User (Browser)"):::client
    Nginx("🌐 Nginx (Frontend Serving)"):::client
    React("⚛️ React + Vite (SPA)"):::client
    
    FastAPI("⚡ FastAPI (Backend API)"):::backend
    Celery("⚙️ Background Workers"):::backend
    
    PostgreSQL("🐘 PostgreSQL (Primary DB)"):::db
    Redis("🔴 Redis (Cache & Broker)"):::db
    
    LangGraph("🧠 LangGraph (Agent Orchestrator)"):::ai
    Gemini("✨ Google Gemini API (LLM)"):::external
    
    Shopify("🛒 Shopify API"):::external
    Stripe("💳 Stripe API"):::external
    Shiprocket("🚚 Shiprocket API"):::external

    %% Connections
    User -- "HTTPS (UI)" --> Nginx
    Nginx -- "Static Assets" --> React
    React -- "REST / JSON" --> FastAPI
    
    FastAPI -- "Read/Write" --> PostgreSQL
    FastAPI -- "Session/Queue" --> Redis
    
    Celery -- "Read/Write" --> PostgreSQL
    Celery -- "Pop/Push" --> Redis
    
    FastAPI -- "Trigger Agent" --> LangGraph
    LangGraph -- "Prompts/Inference" --> Gemini
    
    Celery -- "Sync Jobs" --> Shopify
    Celery -- "Sync Jobs" --> Stripe
    Celery -- "Tracking" --> Shiprocket
```

## Component Breakdown

### 1. Frontend (Client-Side)
- **React 18 + Vite**: High-performance Single Page Application (SPA).
- **Architecture**: Role-based component rendering. The UI dynamically adapts based on the JWT token (Admin vs Customer Support vs Customer).
- **State Management**: React Hooks and Context for local state, API fetching via standard REST calls.

### 2. Backend (API Layer)
- **FastAPI**: Asynchronous Python web framework for serving RESTful APIs.
- **Authentication**: JWT-based session management stored in Redis for fast revocation.
- **Role-Based Access Control (RBAC)**: Dependency injection at the router level ensures endpoints are protected based on user roles.

### 3. Data Persistence & Caching
- **PostgreSQL 16**: Relational database mapping complex e-commerce logic (Users, Orders, Inventory, CRM, Logs) via **SQLModel**.
- **Redis**: In-memory data store acting as:
  1. A fast cache for AI insights and session tracking.
  2. A message broker for background tasks (e.g., Celery).

### 4. AI & Agentic Workflow
- **LangGraph**: Orchestrates multi-step AI reasoning. Instead of simple prompt-response, the AI operates as an agent that can loop, use tools, and make decisions.
- **Google Gemini API**: The core Large Language Model (LLM) powering the reasoning, sentiment analysis, and generative copywriting.
- **Human-in-the-loop (HITL)**: High-risk AI decisions are trapped in a pending state in the database, waiting for an `ADMIN` to approve or reject them via the UI.

### 5. Deployment & Cloud Topology (AWS)
- **Containerization**: Both the frontend and backend are encapsulated in Docker containers.
- **Docker Compose**: Orchestrates the local or single-node production deployment.
- **AWS Target**: The recommended deployment is on a scalable EC2 instance using the provided User Data script, or migrating to Amazon ECS (Elastic Container Service) coupled with AWS RDS for PostgreSQL.
