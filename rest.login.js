// =====================================================
// BMP REST · Restaurant Login
// =====================================================

const REST_API_URL =
    "https://script.google.com/macros/s/AKfycbzTivPDnfsW6V0mwiXAlz7zj26LSZIU3P0VQEzjFlXsZxEZrAbWyxQ1XUpmS_5Q7VYq2w/exec";

const DEFAULT_LANG = "ar";
const LANG_KEY     = "bmpLanguage";


// =====================================================
// Translations
// =====================================================

const T = {

    ar: {
        login:              "تسجيل الدخول",
        signingIn:          "جارٍ تسجيل الدخول...",
        enterCredentials:   "يرجى إدخال اسم المستخدم وكلمة المرور.",
        serverError:        "حدث خطأ في الخادم.",
        loginFailed:        "فشل تسجيل الدخول.",
        invalidResponse:    "استجابة غير صالحة من الخادم.",
        unableToConnect:    "تعذر الاتصال بالخادم.",
        notRestaurant:      "هذا الحساب ليس حساب مطعم.",
        accountNotActive:   "هذا الحساب غير مفعّل."
    },

    fr: {
        login:              "Connexion",
        signingIn:          "Connexion en cours...",
        enterCredentials:   "Veuillez saisir le nom d'utilisateur et le mot de passe.",
        serverError:        "Le serveur a renvoyé une erreur.",
        loginFailed:        "Échec de la connexion.",
        invalidResponse:    "Réponse du serveur invalide.",
        unableToConnect:    "Impossible de se connecter au serveur.",
        notRestaurant:      "Ce compte n'est pas un compte restaurant.",
        accountNotActive:   "Ce compte n'est pas actif."
    },

    en: {
        login:              "Login",
        signingIn:          "Signing in...",
        enterCredentials:   "Please enter username and password.",
        serverError:        "Server returned an error.",
        loginFailed:        "Login failed.",
        invalidResponse:    "Invalid server response.",
        unableToConnect:    "Unable to connect to server.",
        notRestaurant:      "This account is not a restaurant account.",
        accountNotActive:   "This account is not active."
    }

};


// =====================================================
// State
// =====================================================

let currentLang = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;


// =====================================================
// Elements
// =====================================================

const loginForm      = document.getElementById("loginForm");
const usernameInput  = document.getElementById("username");
const passwordInput  = document.getElementById("password");
const loginButton    = document.getElementById("loginButton");
const errorMessage   = document.getElementById("errorMessage");
const togglePassword = document.getElementById("togglePassword");
const langButtons    = document.querySelectorAll(".lang-btn");


// =====================================================
// Apply Language
// =====================================================

function applyLanguage(lang) {

    if (!T[lang]) lang = DEFAULT_LANG;

    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);

    document.documentElement.lang = lang;
    document.documentElement.dir  = (lang === "ar") ? "rtl" : "ltr";

    document.body.classList.remove("lang-ar", "lang-fr", "lang-en");
    document.body.classList.add("lang-" + lang);

    document.querySelectorAll("[data-ar]").forEach(function (el) {
        const v = el.dataset[lang];
        if (v !== undefined) el.textContent = v;
    });

    document.querySelectorAll("[data-ar-placeholder]").forEach(function (el) {
        const v = el.dataset[lang + "Placeholder"];
        if (v !== undefined) el.placeholder = v;
    });

    langButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    const label = loginButton && loginButton.querySelector(".btn-label");
    if (label && !loginButton.classList.contains("loading")) {
        label.textContent = T[lang].login;
    }

}


// =====================================================
// Language Switcher
// =====================================================

langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
        applyLanguage(btn.dataset.lang);
    });
});


// =====================================================
// Show / Hide Password
// =====================================================

if (togglePassword) {

    togglePassword.addEventListener("click", function () {

        const isPassword = passwordInput.type === "password";

        passwordInput.type = isPassword ? "text" : "password";

        const icon = togglePassword.querySelector("i");
        if (icon) {
            icon.classList.toggle("fa-eye",       !isPassword);
            icon.classList.toggle("fa-eye-slash",  isPassword);
        }

    });

}


// =====================================================
// Already Logged In?
// =====================================================

try {

    const saved = localStorage.getItem("bmpRestaurantUser");

    if (saved) {

        const user = JSON.parse(saved);

        const role = String(user.role || "").trim().toLowerCase();

        const valid =
            user.institutionId &&
            user.username &&
            (role === "director" || role === "user") &&
            String(user.status || "").toLowerCase() === "active";

        if (valid) {
            window.location.href =
                "rest.html?id=" + encodeURIComponent(user.institutionId);
        } else {
            localStorage.removeItem("bmpRestaurantUser");
        }

    }

} catch (error) {
    localStorage.removeItem("bmpRestaurantUser");
}


// =====================================================
// Submit
// =====================================================

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    errorMessage.textContent = "";

    if (!username || !password) {
        errorMessage.textContent = T[currentLang].enterCredentials;
        return;
    }

    loginButton.disabled = true;
    loginButton.classList.add("loading");

    const label = loginButton.querySelector(".btn-label");
    if (label) label.textContent = T[currentLang].signingIn;

    try {

        const response = await fetch(REST_API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action:   "restLogin",
                username: username,
                password: password
            })
        });

        if (!response.ok) {
            throw new Error(T[currentLang].serverError);
        }

        const result = await response.json();

        if (!result || !result.success) {

            const message =
                (result && result.message)
                    ? result.message
                    : T[currentLang].loginFailed;

            errorMessage.textContent = message;

            loginButton.disabled = false;
            loginButton.classList.remove("loading");
            if (label) label.textContent = T[currentLang].login;
            return;

        }

        if (
            !result.user ||
            !result.user.institutionId ||
            !result.user.username
        ) {
            throw new Error(T[currentLang].invalidResponse);
        }

        if (
            String(result.user.institutionType || "").toLowerCase() !==
            "restaurant"
        ) {
            errorMessage.textContent = T[currentLang].notRestaurant;

            loginButton.disabled = false;
            loginButton.classList.remove("loading");
            if (label) label.textContent = T[currentLang].login;
            return;
        }

        const role   = String(result.user.role   || "").trim();
        const status = String(result.user.status || "active").trim().toLowerCase();

        if (status !== "active") {
            errorMessage.textContent = T[currentLang].accountNotActive;

            loginButton.disabled = false;
            loginButton.classList.remove("loading");
            if (label) label.textContent = T[currentLang].login;
            return;
        }

        const authenticated = Object.assign({}, result.user, {
            role:   role,
            status: status
        });

        localStorage.setItem(
            "bmpRestaurantUser",
            JSON.stringify(authenticated)
        );

        window.location.href =
            "rest.html?id=" + encodeURIComponent(authenticated.institutionId);

    } catch (error) {

        console.error("Restaurant login error:", error);

        errorMessage.textContent =
            (error.message && error.message !== "Failed to fetch")
                ? error.message
                : T[currentLang].unableToConnect;

        loginButton.disabled = false;
        loginButton.classList.remove("loading");
        if (label) label.textContent = T[currentLang].login;

    }

});


// =====================================================
// Init
// =====================================================

applyLanguage(currentLang);
