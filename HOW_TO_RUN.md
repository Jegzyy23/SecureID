# 🛡 SecureID — Complete Setup & Usage Guide
### Everything you need to run, test and present your project

---

## PART 1 — WHAT YOU NEED TO INSTALL

Install these **in this order** before touching any code.

---

### 1. Node.js
**What it is:** The engine that runs your backend server.

**Download:** https://nodejs.org/
- Click the big **LTS** button (e.g. v20.x)
- Run the installer, click Next through everything
- Restart your computer after installing

**Verify it worked:** Open a terminal (Command Prompt on Windows, Terminal on Mac) and type:
```
node -v
```
You should see something like `v20.11.0`. If you do, Node is installed ✅

---

### 2. PostgreSQL
**What it is:** The database where all user data, cards, alerts etc. are stored.

**Download:** https://www.postgresql.org/download/
- Choose your operating system
- Run the installer
- ⚠️ IMPORTANT: During installation it will ask you to **set a password for the postgres user** — write this password down, you will need it
- Leave the port as **5432** (default)
- Let it install all components including pgAdmin

**Verify it worked:** After install you should see pgAdmin 4 in your applications. Open it — if it loads, PostgreSQL is installed ✅

---

### 3. pgAdmin 4
**What it is:** A visual interface to see and manage your database (like a GUI instead of typing SQL).

This is usually installed automatically with PostgreSQL. If not:
**Download:** https://www.pgadmin.org/download/

---

### 4. A Code Editor (Recommended)
**VS Code:** https://code.visualstudio.com/
- After installing, open VS Code, go to Extensions (left sidebar), search for **Live Server** and install it
- Live Server lets you open HTML files properly so the camera works

---

## PART 2 — SETTING UP THE DATABASE

You only need to do this once.

### Step 1: Open pgAdmin
- Open pgAdmin 4 from your applications
- It will open in your browser
- Enter the **master password** you set during installation

### Step 2: Connect to the server
- In the left panel you'll see "Servers" — expand it
- You should see "PostgreSQL 16" (or similar) — click it
- Enter your **postgres user password** when asked

### Step 3: Create the database
- Right-click on **Databases** in the left panel
- Click **Create → Database**
- In the "Database" field type: `secureid`
- Click **Save**

That's it! The database `secureid` now exists. ✅

The tables inside it (users, cards, devices, alerts, transactions) will be **created automatically** when you start the backend for the first time.

---

## PART 3 — CONFIGURING THE BACKEND

### Step 1: Open the project folder
Open `secureid/backend-postgres/` in your file explorer.

### Step 2: Edit the .env file
Open the file called `.env` (it might be hidden — enable "show hidden files" in your file explorer).

Change this line:
```
DB_PASSWORD=yourpassword
```
To your actual PostgreSQL password. For example:
```
DB_PASSWORD=mypassword123
```

Leave everything else as-is unless you changed the default PostgreSQL port (5432).

### Step 3: Install the packages
Open a terminal/command prompt and navigate to the backend folder:

**On Windows:**
```
cd C:\Users\YourName\Desktop\secureid\backend-postgres
npm install
```

**On Mac/Linux:**
```
cd ~/Desktop/secureid/backend-postgres
npm install
```

Wait for it to finish. You should see a `node_modules` folder appear. ✅

---

## PART 4 — RUNNING THE PROJECT

You need **two things running** at the same time: the backend server, and the frontend in a browser.

---

### Terminal 1 — Start the Backend

Navigate to the backend folder and run:
```
npm run dev
```

If everything is correct you will see:
```
✅ PostgreSQL connected successfully
✅ All PostgreSQL tables synced successfully
🚀 SecureID Backend running on http://localhost:5000
🗄️  Database: PostgreSQL (secureid)
```

**Keep this terminal open at all times.** If you close it, the backend stops and the app won't work.

---

### Opening the Frontend

**Option A — Direct open (camera may not work):**
Go to `secureid/frontend/` and double-click `index.html`

**Option B — VS Code Live Server (recommended, camera works):**
1. Open VS Code
2. Open the `secureid/frontend/` folder (File → Open Folder)
3. Right-click on `index.html` in the file explorer panel
4. Click **"Open with Live Server"**
5. Your browser will open at `http://127.0.0.1:5500` or similar

**Option C — Python server:**
```
cd secureid/frontend
python -m http.server 3000
```
Then open: `http://localhost:3000`

---

## PART 5 — USING THE APP (Step by Step)

### ① System Check (Do This First)
Open `system-check.html` — this page automatically checks:
- Is the browser compatible?
- Is the backend running?
- Is PostgreSQL connected?
- Is the camera available?

All items should show ✅ green before you proceed. If something is red, follow the fix instructions shown on that page.

---

### ② Register an Account
1. Open `index.html` in the browser
2. Click the **Register** tab
3. Enter your full name, email, and a password (at least 6 characters)
4. Click **Create My Account**
5. You'll be automatically redirected to the Dashboard

---

### ③ Link an ATM Card
1. In the dashboard sidebar, click **My Cards**
2. Click **Link New Card**
3. Fill in the form:
   - Card Number: any 16-digit number (this is a simulation, use fake numbers like `4111111111111111`)
   - Card Holder: your name in caps (e.g. `EMMANUEL CHUKWU`)
   - Bank: GTBank, Access, UBA, etc.
   - Card Type: Verve / Visa / Mastercard
   - Expiry: any month/year
4. Click **Link Card**
5. The card appears with a visual ATM card design ✅

---

### ④ Enroll Your Face
1. In the sidebar click **Face ID**
2. Click **📷 Start Camera** — allow camera access when the browser asks
3. Position your face clearly in the frame
4. Click **✅ Enroll My Face**
5. You'll see "Face enrolled" confirmation
6. To test it, click **🔍 Verify** — it will compare your live face to the stored embedding and show a similarity percentage

> Note: The face embedding is stored as 128 numbers, not as a photo. This is the same approach used in real facial recognition systems.

---

### ⑤ Test the Card Freeze
1. Click **My Cards** in the sidebar
2. Find a card and click **❄ Freeze Card**
3. The card instantly turns greyed out and shows "❄ Frozen"
4. Click **🔓 Unfreeze** to restore it

---

### ⑥ Test the Emergency Freeze
This simulates what happens if your phone is stolen.

**From the dashboard:**
1. Click **🚨 Emergency Freeze All** in the sidebar (bottom)
2. A confirmation modal appears
3. Click **Freeze Everything Now**
4. All active cards are frozen instantly

**From a different device:**
1. Open `emergency.html` in any browser
2. Enter your email and password
3. You'll see all your linked cards
4. Click **🚨 Freeze All Cards Now**
5. Done — cards are frozen from that device without needing to be logged in

---

### ⑦ Simulate an ATM Transaction
1. Click **Test Transaction** in the sidebar
2. Select a card from the dropdown
3. Enter an amount (e.g. 5000)
4. Click **Run Simulation**
5. If the card is **active** → ✅ Transaction approved
6. If the card is **frozen** → ❌ Transaction declined

This demonstrates the core security feature: a frozen card will decline every transaction.

---

### ⑧ View Security Alerts
1. Click **Alerts** in the sidebar (or the 🔔 bell icon in the nav bar)
2. You'll see a complete log of all security events:
   - Every login
   - New device detections
   - Card freeze/unfreeze actions
   - Face mismatch attempts
   - Account lockouts

---

### ⑨ Manage Trusted Devices
1. Click **Devices** in the sidebar
2. You'll see every browser/device that has logged into your account
3. You can click **Revoke** to remove any unrecognised device
4. If you log in from a new device, a "New device detected" alert is automatically created

---

## PART 6 — PROJECT FILE STRUCTURE

```
secureid/
│
├── frontend/                  ← Open these in the browser
│   ├── index.html             ← Login / Register page
│   ├── dashboard.html         ← Main security dashboard
│   ├── emergency.html         ← Emergency freeze (any device)
│   └── system-check.html      ← Health check page
│
├── backend-postgres/          ← The server (run with npm run dev)
│   ├── config/
│   │   └── database.js        ← PostgreSQL connection
│   ├── models/
│   │   ├── index.js           ← All model associations + DB sync
│   │   ├── User.js            ← users table
│   │   ├── Device.js          ← devices table
│   │   ├── Card.js            ← cards table
│   │   ├── Transaction.js     ← transactions table
│   │   └── Alert.js           ← alerts table
│   ├── routes/
│   │   ├── auth.js            ← POST /api/auth/register, /login
│   │   ├── cards.js           ← GET/POST /api/cards
│   │   ├── face.js            ← POST /api/face/enroll, /verify
│   │   ├── user.js            ← GET /api/user/profile, stats
│   │   ├── devices.js         ← GET/DELETE /api/devices
│   │   └── alerts.js          ← GET/PATCH /api/alerts
│   ├── middleware/
│   │   └── auth.js            ← JWT token verification
│   ├── .env                   ← ⚠️ Edit DB_PASSWORD here
│   ├── server.js              ← Entry point — start here
│   └── package.json
│
└── backend/                   ← Old MongoDB version — ignore this
```

---

## PART 7 — COMMON PROBLEMS & SOLUTIONS

### "Cannot connect to server" in the browser
→ Your backend is not running
→ Solution: Open a terminal → `cd secureid/backend-postgres` → `npm run dev`

### "password authentication failed for user postgres"
→ Your DB_PASSWORD in `.env` is wrong
→ Solution: Open `.env`, correct the password to match what you set during PostgreSQL install

### "database secureid does not exist"
→ You haven't created the database yet
→ Solution: Open pgAdmin → right-click Databases → Create → name it `secureid`

### "ECONNREFUSED 127.0.0.1:5432"
→ PostgreSQL is not running
→ Windows: Search "Services" in Start Menu → Find "PostgreSQL 16" → Right-click → Start
→ Mac: Open Terminal → `brew services start postgresql`
→ Linux: `sudo systemctl start postgresql`

### Camera not working / Face ID doesn't load
→ Camera requires HTTPS or localhost — it won't work from a `file://` URL
→ Solution: Use VS Code Live Server, or run `python -m http.server 3000` in the frontend folder

### "npm: command not found"
→ Node.js is not installed
→ Go back to Part 1 and install Node.js

### Port 5000 already in use
→ Another app is using port 5000
→ Solution: Open `backend-postgres/.env` → change `PORT=5000` to `PORT=5001`
→ Also update the line `const API = 'http://localhost:5000/api'` in all 4 HTML files to `5001`

---

## PART 8 — HOW TO EXPLAIN IT TO YOUR SUPERVISOR

When presenting, explain it like this:

**The Problem:**  
"When someone steals a phone, they can potentially access the owner's banking information before the victim can react."

**Our Solution:**  
"SecureID is a biometric-secured identity and banking protection system. It uses facial recognition to verify the user, tracks which devices access the account, and allows instant card freezing from any device — even without the stolen phone."

**Technical Stack:**
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Node.js with Express.js REST API
- Database: PostgreSQL with Sequelize ORM
- Security: JWT tokens, bcrypt password hashing, face embedding (128-float vector)
- Architecture: RESTful API, relational database with foreign key constraints

**The Core Feature:**  
"Even if the phone is stolen, the thief's face won't match the enrolled biometric. The owner can log in from any other device, navigate to emergency.html, and freeze all linked cards in under 10 seconds — before any transaction can go through."

---

## PART 9 — QUICK REFERENCE

| Page | URL | Purpose |
|------|-----|---------|
| Login/Register | `index.html` | Create account or sign in |
| Dashboard | `dashboard.html` | Main security centre |
| Emergency | `emergency.html` | Freeze cards from any device |
| System Check | `system-check.html` | Verify everything is running |
| API Health | `http://localhost:5000/api/health` | Check backend is alive |

| Action | How |
|--------|-----|
| Start backend | `cd backend-postgres && npm run dev` |
| Stop backend | Press `Ctrl + C` in the terminal |
| View database | Open pgAdmin → secureid database → Tables |
| Reset all data | In pgAdmin: right-click database → Delete/Drop → Recreate |
