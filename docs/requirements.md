# Wine Shop Management System - Functional & Non-Functional Requirements

## 1. Overview
The Wine Shop Management System is an inventory-first microservice application designed for tracking wine/liquor stock down to individual physical bottle serial numbers, managing box shipments, box pricing, bottle pricing, stock adjustments, and sales.

## 2. Main Business Requirements
- **Stock Reception**: Receive products packaged in boxes.
- **Calculated Bottle Totals**:
  $$\text{Total Bottles} = \text{Number of Boxes} \times \text{Bottles Per Box}$$
- **Physical Bottle Serial Number Validation**:
  - Exactly match expected bottle count.
  - Unique constraint across all bottles in the system.
- **Item-Level Status Tracking**:
  - `IN_STOCK` (default upon receipt)
  - `SOLD`
  - `DAMAGED`
  - `RETURNED`
  - `ADJUSTED`
- **Price Integrity**:
  - Preserve historical purchase/stock entry price per box and per bottle regardless of future default product price updates.

## 3. Core Modules
1. **Authentication**: Users, Roles (ADMIN, STAFF), JWT Auth.
2. **Dashboard**: Metrics for products, boxes, bottles, daily sales, stock alerts.
3. **Brand Management**: Add, edit, activate/deactivate, search brands.
4. **Product Management**: Add, edit, default pricing, volume, bottles per box.
5. **Stock Management**: Create stock entries, bulk serial paste, bottle status tracking, adjustments, cancel/delete unused entries.
6. **Sales Management**: Create sales, stock validation by bottle, update bottle status, payment methods.
7. **Reports**: Stock and sales reports.

## 4. User Roles & Permissions
- **ADMIN**: Access to user management, brands, products, stock entries, stock adjustments, sales, dashboard, reports.
- **STAFF**: Login, view products, view available stock, create sales, view sales history.
