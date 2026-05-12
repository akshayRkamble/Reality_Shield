# Reality Shield

Reality Shield is a FastAPI + React application for checking image, video, and audio content. The backend exposes analysis, health, auth, analytics, and scan-history APIs. The frontend is a Vite React app.

## Prerequisites

Install these before running the project on a new machine:

- Git
- Python 3.10 or newer
- Node.js 18 or newer with npm
- Optional: PostgreSQL, only if you want persistent user and scan storage

## Run From Scratch

Open PowerShell or a terminal and follow these steps.

### 1. Clone the repository

```powershell
git clone https://github.com/akshayRkamble/Reality_Shield.git
cd Reality_Shield
```

### 2. Create and activate a Python virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install backend dependencies

```powershell
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 4. Optional: create a `.env` file

The app can run without PostgreSQL, but user accounts and scan history may not persist after restart. For persistent storage, create `.env` in the project root:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/reality_shield
JWT_SECRET=replace-with-a-long-random-secret
EMERGENT_LLM_KEY=your_api_key_here
```

Do not commit real API keys or secrets.

### 5. Start the backend

```powershell
python backend/run_local.py
```

The backend:

- Starts on `http://127.0.0.1:8000` when that port is free
- Chooses the next free port if `8000` is busy
- Writes the API URL to `frontend/.env.local`

Keep this terminal running.

### 6. Install and start the frontend

Open a second terminal:

```powershell
cd Reality_Shield\frontend
npm install
npm run dev
```

On macOS or Linux:

```bash
cd Reality_Shield/frontend
npm install
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

## Important Local Development Notes

- Start the backend before the frontend so `frontend/.env.local` is created with the correct backend URL.
- If the backend port changes, stop and restart the frontend.
- The frontend proxies `/api/*` requests to the backend.
- Uploaded files and generated local data should not be committed unless intentionally needed.

## Optional PostgreSQL + Drizzle

The backend can use PostgreSQL when `DATABASE_URL` is configured. The schema lives in `database/schema.ts`, with the initial SQL migration in `drizzle/0000_initial.sql`.

Install root Node dependencies and push the schema:

```powershell
npm install
npm run db:push
```

## Build Frontend For Production

```powershell
cd frontend
npm run build
```

The production files are generated in `frontend/dist`.

## Troubleshooting

- If account creation or login fails, confirm both backend and frontend terminals are running.
- If the frontend cannot reach the API, check `frontend/.env.local` and restart the frontend.
- If `pip install` fails, make sure your Python version is supported and your virtual environment is active.
- If `npm install` fails, delete `frontend/node_modules` and run `npm install` again.
- If a port is already in use, `backend/run_local.py` will automatically try the next available backend port.
