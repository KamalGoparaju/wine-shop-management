# Wine Shop Management System - Database Design Strategy

## Overview
Following microservices database-per-service principles, three logical databases will be configured in PostgreSQL:
1. `auth_db`
2. `inventory_db`
3. `sales_db`

## Planned Entity Ownership

### Auth Database (`auth_db`)
- `users` (id, email, password_hash, name, role, is_active, created_at, updated_at)

### Inventory Database (`inventory_db`)
- `brands` (id, name, description, is_active, created_at)
- `products` (id, brand_id, name, bottle_volume, bottles_per_box, default_bottle_price, default_box_price, is_active)
- `stock_entries` (id, product_id, number_of_boxes, bottles_per_box, total_bottles, box_price, bottle_price, entry_date, status)
- `boxes` (id, stock_entry_id, box_number)
- `bottles` (id, box_id, stock_entry_id, product_id, serial_number, status, bottle_price)
- `stock_adjustments` (id, bottle_id, reason, previous_status, new_status, adjusted_by, created_at)

### Sales Database (`sales_db`)
- `sales` (id, invoice_number, total_amount, payment_method, status, created_by, created_at)
- `sale_items` (id, sale_id, bottle_serial_number, product_id, price)
