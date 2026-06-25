# 🛡 SecureID — PostgreSQL Backend Setup Guide

---

## 📦 APPS YOU NEED TO INSTALL

### 1. Node.js (LTS version)
- Download: https://nodejs.org/
- After install, verify: open terminal → type `node -v`

### 2. PostgreSQL
- Download: https://www.postgresql.org/download/
- Choose your OS (Windows / Mac / Linux)
- During install, set a password for the `postgres` user — REMEMBER IT
- Default port is 5432 (leave it as-is)

### 3. pgAdmin 4 (optional but very helpful)
- Usually installed alongside PostgreSQL
- It's a visual tool to see your tables and data (like a GUI for your database)
- Download standalone: https://www.pgadmin.org/download/

---

## 🗄️ HOW TO SET UP THE DATABASE

### Step 1 — Open pgAdmin or psql terminal

**Option A: Using pgAdmin (easier)**
1. Open pgAdmin
2. Connect to your local server (enter the postgres password you set)
3. Right-click "Databases" → Create → Database
4. Name it: `secureid`
5. Click Save

**Option B: Using psql terminal (command line)**
```bash
psql -U postgres
```
Then type:
```sql
CREATE DATABASE secureid;
\q
```

---

### Step 2 — Edit your .env file

Open `backend-postgres/.env` and update these lines:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secureid
DB_USER=postgres
DB_PASSWORD=your_actual_password_here
```

Replace `your_actual_password_here` with the password you set during PostgreSQL install.

---

### Step 3 — Install Node packages

Open a terminal inside the `backend-postgres` folder:

```bash
cd secureid/backend-postgres
npm install
```

---

### Step 4 — Start the backend

```bash
npm run dev
```

You should see:
```
✅ PostgreSQL connected successfully
✅ All PostgreSQL tables synced successfully
🚀 SecureID Backend running on http://localhost:5000
🗄️  Database: PostgreSQL (secureid)
```

**The tables are created AUTOMATICALLY** — you don't need to write any SQL.
Sequelize reads your models and builds the tables for you on first run.

---

### Step 5 — Open the frontend

Go to `secureid/frontend/` and open `index.html` in your browser.

Or use the system check page first: open `system-check.html`

---

## 🗂️ WHAT TABLES GET CREATED IN POSTGRESQL

Sequelize auto-creates these tables in your `secureid` database:

| Table | What it stores |
|-------|---------------|
| `users` | Account info, hashed password, face embedding |
| `devices` | Trusted devices per user |
| `cards` | Linked ATM cards + freeze status |
| `transactions` | Simulated ATM/POS transaction history |
| `alerts` | Security events log |

### Relationships (Foreign Keys):
```
users
  └── devices       (one user → many devices)
  └── cards         (one user → many cards)
  └── alerts        (one user → many alerts)
       cards
         └── transactions  (one card → many transactions)
```

---

## 📁 FULL PROJECT STRUCTURE

```
secureid/
│
├── frontend/
│   ├── index.html           ← Login / Register
│   ├── dashboard.html       ← Main app dashboard
│   ├── emergency.html       ← 🚨 Emergency freeze (any device)
│   └── system-check.html   ← Health check page
│
├── backend-postgres/        ← ✅ USE THIS (PostgreSQL version)
│   ├── config/
│   │   └── database.js      ← Sequelize connection setup
│   ├── models/
│   │   ├── index.js         ← Associations + DB sync
│   │   ├── User.js          ← Users table
│   │   ├── Device.js        ← Devices table
│   │   ├── Card.js          ← Cards table
│   │   ├── Transaction.js   ← Transactions table
│   │   └── Alert.js         ← Alerts table
│   ├── routes/
│   │   ├── auth.js          ← Register + Login
│   │   ├── cards.js         ← Card management + freeze
│   │   ├── face.js          ← Face enroll + verify
│   │   ├── user.js          ← Profile + password
│   │   ├── devices.js       ← Trusted devices
│   │   └── alerts.js        ← Security alerts
│   ├── middleware/
│   │   └── auth.js          ← JWT token check
│   ├── .env                 ← ⚠️ Edit this with your DB password
│   ├── server.js            ← Entry point
│   └── package.json
│
└── backend/                 ← Old MongoDB version (ignore this)
```

---

## 🔌 API ENDPOINTS (same as before — frontend unchanged)

| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| GET | /api/cards | List your cards |
| POST | /api/cards/add | Link new card |
| POST | /api/cards/:id/freeze | Freeze a card |
| POST | /api/cards/:id/unfreeze | Unfreeze a card |
| POST | /api/cards/emergency-freeze | Freeze ALL cards instantly |
| POST | /api/cards/:id/simulate-transaction | Test ATM transaction |
| POST | /api/face/enroll | Save face embedding |
| POST | /api/face/verify | Verify face |
| DELETE | /api/face/remove | Remove face data |
| GET | /api/user/profile | Get profile |
| PUT | /api/user/change-password | Change password |
| GET | /api/user/stats | Get dashboard stats |
| GET | /api/alerts | Get security alerts |
| PATCH | /api/alerts/read-all | Mark all alerts read |
| GET | /api/devices | List trusted devices |
| DELETE | /api/devices/:deviceId | Revoke a device |

---

## ⚠️ COMMON ERRORS & FIXES

### "password authentication failed for user postgres"
→ Your DB_PASSWORD in .env is wrong
→ Re-open .env and fix it — use the password you set during PostgreSQL install

### "database secureid does not exist"
→ You haven't created the database yet
→ Open pgAdmin → right-click Databases → Create → name it `secureid`

### "ECONNREFUSED 127.0.0.1:5432"
→ PostgreSQL is not running
→ Windows: search Services → find PostgreSQL → Start it
→ Mac: run `brew services start postgresql`
→ Linux: run `sudo systemctl start postgresql`

### "Cannot connect to server" in browser
→ Backend is not running
→ Run `npm run dev` inside the `backend-postgres` folder

---

## 🆚 MongoDB vs PostgreSQL — What Changed

| Thing | MongoDB version | PostgreSQL version |
|-------|-----------------|--------------------|
| Connection | mongoose.connect() | sequelize.authenticate() |
| Models | Mongoose Schema | Sequelize DataTypes |
| Find one | User.findOne({ email }) | User.findOne({ where: { email } }) |
| Find by ID | User.findById(id) | User.findByPk(id) |
| Create | User.create({...}) | User.create({...}) |
| Update | user.save() | user.update({...}) |
| Delete | Model.deleteOne() | Model.destroy({ where }) |
| Devices | Array inside User doc | Separate `devices` table |
| Transactions | Array inside Card doc | Separate `transactions` table |
| Face data | Array field | Native ARRAY(FLOAT) column |

---

## ✅ FEATURES COMPLETE

| Feature | Status |
|---------|--------|
| User Registration + Login | ✅ |
| JWT Authentication | ✅ |
| Password Hashing (bcrypt) | ✅ |
| Face Enrollment & Verification | ✅ |
| ATM Card Linking | ✅ |
| Card Freeze / Unfreeze | ✅ |
| Emergency Freeze All Cards | ✅ |
| Transaction Simulation | ✅ |
| Security Alerts Log | ✅ |
| Trusted Device Tracking | ✅ |
| New Device Detection | ✅ |
| Account Lockout (5 failed logins) | ✅ |
| Password Change | ✅ |
| Emergency Page (any device) | ✅ |
| System Health Check Page | ✅ |
| PostgreSQL Relational Database | ✅ |
| Auto table creation (Sequelize sync) | ✅ |
