const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  uploadResume: `${API_BASE_URL}/upload_resume`,
  generateQuestions: `${API_BASE_URL}/generate_questions`,
  getQuestions: (sessionId: string) => `${API_BASE_URL}/questions/${sessionId}`,
  tts: `${API_BASE_URL}/tts`,
  speechToText: `${API_BASE_URL}/speech_to_text`,
  evaluateInterview: `${API_BASE_URL}/evaluate_interview`,
};

export default API_BASE_URL;
