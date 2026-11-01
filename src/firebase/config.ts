import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: 'tayseer-tlms-1792924020',
  appId: '1:467784655941:web:fc11ead7315c408e93ef2c',
  apiKey: 'AIzaSyBHAVsVVZwPEuZEszKA7WI5BaUm5z5SR3o',
  authDomain: 'tayseer-tlms-1792924020.firebaseapp.com',
  storageBucket: 'tayseer-tlms-1792924020.firebasestorage.app',
  messagingSenderId: '467784655941',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
