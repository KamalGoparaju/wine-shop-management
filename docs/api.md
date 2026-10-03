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

## Auth Service Endpoints (`/auth` or `/api/auth`)

### 1. User Login
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Body**:
  ```json
  {
    "email": "admin@wineshop.com",
    "password": "Admin@123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "token": "<jwt-token>",
      "user": {
        "id": "uuid-string",
        "email": "admin@wineshop.com",
        "name": "System Admin",
        "role": "ADMIN"
      }
    }
  }
  ```

---

### 2. Register / Create User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Body**:
  ```json
  {
    "email": "staff1@wineshop.com",
    "password": "Staff@123",
    "name": "Staff Member 1",
    "role": "STAFF"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User created successfully",
    "data": {
      "user": {
        "id": "uuid-string",
        "email": "staff1@wineshop.com",
        "name": "Staff Member 1",
        "role": "STAFF",
        "isActive": true,
        "createdAt": "2026-10-03T22:00:00.000Z"
      }
    }
  }
  ```

---

### 3. Current User Profile
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Headers**: `Authorization: Bearer <jwt-token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User profile retrieved successfully",
    "data": {
      "user": {
        "id": "uuid-string",
        "email": "admin@wineshop.com",
        "name": "System Admin",
        "role": "ADMIN",
        "isActive": true,
        "createdAt": "2026-10-03T22:00:00.000Z"
      }
    }
  }
  ```

---

### 4. List All Users (ADMIN Only)
- **Method**: `GET`
- **Path**: `/api/auth/users`
- **Headers**: `Authorization: Bearer <jwt-token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Users fetched successfully",
    "data": {
      "users": [
        {
          "id": "uuid-string",
          "email": "admin@wineshop.com",
          "name": "System Admin",
          "role": "ADMIN",
          "isActive": true,
          "createdAt": "2026-10-03T22:00:00.000Z"
        }
      ]
    }
  }
  ```

---

### 5. Activate / Deactivate User (ADMIN Only)
- **Method**: `PATCH`
- **Path**: `/api/auth/users/:id/status`
- **Headers**: `Authorization: Bearer <jwt-token>`
- **Body**:
  ```json
  {
    "isActive": false
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User status updated to inactive",
    "data": {
      "user": {
        "id": "uuid-string",
        "email": "staff1@wineshop.com",
        "name": "Staff Member 1",
        "role": "STAFF",
        "isActive": false
      }
    }
  }
  ```
