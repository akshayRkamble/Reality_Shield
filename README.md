# Deepfake Detection

This project includes a FastAPI backend and a React frontend for image, video, and audio deepfake detection.

## Run Locally

Follow these exact steps on your local machine.

1. Clone the repository:

```bash
git clone <your-repository-url>
cd Multimodel-Deepkafe-main
```

2. Create and activate a Python virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Install the backend dependencies:

```powershell
pip install -r backend/requirements.txt
```

4. Start the backend:

```powershell
python backend/run_local.py
```

What this does:
- Starts the FastAPI server
- Uses `127.0.0.1`
- Tries port `8000` first
- Automatically picks the next free port if `8000` is busy
- Writes the backend URL to `frontend/.env.local`

5. Open a second terminal and install the frontend dependencies:

```powershell
cd frontend
npm install
```

6. Start the frontend:

```powershell
npm run dev
```

7. Open the app in your browser:

```text
http://localhost:5173
```

## Notes

- If the backend uses a port other than `8000`, restart the frontend after the backend starts.
- If MongoDB is not running, the backend will fall back to in-memory storage.
- If `pip install` fails, make sure the virtual environment is activated first.
- If the frontend will not start, confirm `node -v` and `npm -v` work on your machine.

## Optional `.env`

Create a `.env` file in the project root only if you want to use MongoDB or other backend settings:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=deepfake_detector
EMERGENT_LLM_KEY=your_key_here
```
