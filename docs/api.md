# Wine Shop Management System - API Specification Outline

## Standard Response Structure

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Detailed error message",
  "error": "ERROR_CODE"
}
```

---

## Auth Service Endpoints (`/api/auth`)
- `POST /api/auth/login` — Login user & return JWT token.
- `POST /api/auth/register` — Register user.
- `GET /api/auth/me` — Profile of logged-in user.
- `GET /api/auth/users` — List all users (ADMIN).
- `PATCH /api/auth/users/:id/status` — Toggle user activation status (ADMIN).

---

## Inventory Service Endpoints (`/api/inventory`)
- `POST /api/inventory/brands` — Add brand.
- `GET /api/inventory/brands` — List & search brands.
- `POST /api/inventory/products` — Add product.
- `GET /api/inventory/products` — List & search products.
- `POST /api/inventory/stock/entries` — Create stock entry with serial validation.
- `GET /api/inventory/stock/entries` — List stock entries.
- `GET /api/inventory/stock/entries/:id` — Stock entry details with box & bottle breakdown.
- `GET /api/inventory/stock/bottles/:serialNumber` — Scan/lookup physical bottle details by serial.
- `POST /api/inventory/adjustments` — Log status adjustment (DAMAGED, RETURNED, ADJUSTED).

---

## Sales Service Endpoints (`/api/sales`)

### 1. Create Sale (Billing)
- **Method**: `POST`
- **Path**: `/api/sales`
- **Body**:
  ```json
  {
    "bottleSerialNumbers": ["RS10001", "RS10002"],
    "paymentMethod": "CASH",
    "soldBy": "System Admin",
    "notes": "Over the counter sale"
  }
  ```
- **Execution Flow**:
  1. Validates each bottle serial number via Inventory Service API (`GET /stock/bottles/:serialNumber`).
  2. Ensures bottle status is `IN_STOCK`.
  3. Calculates total amount using locked-in bottle price.
  4. Generates unique invoice (e.g. `INV-20261003-8A2F`).
  5. Calls Inventory Service API (`POST /adjustments`) to update bottle status to `SOLD` (Rule 4).

### 2. List Sales History
- **Method**: `GET`
- **Path**: `/api/sales?search=INV-20261003&paymentMethod=CASH`

### 3. Get Sale Receipt Details
- **Method**: `GET`
- **Path**: `/api/sales/:id`
