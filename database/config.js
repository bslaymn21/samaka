/**
 * Firebase Configuration and Initialization
 */

const firebaseConfig = {
  apiKey: "AIzaSyAvoG0_eymccdGjEmrecBw0KoWtFuKIk6Y",
  authDomain: "samaka-6ae79.firebaseapp.com",
  projectId: "samaka-6ae79",
  storageBucket: "samaka-6ae79.firebasestorage.app",
  messagingSenderId: "599051063463",
  appId: "1:599051063463:web:4c52f8f1dda1dec2dd4b82",
  measurementId: "G-NQLRQ7ZJ45"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
const auth = getAuth(app);
const analytics = getAnalytics(app);

export { db, auth, analytics };
