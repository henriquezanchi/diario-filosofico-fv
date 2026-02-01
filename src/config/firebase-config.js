import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// SUAS CREDENCIAIS DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAIGwnL--sP4uJiru0d_XFCcOkJ5NpViFU",
  authDomain: "diario-filosofico.firebaseapp.com",
  projectId: "diario-filosofico",
  storageBucket: "diario-filosofico.firebasestorage.app",
  messagingSenderId: "284774616483",
  appId: "1:284774616483:web:a7705573f1071b56e35e16",
  measurementId: "G-JFD8VCB1W1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
