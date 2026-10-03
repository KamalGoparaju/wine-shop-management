# Wine Shop Management System

A microservices-based inventory and sales management system built for wine shops with physical bottle serial-number level tracking.

---

## System Architecture

```text
                           ┌─────────────────┐
                           │ React Frontend  │
                           │ (Vite App:3000) │
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

---

## Directory Structure

```text
wine-shop-management/
├── frontend/             # React + Vite client app (Port 3000)
├── backend/              # Node.js microservices
│   ├── api-gateway/      # API Gateway service (Port 5000)
│   ├── auth-service/     # Authentication & User service (Port 5001)
│   ├── inventory-service/# Brands, Products, Stock & Bottle serial tracking (Port 5002)
│   └── sales-service/    # Sales & Billing service (Port 5003)
├── docs/                 # Documentation
│   ├── requirements.md
│   ├── architecture.md
│   ├── database.md
│   └── api.md
├── package.json          # Root monorepo scripts
└── README.md
```

---

## How to Run the Project

### 1. Quick Start (Run All Microservices + Frontend Simultaneously)
From the project root directory:

```bash
npm start
```
This launches:
- **API Gateway**: `http://localhost:5000`
- **Auth Service**: `http://localhost:5001`
- **Inventory Service**: `http://localhost:5002`
- **Sales Service**: `http://localhost:5003`
- **React Frontend**: `http://localhost:3000`

---

### 2. Run Backend Services Only
```bash
npm run start:backend
```

---

### 3. Run React Frontend Only
```bash
npm run start:frontend
```

---

### 4. Run Test Suite
```bash
npm test
```
Executes test suites across all microservices and verifies the frontend production build.

---

## Core Business Rules Enforced

- **Rule 1 (Total Bottles)**: $\text{Total Bottles} = \text{Boxes} \times \text{Bottles/Box}$ calculated automatically.
- **Rule 2 (Serial Count Validation)**: Submitted bottle serial count must match total bottles.
- **Rule 3 (Serial Uniqueness)**: Global unique constraint on physical bottle serial numbers.
- **Rule 4 (Bottle Status)**: Initial status `IN_STOCK`, updated to `SOLD` upon sale.
- **Rule 5 (Stock Adjustments)**: Logs history and reason for `DAMAGED`, `RETURNED`, `ADJUSTED` status changes.
- **Rule 6 (Historical Price Integrity)**: Purchase prices stored on bottle/entry records remain locked regardless of future default product price updates.
- **Rule 9 (Database Isolation)**: Each microservice strictly owns its database (`auth_db`, `inventory_db`, `sales_db`). Inter-service operations take place via HTTP API calls.
