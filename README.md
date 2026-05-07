# Deepfake Detection

This project includes a FastAPI backend and a React frontend for image, video, and audio deepfake detection.

## Run Locally

Follow these steps to run the project on your local machine:

1. **Clone the repository:**
	```bash
	git clone <your-repository-url>
	cd Multimodel-Deepkafe-main
	```

2. **Create and activate a Python virtual environment:**
	```powershell
	python -m venv .venv
	.\.venv\Scripts\Activate.ps1
	```

3. **Install backend dependencies:**
	```powershell
	pip install -r backend/requirements.txt
	```

4. **Start the backend:**
	```powershell
	python backend/run_local.py
	```
	- This starts the FastAPI server on `127.0.0.1`.
	- It tries port `8000` first, and if busy, picks the next free port.
	- The backend automatically writes the correct API URL to `frontend/.env.local`.

5. **Open a second terminal and set up the frontend:**
	```powershell
	cd frontend
	npm install
	npm run dev
	```
	- The Vite dev server will start (default: http://localhost:5173).
	- It proxies `/api/*` requests to the backend using the URL in `.env.local`.
	- If you restart the backend and the port changes, restart the frontend to update the proxy target.

6. **Open the app in your browser:**
	```text
	http://localhost:5173
	```

## Troubleshooting Login/Account Creation

- Make sure both backend and frontend are running as described above.
- If you cannot log in or create an account:
  - Check the browser console for errors (network, CORS, etc.).
  - Check the backend terminal for error messages.
  - Ensure both servers are running and the ports match (see `.env.local`).
  - If the backend is using in-memory storage (no `DATABASE_URL`), accounts will not persist after restart.
- If you change the backend port, always restart the frontend.

## Optional: Persistent PostgreSQL Storage

Create a `.env` file in the project root for persistent storage:
```env
DATABASE_URL=postgresql://deepfake:deepfake_password@localhost:5432/deepfake_detector
JWT_SECRET=replace-with-a-long-random-secret
EMERGENT_LLM_KEY=your_key_here
```

## PostgreSQL + Drizzle

The backend stores users and scan history in PostgreSQL when `DATABASE_URL` is configured.
Drizzle owns the schema in `database/schema.ts`, with the initial SQL migration in `drizzle/0000_initial.sql`.

```bash
cd drizzle
npm install
npm run db:push
```
