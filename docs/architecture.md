# Wine Shop Management System - Microservices Architecture (Milestone 5)

## Architecture Overview

```text
                           ┌─────────────────┐
                           │ React Frontend  │
                           │   (Vite App)    │
                           └────────┬────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │   API Gateway   │
                           │   (Port 5000)   │
                           └────────┬────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
   │  Auth Service   │     │ Inventory Serv. │     │  Sales Service  │
   │   (Port 5001)   │     │   (Port 5002)   │     │   (Port 5003)   │
   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
            │                       │                       │
            ▼                       ▼                       ▼
   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
   │     auth_db     │     │  inventory_db   │     │    sales_db    │
   └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Service Proxy Routing Matrix
1. **API Gateway** (`http://localhost:5000`)
   - `GET /health` — Gateway status check.
   - `/api/auth/*` $\rightarrow$ Proxied to `http://localhost:5001/auth/*`
   - `/api/inventory/*` $\rightarrow$ Proxied to `http://localhost:5002/*` (JWT Auth Enforced)
   - `/api/sales/*` $\rightarrow$ Proxied to `http://localhost:5003/*` (JWT Auth Enforced)

## Microservice Headers Propagation
The API Gateway decodes validated JWT access tokens and injects standard microservice headers to downstream services:
- `X-User-Id`: Decoded User ID
- `X-User-Role`: User role (`ADMIN` | `STAFF`)
- `X-User-Email`: User email
