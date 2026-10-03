# Wine Shop Management System - Microservices Architecture

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

## Service Allocations & Ports
1. **API Gateway** - Port `5000`
   - Single point of entry for client application.
   - Routes requests to `/api/auth`, `/api/inventory`, and `/api/sales`.
2. **Auth Service** - Port `5001`
   - Handles user registration, authentication, JWT issuing, role checks.
3. **Inventory Service** - Port `5002`
   - Manages Brands, Products, Stock Entries, Box tracking, Bottle Serial Numbers, and Inventory Status.
4. **Sales Service** - Port `5003`
   - Handles sales creation, payment details, sales history, and communicates via HTTP API to inventory service to validate stock.

## Core Microservices Rule
- Each microservice strictly owns its own database (`auth_db`, `inventory_db`, `sales_db`).
- Inter-service communication happens via APIs, never via direct database cross-querying.
