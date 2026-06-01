# Inventory Management System for XAMPP

React frontend, PHP backend, and MySQL database for a local-network inventory system. The deployed app uses local files only and does not import CDN links.

## XAMPP Location

This project is prepared to run from:

```text
C:\xampp\htdocs\inventory-system
```

Open in browser:

```text
http://localhost/inventory-system/
```

For another computer on the same local network, use:

```text
http://SERVER_IP/inventory-system/
```

## XAMPP Setup

1. Open XAMPP Control Panel.
2. Start `Apache`.
3. Start `MySQL`.
4. Run the setup script in your browser:

   ```text
   http://localhost/inventory-system/backend/setup.php
   ```

The setup script creates the MySQL database, tables, and default admin.

## Default Admin

- Email: `admin@example.com`
- Password: `Admin@123`

Change this password after first login.

## Database Credentials

The backend uses XAMPP defaults:

- Host: `127.0.0.1`
- Database: `inventory_system`
- User: `root`
- Password: empty

To change them, edit:

```text
backend/config/database.php
```

## Features

- Register/signup and login pages styled with CSS box model.
- PHP session cookie login, not bearer tokens.
- Passwords are hashed with PHP `password_hash`.
- Password rule: minimum 6 characters and at least one special character.
- Default admin can change roles to `user`, `inventory_head`, and `admin`.
- Every user can update profile and password.
- Every logged-in user can add, view, and modify inventory.
- Inventory columns: `Sl. No.`, `Ledger No./Page No.`, `Nomenclature`, `Quantity/AU in no.`
- Users can request transfer only for inventory currently under them.
- Transfer target must be an existing user.
- Inventory head or admin approves/rejects transfer requests.
- Approved transfer updates the inventory owner and completes the transaction.

## Development Build

Frontend source is in:

```text
frontend
```

Build command:

```bash
cd frontend
npm install
npm run build
```

For XAMPP deployment, copy `frontend/dist` contents into the project root beside `backend`.
