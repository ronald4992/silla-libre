import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const configuracion = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseDisponible = Object.values(configuracion).every(Boolean);

const aplicacion = firebaseDisponible
  ? getApps().length > 0
    ? getApp()
    : initializeApp(configuracion)
  : null;

export const autenticacion = aplicacion ? getAuth(aplicacion) : null;
export const baseDatos = aplicacion ? getFirestore(aplicacion) : null;
export const almacenamiento = aplicacion ? getStorage(aplicacion) : null;
