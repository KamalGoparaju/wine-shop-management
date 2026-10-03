# Wine Shop Management System

A microservices-based inventory and sales management system built for wine shops with physical bottle serial-number level tracking.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **API Gateway**: Node.js + Express (Port `5000`)
- **Auth Service**: Node.js + Express (Port `5001`)
- **Inventory Service**: Node.js + Express (Port `5002`)
- **Sales Service**: Node.js + Express (Port `5003`)

## Directory Structure

```text
wine-shop-management/
├── frontend/             # React + Vite client app
├── backend/              # Node.js microservices
│   ├── api-gateway/      # API Gateway service
│   ├── auth-service/     # Authentication & User service
│   ├── inventory-service/# Brands, Products, Stock & Bottle serial tracking
│   └── sales-service/    # Sales & Billing service
├── docs/                 # Project documentation
│   ├── requirements.md
│   ├── architecture.md
│   ├── database.md
│   └── api.md
├── .gitignore
└── README.md
```

## Getting Started

### Backend Services
To run any backend microservice individually:

```bash
# API Gateway
cd backend/api-gateway
npm start

# Auth Service
cd backend/auth-service
npm start

# Inventory Service
cd backend/inventory-service
npm start

# Sales Service
cd backend/sales-service
npm start
```

### Frontend Client
```bash
cd frontend
npm run dev
```
