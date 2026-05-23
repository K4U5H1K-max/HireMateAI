# HireMate AI - Interview Application

An AI-powered interview platform that analyzes resumes, generates personalized interview questions, and evaluates candidate responses.

## Features

- **Resume Analysis**: Upload PDF or TXT resumes for AI-powered evaluation
- **Dynamic Interview Questions**: AI generates role-specific questions based on resume
- **Voice Recording**: Record answers using microphone with speech-to-text transcription
- **Text-to-Speech**: AI reads questions aloud
- **Performance Evaluation**: Get detailed scores on technical skills, communication, and role fit
- **PDF Export**: Download complete interview results as PDF

## Project Structure

```
project/
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx           # Landing page
│   │   ├── ResumeAnalyzer.tsx     # Resume upload and analysis
│   │   ├── InterviewScreen.tsx    # Interview Q&A interface
│   │   └── ResultsPage.tsx        # Evaluation results
│   ├── config/
│   │   └── api.ts                 # API endpoint configuration
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   ├── utils/
│   │   └── pdfGenerator.ts        # PDF generation utility
│   ├── App.tsx                    # Main app with routing
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
└── backend.py                     # FastAPI backend (place here)
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Microphone access for voice recording
- Google Gemini API key

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

### Backend Setup

1. Place the `backend.py` file in the project root directory

2. Install Python dependencies:
```bash
pip install fastapi uvicorn pyttsx3 speechrecognition google-generativeai pdfminer.six python-multipart
```

3. Set your Gemini API key:
```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or on Windows:
```bash
set GEMINI_API_KEY=your-api-key-here
```

4. Start the backend server:
```bash
python backend.py
```

The backend will run on `http://localhost:8000`

### Running Both Together

1. Open two terminal windows

2. Terminal 1 (Backend):
```bash
export GEMINI_API_KEY="your-api-key-here"
python backend.py
```

3. Terminal 2 (Frontend):
```bash
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
npm run build
```

Built files will be in `dist/` directory.

## Notes

- Ensure microphone permissions are granted in browser
- Backend must be running for all features to work
- Internet connection required for Google Gemini API
- Speech recognition requires internet (uses Google Web Speech API)

## Troubleshooting

**Microphone not working**: Check browser permissions and ensure HTTPS or localhost

**API errors**: Verify GEMINI_API_KEY is set correctly and backend is running

**CORS errors**: Ensure backend is running on port 8000 and frontend on 5173

**Audio playback issues**: Check browser audio permissions and volume settings

## License

MIT
