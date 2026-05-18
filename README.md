# Reality Shield

Reality Shield is a FastAPI + React application for checking image, video, and audio content. The backend exposes analysis, health, analytics, and in-memory scan-history APIs. The frontend is a Vite React app.

## Prerequisites

Install these before running the project on a new machine:

- Git
- Python 3.10 or newer
- Node.js 18 or newer with npm

## Execute The Project

Use the option that matches what you want to run.

### Option 1: Run The Single ML Pipeline

This runs the complete model pipeline from the command line. It generates synthetic data, trains/evaluates the models, saves model files, and writes the evaluation report.

Windows PowerShell:

```powershell
cd Reality_Shield
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-ml.txt
$env:PYTHONIOENCODING="utf-8"
python complete_pipeline.py
```

If you are using the existing local virtual environment in this repository, you can run:

```powershell
$env:PYTHONIOENCODING="utf-8"
.\.venv\Scripts\python.exe complete_pipeline.py
```

Output files:

- Trained models: `models/saved_models`
- Evaluation report: `reports/model_evaluation_results.csv`

### Option 2: Run The Frontend Only

This starts the Vite React app. The page will load, but upload/API features need the backend unless the app is changed to use only local/static data.

```powershell
cd Reality_Shield\frontend
npm install
npm run dev
```

Open the URL shown by Vite, usually:

```text
http://localhost:5173
```

### Option 3: Run The Full Web App

Use this when you want the frontend and backend API working together.

Terminal 1, start the backend:

```powershell
cd Reality_Shield
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
python backend/run_local.py
```

The backend starts on `http://127.0.0.1:8000` when that port is free. If the port is busy, it chooses the next available port and writes the API URL to `frontend/.env.local`.

Terminal 2, start the frontend:

```powershell
cd Reality_Shield\frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

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

Create `.env` in the project root only if you need to configure the optional LLM key:

```env
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
- Scan history is kept in memory and resets when the backend restarts.
- Uploaded files and generated local data should not be committed unless intentionally needed.

## Build Frontend For Production

```powershell
cd frontend
npm run build
```

The production files are generated in `frontend/dist`.

## Troubleshooting

- If the frontend cannot reach the API, check `frontend/.env.local` and restart the frontend.
- If `pip install` fails, make sure your Python version is supported and your virtual environment is active.
- If `npm install` fails, delete `frontend/node_modules` and run `npm install` again.
- If a port is already in use, `backend/run_local.py` will automatically try the next available backend port.
