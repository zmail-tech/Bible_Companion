// Login and Register UI

import { login, register, logout } from "./auth.js";

export function showLoginScreen() {
  const modal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  modal.classList.add("active");
  loginForm.style.display = "block";
  registerForm.style.display = "none";
  document.getElementById("login-username").focus();
}

export function showRegisterScreen() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  loginForm.style.display = "none";
  registerForm.style.display = "block";
  document.getElementById("register-username").focus();
}

export function showLoginForm() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  registerForm.style.display = "none";
  loginForm.style.display = "block";
  document.getElementById("login-username").focus();
}

export function hideLoginScreen() {
  const modal = document.getElementById("login-modal");
  modal.classList.remove("active");
}

export function initLoginForm() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loginError = document.getElementById("login-error");
  const registerError = document.getElementById("register-error");
  const showRegisterBtn = document.getElementById("show-register");
  const showLoginBtn = document.getElementById("show-login");
  const logoutBtn = document.getElementById("logout-btn");

  showRegisterBtn.addEventListener("click", () => {
    showRegisterScreen();
    registerError.textContent = "";
    registerError.className = "status-message";
    document.getElementById("register-username").value = "";
    document.getElementById("register-password").value = "";
  });

  showLoginBtn.addEventListener("click", () => {
    showLoginForm();
    registerError.textContent = "";
    registerError.className = "status-message";
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    if (!username || !password) {
      loginError.textContent = "Please enter both username and password.";
      loginError.className = "status-message error";
      return;
    }

    loginError.textContent = "Signing in...";
    loginError.className = "status-message";

    try {
      const result = await login(username, password);
      if (result.success) {
        loginError.textContent = "";
        loginError.className = "status-message";
        hideLoginScreen();
        window.dispatchEvent(new CustomEvent("user-login", { detail: result }));
      } else {
        loginError.textContent = result.error;
        loginError.className = "status-message error";
        document.getElementById("login-password").value = "";
        document.getElementById("login-password").focus();
      }
    } catch (err) {
      console.error("Login failed:", err);
      loginError.textContent = "Login failed: " + (err.message || "unknown error");
      loginError.className = "status-message error";
      document.getElementById("login-password").value = "";
      document.getElementById("login-password").focus();
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value.trim();
    const password = document.getElementById("register-password").value;

    if (!username || !password) {
      registerError.textContent = "Please enter both username and password.";
      registerError.className = "status-message error";
      return;
    }

    if (password.length < 4) {
      registerError.textContent = "Password must be at least 4 characters.";
      registerError.className = "status-message error";
      return;
    }

    registerError.textContent = "Creating account...";
    registerError.className = "status-message";

    try {
      const result = await register(username, password);
      if (result.success) {
        registerError.textContent = "";
        registerError.className = "status-message";
        showLoginForm();
        document.getElementById("login-username").value = username;
        document.getElementById("login-password").focus();
      } else {
        registerError.textContent = result.error;
        registerError.className = "status-message error";
        document.getElementById("register-password").value = "";
        document.getElementById("register-password").focus();
      }
    } catch (err) {
      console.error("Registration failed:", err);
      registerError.textContent = "Registration failed: " + (err.message || "unknown error");
      registerError.className = "status-message error";
      document.getElementById("register-password").value = "";
      document.getElementById("register-password").focus();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
      showLoginScreen();
    });
  }
}
