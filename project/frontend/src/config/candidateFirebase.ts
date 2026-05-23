import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore/lite';

const candidateFirebaseConfig = {
  apiKey: "AIzaSyBAcbzczUI4Me9SpXtfjR8VA_pMH0WCSMQ",
  authDomain: "hiremate-dc856.firebaseapp.com",
  projectId: "hiremate-dc856",
  storageBucket: "hiremate-dc856.firebasestorage.app",
  messagingSenderId: "504072412874",
  appId: "1:504072412874:web:9f124c2711d4de605bde33"
};

const requiredCandidateKeys = [
  candidateFirebaseConfig.apiKey,
  candidateFirebaseConfig.authDomain,
  candidateFirebaseConfig.projectId,
  candidateFirebaseConfig.appId,
];

const candidateFirebaseReady = requiredCandidateKeys.every(Boolean);

let candidateApp: FirebaseApp | null = null;
let candidateAuth: Auth | null = null;
let candidateDb: Firestore | null = null;

if (candidateFirebaseReady) {
  candidateApp =
    getApps().find((app) => app.name === 'candidate-auth') ??
    initializeApp(candidateFirebaseConfig, 'candidate-auth');
  candidateAuth = getAuth(candidateApp);
}

const getCandidateDb = () => {
  if (!candidateFirebaseReady || !candidateApp) {
    throw new Error('Candidate Firebase is not configured.');
  }

  if (!candidateDb) {
    candidateDb = getFirestore(candidateApp);
  }

  return candidateDb;
};

export { candidateApp, candidateAuth, getCandidateDb, candidateFirebaseReady };