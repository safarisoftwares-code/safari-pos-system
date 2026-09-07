# Safari POS System

Complete Point of Sale Solution by Safari Softwares

The Force Behind the Future

---

## Default Login

- Email: info@safarisoftwares.co.ke
- Password: info123

Note: Change these credentials in the .env file

---

## Quick Start

### Windows
Run: start.bat

### Manual
1. pip install -r requirements.txt
2. cd backend
3. python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Access: http://localhost:8000

---

## Features

- Authentication (Admin, Manager, Cashier)
- Product Management with Categories
- Sales Processing (Cash, M-Pesa, Card)
- User Management
- Reports and Analytics
- Data Backup
- Mobile Responsive Design

---

## User Roles

Admin: Everything - products, users, reports, backup
Manager: Products, reports, inventory
Cashier: Sales only

---

## Project Structure

safaripos/
  backend/
    main.py
    database.py
    models.py
    auth.py
    schemas.py
    routers/
      auth.py
      products.py
      sales.py
      customers.py
      reports.py
      users.py
      backup.py
  frontend/
    index.html
    login.html
    css/style.css
    js/auth.js
    js/app.js
    js/main.js
  database/
  backups/
  .env
  .env.example
  .gitignore
  requirements.txt
  start.bat
  start.sh
  README.md

---

## Security

- Credentials stored in .env (not committed to git)
- JWT authentication
- Role-based access control
- Password hashing with bcrypt

---

## About Safari Softwares

Website: https://safarisoftwares.co.ke
Email: info@safarisoftwares.co.ke

Safari Softwares builds custom software and AI solutions for businesses worldwide.

Copyright 2026 Safari Softwares. All Rights Reserved.
