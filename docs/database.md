# Wine Shop Management System - Database Architecture (Milestone 2)

## Overview
The Wine Shop Management System uses a **database-per-service** pattern.
Each microservice owns its data in PostgreSQL:
1. `auth_db` — Auth Service
2. `inventory_db` — Inventory Service
3. `sales_db` — Sales Service

---

## Entity Relationship Diagrams (ERD)

### 1. Auth Database (`auth_db`)
```mermaid
erDiagram
    users {
        string id PK
        string email UK
        string password
        string name
        enum role "ADMIN | STAFF"
        boolean is_active
        datetime created_at
        datetime updated_at
    }
```

---

### 2. Inventory Database (`inventory_db`)
```mermaid
erDiagram
    brands ||--o{ products : "has"
    products ||--o{ stock_entries : "has"
    products ||--o{ bottles : "cataloged in"
    stock_entries ||--o{ boxes : "contains"
    stock_entries ||--o{ bottles : "receives"
    boxes ||--o{ bottles : "holds"
    bottles ||--o{ stock_adjustments : "logs"

    brands {
        string id PK
        string name UK
        string description
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    products {
        string id PK
        string brand_id FK
        string name
        string bottle_volume
        int bottles_per_box
        decimal default_bottle_price
        decimal default_box_price
        boolean is_active
    }

    stock_entries {
        string id PK
        string product_id FK
        int number_of_boxes
        int bottles_per_box
        int total_bottles
        decimal box_price
        decimal bottle_price
        enum status "COMPLETED | CANCELLED"
        datetime created_at
    }

    boxes {
        string id PK
        string stock_entry_id FK
        int box_number
    }

    bottles {
        string id PK
        string serial_number UK
        string box_id FK
        string stock_entry_id FK
        string product_id FK
        decimal bottle_price
        enum status "IN_STOCK | SOLD | DAMAGED | RETURNED | ADJUSTED"
    }

    stock_adjustments {
        string id PK
        string bottle_id FK
        enum previous_status
        enum new_status
        string reason
        string adjusted_by
        datetime created_at
    }
```

---

### 3. Sales Database (`sales_db`)
```mermaid
erDiagram
    sales ||--o{ sale_items : "contains"

    sales {
        string id PK
        string invoice_number UK
        decimal total_amount
        enum payment_method "CASH | CARD | UPI | OTHER"
        string sold_by
        datetime created_at
    }

    sale_items {
        string id PK
        string sale_id FK
        string bottle_serial_number
        string product_id
        decimal unit_price
    }
```

---

## Key Constraints & Indexes

1. **Unique Bottle Serial Numbers**: `bottles.serial_number` is globally unique across the system (Rule 3).
2. **Compound Uniqueness**:
   - `products`: `[brand_id, name, bottle_volume]` unique constraint.
   - `boxes`: `[stock_entry_id, box_number]` unique constraint.
3. **Optimized Inventory Lookup Indexes**:
   - `bottles(serial_number)` — fast barcode/serial validation during stock creation & sale scanning.
   - `bottles(status)` — fast stock availability aggregation.
   - `bottles(product_id, status)` — fast stock per product calculation.
   - `sale_items(bottle_serial_number)` — historical trace of sold serial numbers.
4. **Historical Price Preservation**: `bottles.bottle_price` and `stock_entries.bottle_price` lock in exact purchase price at stock reception time (Rule 6).
