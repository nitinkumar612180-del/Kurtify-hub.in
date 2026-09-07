import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAYNc6KUb4-HijkqbmRA2o2qQjibpUjcBU",
  authDomain: "kurtifyhub-72568.firebaseapp.com",
  projectId: "kurtifyhub-72568",
  storageBucket: "kurtifyhub-72568.firebasestorage.app",
  messagingSenderId: "110681644105",
  appId: "1:110681644105:web:fdbf62977eade8295b3398",
  measurementId: "G-0T7RDC01CW",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
