import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "sonic-hawk-hsmzh",
  appId: "1:688070692162:web:212e958cfdb08eda274cdb",
  apiKey: "AIzaSyBK1DdmN6P2iM1INPU7WPYbs7d10oiv6hY",
  authDomain: "sonic-hawk-hsmzh.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-8c81ea2f-4e0c-45e3-8fb8-22dded5a07f9",
  storageBucket: "sonic-hawk-hsmzh.firebasestorage.app",
  messagingSenderId: "688070692162",
  measurementId: "",
  oAuthClientId: "688070692162-7jngbts1c7sm17olp2obmcus52pqun82.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or internet connection.");
    }
  }
}

testConnection();
