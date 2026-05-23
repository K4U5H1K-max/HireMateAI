# HireMate AI - Interview Application

An AI-powered interview platform that analyzes resumes, generates personalized interview questions, and evaluates candidate responses.

## Features

- **Resume Analysis**: Upload PDF or TXT resumes for AI-powered evaluation
- **Dynamic Interview Questions**: AI generates role-specific questions based on resume
- **Voice Recording**: Record answers using microphone with speech-to-text transcription
- **Text-to-Speech**: AI reads questions aloud
- **Performance Evaluation**: Get detailed scores on technical skills, communication, and role fit
- **PDF Export**: Download complete interview results as PDF
- **Employer Workflow**: Employer profile setup, job listing, and per-job applicant analytics dashboard
- **User-wise Memory**: Candidate interview history and employer data are persisted per authenticated user

## Project Structure

```
project/
├── .env
├── .env.example
├── .gitignore
├── README.md
├── frontend/
│   ├── .bolt/
│   ├── index.html
│   ├── node_modules/
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── config/
│   │   │   └── api.ts
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── utils/
│   ├── start.bat
│   ├── start.sh
│   ├── tailwind.config.js
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
└── backend/
   ├── backendmp.py
   ├── requirements.txt
   └── runtime.txt
```

Local-only folders such as `venv/` and `__pycache__/` stay at the project root and are ignored.

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Microphone access for voice recording
- Google Gemini API key

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create `frontend/.env` from `frontend/.env.example` and fill in the Firebase settings for both login pages.

The candidate and employer login pages each use their own Firebase project config:
- `VITE_CANDIDATE_FIREBASE_*`
- `VITE_EMPLOYER_FIREBASE_*`

4. Configure Firestore for both Firebase projects:
- Candidate project: deploy rules from `frontend/firestore.candidate.rules`
- Employer project: deploy rules from `frontend/firestore.employer.rules`

3. Start development server:
```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:5173`

### Backend Setup

1. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Set your Gemini API key:
```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or on Windows:
```bash
set GEMINI_API_KEY=your-api-key-here
```

3. Start the backend server:
```bash
cd backend
python backendmp.py
```

The backend will run on `http://localhost:8000`

### Running Both Together

1. Open two terminal windows

2. Terminal 1 (Backend):
```bash
export GEMINI_API_KEY="your-api-key-here"
cd backend
python backendmp.py
```

3. Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

4. Open browser to `http://localhost:5173`

## Usage Flow

1. **Home Page**: Click "Start Interview" to begin
2. **Resume Analyzer**:
   - Enter company name and job role
   - Select number of questions (1-15)
   - Upload resume (PDF or TXT)
   - Click "Analyze Resume" to get evaluation
   - Click "Proceed to Interview"
3. **Interview Screen**:
   - AI generates questions based on your resume
   - Click speaker icon to hear question
   - Type answer or click "Record Answer" to speak
   - Submit each answer to proceed
4. **Results Page**:
   - View performance scores and feedback
   - Review complete interview transcript
   - Download PDF report

### Employer Flow

1. **Employer Login/Signup**
2. **Employer Profile**: Must complete company + contact details
3. **Job Listing**: Create jobs with role details, work mode, requirements, and human-round score threshold
4. **Job Analytics**: View applicants count, average scores, and qualified-for-human-interview count per job

## Secure Data Storage (Deployment-safe)

This project now uses managed Firebase Firestore collections instead of in-memory storage for employer and candidate history data:

- Candidate memory (candidate Firebase project):
   - `candidateUsers/{uid}/interviews/{docId}`
   - Stores interview transcripts, scores, and feedback per candidate user

- Employer data (employer Firebase project):
   - `employerProfiles/{uid}`
   - `jobs/{jobId}`
   - `applications/{applicationId}`

Security model:
- Candidate users can only read/write their own `candidateUsers/{uid}` subtree
- Employer users can only read/write their own profile and jobs
- Applications are restricted through job ownership checks

Important: deploy both Firestore rule files before production rollout.

## Technology Stack

### Frontend
- React 18 + TypeScript
- Vite for build tooling
- React Router for navigation
- Tailwind CSS for styling
- Lucide React for icons

### Backend
- FastAPI for REST API
- Google Gemini AI for question generation and evaluation
- pyttsx3 for text-to-speech
- SpeechRecognition for speech-to-text
- PDFMiner for resume parsing

## API Endpoints

- `POST /upload_resume` - Upload and analyze resume
- `POST /generate_questions` - Generate interview questions
- `GET /questions/{session_id}` - Retrieve questions by session
- `POST /tts` - Convert text to speech
- `POST /speech_to_text` - Transcribe audio to text
- `POST /evaluate_interview` - Evaluate interview performance

## Theme Colors

- Primary: `#05fcd3` (Neon Teal)
- Background: Black with animated gradients
- Text: White
- Accents: Cyan, Teal

## Build for Production

```bash
cd frontend
npm run build
```

Run this from `frontend/`.

Built files will be in `frontend/dist/` directory.

## Notes

- Ensure microphone permissions are granted in browser
- Backend must be running for all features to work
- Internet connection required for Google Gemini API
- Speech recognition requires internet (uses Google Web Speech API)
- Frontend Vite env vars belong in `frontend/.env`
- Backend env vars can live in `project/.env` or `backend/.env`

## Troubleshooting

**Microphone not working**: Check browser permissions and ensure HTTPS or localhost

**API errors**: Verify GEMINI_API_KEY is set correctly and backend is running

**CORS errors**: Ensure backend is running on port 8000 and frontend on 5173

**Audio playback issues**: Check browser audio permissions and volume settings

## License

MIT
