import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore/lite';

const employerFirebaseConfig = {
 apiKey: "AIzaSyB5Bw-GzkVym0zbgzM1IK5Z6o492VMPj6s",
  authDomain: "hiremateemployer.firebaseapp.com",
  projectId: "hiremateemployer",
  storageBucket: "hiremateemployer.firebasestorage.app",
  messagingSenderId: "836265955376",
  appId: "1:836265955376:web:7a3ce1b054a6a535bf9df5" 
};

const requiredEmployerKeys = [
  employerFirebaseConfig.apiKey,
  employerFirebaseConfig.authDomain,
  employerFirebaseConfig.projectId,
  employerFirebaseConfig.appId,
];

const employerFirebaseReady = requiredEmployerKeys.every(Boolean);

let employerApp: FirebaseApp | null = null;
let employerAuth: Auth | null = null;
let employerDb: Firestore | null = null;

if (employerFirebaseReady) {
  employerApp =
    getApps().find((app) => app.name === 'employer-auth') ??
    initializeApp(employerFirebaseConfig, 'employer-auth');
  employerAuth = getAuth(employerApp);
}

const getEmployerDb = () => {
  if (!employerFirebaseReady || !employerApp) {
    throw new Error('Employer Firebase is not configured.');
  }

  if (!employerDb) {
    employerDb = getFirestore(employerApp);
  }

  return employerDb;
};

export { employerApp, employerAuth, getEmployerDb, employerFirebaseReady };