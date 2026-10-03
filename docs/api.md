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

## Service Endpoint Routing Matrix

| Gateway Path | Target Microservice | Description |
| --- | --- | --- |
| `/api/auth/*` | Auth Service (5001) | Authentication & User APIs |
| `/api/inventory/*` | Inventory Service (5002) | Brands, Products, Stock Entries, Serial Numbers |
| `/api/sales/*` | Sales Service (5003) | Sales Creation, Receipts & Reports |

## Health Endpoints
- `GET /health` on all services returns:
```json
{
  "status": "UP",
  "service": "<service-name>",
  "timestamp": "2026-10-03T21:30:00.000Z"
}
```
