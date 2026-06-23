const firebaseConfig = {
  apiKey: "AIzaSyDzffjRRqTAvTnj3_hbeRrwFz1bqfmUcME",
  authDomain: "flujos-2a1f2.firebaseapp.com",
  projectId: "flujos-2a1f2",
  storageBucket: "flujos-2a1f2.firebasestorage.app",
  messagingSenderId: "400886435588",
  appId: "1:400886435588:web:f7b945bb4af0f09b990a51",
};

async function initFirebase() {
  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js"),
    ]);
    const app = initializeApp(firebaseConfig);
    const db = firestore.getFirestore(app);
    window.flujosFirebaseApp = app;
    window.flujosFirebase = { db, ...firestore };
    window.dispatchEvent(new CustomEvent("flujos:firebase-ready", { detail: window.flujosFirebase }));
  } catch {
    window.flujosFirebaseApp = null;
    window.flujosFirebase = null;
  }
}

initFirebase();