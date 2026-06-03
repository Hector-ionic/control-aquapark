import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAh-0O2oWtijuVyZPm8FTaUttgWeaGqbuA",
  authDomain: "controlaquapark.firebaseapp.com",
  projectId: "controlaquapark",
  storageBucket: "controlaquapark.firebasestorage.app",
  messagingSenderId: "674632433892",
  appId: "1:674632433892:web:52349054ecc1dfed462cf1",
  measurementId: "G-ZW5BRNSV1W"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
