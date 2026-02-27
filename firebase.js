/**
 * firebase.js
 * Configuração e operações do Firebase
 */

const FirebaseService = {
  app: null,
  auth: null,
  db: null,
  isReady: false,
  user: null,

  firebaseConfig: {
    apiKey: "AIzaSyByJnfkBEeq_GoK1an6dYlyyLJ4E29LZ1Q",
    authDomain: "colacaodegrauatila.firebaseapp.com",
    projectId: "colacaodegrauatila",
    storageBucket: "colacaodegrauatila.firebasestorage.app",
    messagingSenderId: "757864555562",
    appId: "1:757864555562:web:eceb9753b6c747d6c24f53",
  },

  async initialize() {
    if (!window.firebaseReady) {
      await new Promise((resolve) => {
        window.addEventListener("firebase-ready", resolve, { once: true });
      });
    }

    const {
      initializeApp,
      getAuth,
      signInAnonymously,
      onAuthStateChanged,
      getFirestore,
    } = window.firebaseModules;

    try {
      this.app = initializeApp(this.firebaseConfig);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      await this.signInAnonymous();

      onAuthStateChanged(this.auth, (user) => {
        this.user = user;
      });

      this.isReady = true;
      return true;
    } catch (error) {
      console.error("[Firebase] Erro fatal:", error.message);
      return false;
    }
  },

  async signInAnonymous() {
    const { signInAnonymously } = window.firebaseModules;

    try {
      const userCredential = await signInAnonymously(this.auth);
      this.user = userCredential.user;
      return userCredential.user;
    } catch (error) {
      console.error("[Auth] Erro:", error.code, error.message);
      throw error;
    }
  },

  async addMessage(name, message) {
    if (!this.isReady) {
      throw new Error("Firebase não está pronto");
    }

    if (!this.user) {
      throw new Error("Usuário não autenticado");
    }

    const { collection, addDoc, serverTimestamp } = window.firebaseModules;

    const trimmedName = name.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || trimmedName.length > 40) {
      throw new Error("Nome inválido");
    }

    if (!trimmedMessage || trimmedMessage.length > 200) {
      throw new Error("Mensagem inválida");
    }

    try {
      const messagesRef = collection(this.db, "messages");

      const docRef = await addDoc(messagesRef, {
        name: trimmedName,
        message: trimmedMessage,
        createdAt: serverTimestamp(),
      });

      return {
        id: docRef.id,
        name: trimmedName,
        message: trimmedMessage,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error("[Firestore] Erro ao adicionar:", error.code);

      if (error.code === "permission-denied") {
        throw new Error("Permissão negada. Verifique as regras do Firestore.");
      } else if (error.code === "unavailable") {
        throw new Error("Serviço indisponível. Tente novamente.");
      } else if (error.code === "unauthenticated") {
        throw new Error("Não autenticado. Recarregue a página.");
      }

      throw error;
    }
  },

  async getMessages(limitCount = 50) {
    if (!this.isReady) {
      throw new Error("Firebase não está pronto");
    }

    const { collection, query, orderBy, limit, getDocs } =
      window.firebaseModules;

    try {
      const messagesRef = collection(this.db, "messages");
      const q = query(
        messagesRef,
        orderBy("createdAt", "desc"),
        limit(limitCount),
      );

      const querySnapshot = await getDocs(q);
      const messages = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        if (data.name && data.message && data.createdAt) {
          messages.push({
            id: doc.id,
            name: data.name,
            message: data.message,
            createdAt: data.createdAt?.toDate() || new Date(),
          });
        }
      });

      return messages;
    } catch (error) {
      console.error("[Firestore] Erro ao buscar:", error.message);
      return [];
    }
  },

  subscribeToMessages(callback, limitCount = 50) {
    if (!this.isReady) {
      console.error("[Listener] Firebase não está pronto");
      return () => {};
    }

    const { collection, query, orderBy, limit, onSnapshot } =
      window.firebaseModules;

    try {
      const messagesRef = collection(this.db, "messages");
      const q = query(
        messagesRef,
        orderBy("createdAt", "desc"),
        limit(limitCount),
      );

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const messages = [];

          querySnapshot.forEach((doc) => {
            const data = doc.data();

            if (data.name && data.message && data.createdAt) {
              messages.push({
                id: doc.id,
                name: data.name,
                message: data.message,
                createdAt: data.createdAt?.toDate() || new Date(),
              });
            }
          });

          callback(messages);
        },
        (error) => {
          console.error("[Listener] Erro:", error.code);
        },
      );

      return unsubscribe;
    } catch (error) {
      console.error("[Listener] Erro ao inscrever:", error.message);
      return () => {};
    }
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};

if (typeof window !== "undefined") {
  window.FirebaseService = FirebaseService;
}
