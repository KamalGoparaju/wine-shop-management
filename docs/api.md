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

### 1. Brand Management
- **Add Brand**: `POST /api/inventory/brands`
  - Body: `{ "name": "Royal Stag", "description": "Premium Whisky" }`
- **List Brands**: `GET /api/inventory/brands?search=Royal&isActive=true`
- **Get Brand**: `GET /api/inventory/brands/:id`
- **Update Brand**: `PUT /api/inventory/brands/:id`
- **Toggle Brand Status**: `PATCH /api/inventory/brands/:id/status`

### 2. Product Management
- **Add Product**: `POST /api/inventory/products`
  - Body:
    ```json
    {
      "brandId": "brand-uuid",
      "name": "Royal Stag Whisky",
      "bottleVolume": "750 ML",
      "bottlesPerBox": 3,
      "defaultBottlePrice": 150.00,
      "defaultBoxPrice": 450.00
    }
    ```
- **List Products**: `GET /api/inventory/products?brandId=...&search=...`
- **Get Product**: `GET /api/inventory/products/:id`
- **Update Product**: `PUT /api/inventory/products/:id`
- **Toggle Product Status**: `PATCH /api/inventory/products/:id/status`

### 3. Stock Entries & Physical Bottle Serial Tracking
- **Create Stock Entry**: `POST /api/inventory/stock/entries`
  - Body:
    ```json
    {
      "productId": "product-uuid",
      "numberOfBoxes": 2,
      "bottlesPerBox": 3,
      "boxPrice": 450.00,
      "bottlePrice": 150.00,
      "serialNumbers": [
        "RS10001", "RS10002", "RS10003",
        "RS10004", "RS10005", "RS10006"
      ],
      "notes": "Initial batch reception"
    }
    ```
  - Automatic Backend Validations:
    - Calculates `totalBottles = numberOfBoxes * bottlesPerBox`.
    - Validates matching serial number count.
    - Validates global uniqueness of serial numbers.
    - Generates Box 1 and Box 2 records with assigned bottle serial numbers.
    - Assigns initial status `IN_STOCK`.
- **List Stock Entries**: `GET /api/inventory/stock/entries`
- **Stock Entry Details**: `GET /api/inventory/stock/entries/:id` (Returns boxes and bottle serial numbers)
- **Cancel / Delete Stock Entry**: `DELETE /api/inventory/stock/entries/:id`
- **Lookup Bottle Serial**: `GET /api/inventory/stock/bottles/:serialNumber`
- **Available Stock Summary**: `GET /api/inventory/stock/summary`

### 4. Stock Adjustments & Audit Log
- **Create Stock Adjustment**: `POST /api/inventory/adjustments`
  - Body:
    ```json
    {
      "serialNumber": "RS10003",
      "newStatus": "DAMAGED",
      "reason": "Broken during handling",
      "adjustedBy": "user-uuid"
    }
    ```
- **List Adjustments**: `GET /api/inventory/adjustments?serialNumber=RS10003`
