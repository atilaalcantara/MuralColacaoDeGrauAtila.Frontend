/**
 * app.js
 * Orchestrates the Mural da Colação application.
 *
 * Floating messages are handled entirely by FloatingMessages (floating-messages.js).
 * This file handles: Firebase init, form/modal, toast, and wiring messages to the spawner.
 */

const CONFIG = {
  form: {
    cooldownMs: 8000,
    nameMaxLength: 40,
    messageMaxLength: 280,
  },
  firebase: {
    messagesLimit: 50,
    retryAttempts: 3,
    retryDelay: 2000,
  },
};

const App = {
  elements: {
    modalOverlay: null,
    modalCloseBtn: null,
    openModalBtn: null,
    messageForm: null,
    nameInput: null,
    messageInput: null,
    nameCounter: null,
    messageCounter: null,
    submitBtn: null,
    formError: null,
    toast: null,
    floatingLayer: null,
    ctaContent: null,
  },

  lastSubmitTime: 0,
  unsubscribeMessages: null,
  allMessages: [],
  isInitialized: false,

  async initialize() {
    if (this.isInitialized) return;

    this.getElements();
    this.setupEventListeners();

    var firebaseOk = await this.initializeFirebaseWithRetry();

    if (!firebaseOk) {
      console.error("[App] Falha ao inicializar Firebase");
      this.showError("Erro ao conectar. Recarregue a página.");
      return;
    }

    if (this.elements.floatingLayer) {
      FloatingMessages.init(this.elements.floatingLayer);
    }

    await this.loadMessages();
    this.subscribeToMessages();

    this.isInitialized = true;
  },

  async initializeFirebaseWithRetry() {
    for (var attempt = 1; attempt <= CONFIG.firebase.retryAttempts; attempt++) {
      try {
        var ok = await FirebaseService.initialize();
        if (ok) return true;
      } catch (error) {
        console.error("[Firebase] Tentativa " + attempt + " falhou:", error.message);
        if (attempt < CONFIG.firebase.retryAttempts) {
          await new Promise(function (r) {
            setTimeout(r, CONFIG.firebase.retryDelay);
          });
        }
      }
    }
    return false;
  },

  getElements() {
    this.elements.modalOverlay = document.getElementById("modal-overlay");
    this.elements.modalCloseBtn = document.getElementById("modal-close-btn");
    this.elements.openModalBtn = document.getElementById("open-modal-btn");
    this.elements.messageForm = document.getElementById("message-form");
    this.elements.nameInput = document.getElementById("name-input");
    this.elements.messageInput = document.getElementById("message-input");
    this.elements.nameCounter = document.getElementById("name-counter");
    this.elements.messageCounter = document.getElementById("message-counter");
    this.elements.submitBtn = document.getElementById("submit-btn");
    this.elements.formError = document.getElementById("form-error");
    this.elements.toast = document.getElementById("toast");
    this.elements.floatingLayer = document.getElementById("floating-layer");
    this.elements.ctaContent = document.querySelector(".cta-content");
  },

  setupEventListeners() {
    var self = this;

    this.elements.openModalBtn?.addEventListener("click", function () {
      self.openModal();
    });

    this.elements.modalCloseBtn?.addEventListener("click", function () {
      self.closeModal();
    });

    this.elements.modalOverlay?.addEventListener("click", function (e) {
      if (e.target === self.elements.modalOverlay) {
        self.closeModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (
        e.key === "Escape" &&
        self.elements.modalOverlay?.classList.contains("is-open")
      ) {
        self.closeModal();
      }
    });

    this.elements.nameInput?.addEventListener("input", function (e) {
      self.elements.nameCounter.textContent = e.target.value.length;
    });

    this.elements.messageInput?.addEventListener("input", function (e) {
      self.elements.messageCounter.textContent = e.target.value.length;
    });

    this.elements.messageForm?.addEventListener("submit", function (e) {
      e.preventDefault();
      self.handleSubmit();
    });
  },

  openModal() {
    this.elements.modalOverlay?.classList.add("is-open");
    this.elements.nameInput?.focus();
    this.clearForm();
    this.hideError();
  },

  closeModal() {
    this.elements.modalOverlay?.classList.remove("is-open");
    this.clearForm();
    this.hideError();
  },

  clearForm() {
    if (this.elements.messageForm) {
      this.elements.messageForm.reset();
      this.elements.nameCounter.textContent = "0";
      this.elements.messageCounter.textContent = "0";
    }
  },

  showError(message) {
    if (this.elements.formError) {
      this.elements.formError.textContent = message;
      this.elements.formError.classList.add("is-visible");
    }
  },

  hideError() {
    if (this.elements.formError) {
      this.elements.formError.textContent = "";
      this.elements.formError.classList.remove("is-visible");
    }
  },

  showToast(message) {
    if (this.elements.toast) {
      this.elements.toast.textContent = message || "Enviado \u2713";
      this.elements.toast.classList.add("is-visible");
      setTimeout(function () {
        var toast = document.getElementById("toast");
        if (toast) toast.classList.remove("is-visible");
      }, 1200);
    }
  },

  checkCooldown() {
    var now = Date.now();
    var elapsed = now - this.lastSubmitTime;

    if (elapsed < CONFIG.form.cooldownMs) {
      var remaining = Math.ceil((CONFIG.form.cooldownMs - elapsed) / 1000);
      return "Aguarde " + remaining + "s antes de enviar outra mensagem";
    }

    return null;
  },

  async handleSubmit() {
    this.hideError();

    var cooldownError = this.checkCooldown();
    if (cooldownError) {
      this.showError(cooldownError);
      return;
    }

    var name = this.elements.nameInput?.value.trim() || "";
    var message = this.elements.messageInput?.value.trim() || "";

    if (!name || name.length > CONFIG.form.nameMaxLength) {
      this.showError(
        "Nome deve ter entre 1 e " + CONFIG.form.nameMaxLength + " caracteres",
      );
      this.elements.nameInput?.focus();
      return;
    }

    if (!message || message.length > CONFIG.form.messageMaxLength) {
      this.showError(
        "Mensagem deve ter entre 1 e " +
          CONFIG.form.messageMaxLength +
          " caracteres",
      );
      this.elements.messageInput?.focus();
      return;
    }

    this.elements.submitBtn.disabled = true;
    this.elements.submitBtn.textContent = "Enviando...";

    try {
      if (!FirebaseService.isReady || !FirebaseService.user) {
        throw new Error(
          "Aguarde um momento, ainda estamos conectando ao servidor...",
        );
      }

      await FirebaseService.addMessage(name, message);

      this.lastSubmitTime = Date.now();
      this.closeModal();
      this.showToast("Enviado \u2713");
    } catch (error) {
      console.error("[Form] Erro:", error.message);
      this.showError(error?.message || "Erro ao enviar. Tente novamente.");
    } finally {
      this.elements.submitBtn.disabled = false;
      this.elements.submitBtn.textContent = "Enviar";
    }
  },

  async loadMessages() {
    try {
      var messages = await FirebaseService.getMessages(
        CONFIG.firebase.messagesLimit,
      );

      if (messages.length > 0) {
        this.allMessages = messages;
        FloatingMessages.setMessages(messages);
      }
    } catch (error) {
      console.error("[Messages] Erro ao carregar:", error.message);
    }
  },

  subscribeToMessages() {
    var self = this;

    this.unsubscribeMessages = FirebaseService.subscribeToMessages(function (
      messages,
    ) {
      self.allMessages = messages;
      FloatingMessages.setMessages(messages);
    }, CONFIG.firebase.messagesLimit);
  },

  destroy() {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
    }

    FloatingMessages.destroy();
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    App.initialize();
  });
} else {
  App.initialize();
}

if (typeof window !== "undefined") {
  window.App = App;
  window.CONFIG = CONFIG;
}
