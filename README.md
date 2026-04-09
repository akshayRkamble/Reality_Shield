# Multidisciplinary Deepfake Detection

This repository contains a solution for detecting deepfakes across multiple modalities, including images, audio, and video. The system leverages various machine learning models, including CNNs, Transformers, SVMs, Bayesian models, and Vision Transformers, to classify real and fake data effectively.

## Table of Contents

- [Project Overview](#project-overview)
- [Directory Structure](#directory-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Run Locally on Another Machine](#run-locally-on-another-machine)
- [Models](#models)
- [Notebooks](#notebooks)
- [Logging](#logging)
- [Docker Support](#docker-support)
- [License](#license)

## Project Overview

This project is designed to detect deepfakes using a combination of different models applied to image, audio, and video data. It includes:
- **Image Classification** using CNNs and Vision Transformers.
- **Audio Classification** using advanced models and preprocessing techniques.
- **Video Classification** by analyzing frames using deep learning models.
- **NLP for Text Analysis** in videos where necessary.

## Directory Structure

The repository is organized as follows:

```
multidisciplinary-deepfake-detection/
│
├── data/
│   ├── raw/                # Raw data
│   ├── processed/          # Processed data
│   └── sample_data.csv     # Example data file
│
├── models/
│   ├── saved_models/       # Trained models
│   ├── cnn_model.h5        # CNN model
│   ├── transformer_model.pth # Transformer model
│   ├── svm_model.pkl       # SVM model
│   ├── bayesian_model.pkl  # Bayesian model
│   ├── vision_transformer_model.pth # Vision Transformer model
│   └── model_architecture.png # Model architecture visualization
│
├── notebooks/              # Jupyter notebooks for EDA, training, and evaluation
│   ├── Data Preprocessing.ipynb
│   ├── Exploratory Data Analysis.ipynb
│   ├── Model Training.ipynb
│   └── Model Evaluation.ipynb
│
├── scripts/                # Shell and Python scripts
│   ├── download_data.sh
│   ├── preprocess_data.py
│   ├── generate_report.py
│   ├── train_all_models.sh
│   └── evaluate_all_models.sh
│
├── src/                    # Source code for models, data processing, and utilities
│   ├── dataset/
│   ├── models/
│   ├── training/
│   ├── evaluation/
│   ├── utils/
│   ├── processing/
│   └── config.py
│
├── tests/                  # Unit tests for the project
│   ├── test_data_loading.py
│   ├── test_model.py
│   ├── test_training.py
│   ├── test_evaluation.py
│   └── test_utils.py
│
├── logs/                   # Log files for tracking the progress
│   ├── model_training.log
│   ├── data_preprocessing.log
│   ├── evaluation.log
│   └── system.log
│
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose configuration
├── requirements.txt        # Python dependencies
├── setup.py                # Python package setup
├── .env                    # Environment variables
├── entrypoint.sh           # Docker entrypoint script
├── LICENSE                 # License file
├── .gitattributes          # Git attributes
├── .gitignore              # Git ignore rules
├── CHANGELOG.md            # Changelog for the project
└── README.md               # Project documentation
```

## Getting Started

### Prerequisites

- **Python 3.10+** recommended
- **Node.js 18+** and `npm`
- **Git**
- **MongoDB** optional
  If MongoDB is not available, the backend now falls back to in-memory scan storage for local testing.

### Run Locally on Another Machine

Follow these steps on a fresh machine.

1. Clone the project:

```bash
git clone <your-repository-url>
cd Multimodel-Deepkafe-main
```

2. Create and activate a Python virtual environment:

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

3. Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

4. Create a `.env` file in the project root:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=deepfake_detector
EMERGENT_LLM_KEY=your_key_here
```

Notes:
- `MONGO_URL` and `DB_NAME` are optional for local UI testing.
- If MongoDB is not running, the app will still start and use in-memory storage.
- `EMERGENT_LLM_KEY` is currently not required for the local CNN image flow.

5. Start the backend API from the project root:

```bash
python backend/run_local.py
```

This launcher tries port `8000` first. If `8000` is already in use, it automatically picks the next free port and updates the frontend API target.

6. In a second terminal, install frontend dependencies:

```bash
cd frontend
npm install
```

7. Start the React frontend:

```bash
npm run dev
```

If the backend had to switch from `8000` to another port, restart the frontend after starting the backend so Vite picks up the updated `frontend/.env.local`.

8. Open the app in your browser:

```text
http://127.0.0.1:5173
```

### Local URLs

- Frontend: `http://127.0.0.1:5173`
- Backend API: usually `http://127.0.0.1:8000`
- Backend health check: usually `http://127.0.0.1:8000/api/health`

If port `8000` is busy, `python backend/run_local.py` will print the actual backend URL it selected.

### If Something Fails

- If the frontend says the backend is unavailable, make sure the backend terminal is still running.
- If analytics or scan history do not load, MongoDB may not be running. The app should still work with in-memory storage.
- If Python package install fails, confirm you activated the virtual environment before running `pip install`.
- If `npm run dev` fails, check that Node.js and `npm` are installed by running `node -v` and `npm -v`.

### Production Build for Frontend

To verify the React frontend builds successfully:

```bash
cd frontend
npm install
npm run build
```

### Optional Docker Run

If you prefer Docker, you can also try:

```bash
docker-compose build
docker-compose up
```

## Models

The project includes several machine learning models:

- **CNN Model** for image classification.
- **Transformer Model** for handling sequential data.
- **SVM Model** for baseline classification tasks.
- **Bayesian Model** for probabilistic modeling.
- **Vision Transformer Model** for advanced image classification tasks.

## Notebooks

The following Jupyter notebooks are provided for further exploration:

- **Data Preprocessing:** Contains steps for cleaning and preparing the data.
- **Exploratory Data Analysis:** Includes visualizations and insights from the dataset.
- **Model Training:** Contains code for training the models.
- **Model Evaluation:** Shows the evaluation results of the trained models.

## Logging

Logs for all major processes are stored in the `logs/` directory. This includes logs for:

- Data Preprocessing
- Model Training
- Model Evaluation
- System Setup and Execution

## Docker Support

This project supports Docker to simplify setup and deployment. The `Dockerfile` and `docker-compose.yml` are configured to run the application in a containerized environment.

- The `Dockerfile` handles environment setup and installation of dependencies.
- The `docker-compose.yml` file orchestrates the various services, such as the web app and database.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International Public License. By using this software, you agree to the terms stated in the [LICENSE](LICENSE) file.



## React Frontend

A React frontend is available in `frontend/` for uploading media, viewing scan results, and monitoring analytics from the FastAPI backend.

### Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite development server proxies `/api/*` requests to the backend URL defined in `frontend/.env.local`, or falls back to `http://127.0.0.1:8000`.
