// =====================================================
// BMP REST · Settings
// =====================================================

const REST_API_URL =
    "https://script.google.com/macros/s/AKfycbzTivPDnfsW6V0mwiXAlz7zj26LSZIU3P0VQEzjFlXsZxEZrAbWyxQ1XUpmS_5Q7VYq2w/exec";

const LANG_KEY = "bmpLanguage";


// =====================================================
// Require Login
// =====================================================

const currentUser = requireRestaurantLogin();
if (!currentUser) throw new Error("Restaurant login required.");

const ACTIVE_ID = getActiveRestaurantId();
if (!ACTIVE_ID) throw new Error("Invalid restaurant.");

const IS_DIRECTOR = isRestaurantDirector();


// =====================================================
// State
// =====================================================

let currentLang = localStorage.getItem(LANG_KEY) || "ar";
let usersCache = [];


// =====================================================
// Translations
// =====================================================

const T = {

    ar: {
        save:           "حفظ",
        error:          "حدث خطأ.",
        savedInfo:      "تم حفظ المعلومات.",
        savedPass:      "تم تغيير كلمة المرور.",
        savedUser:      "تم إنشاء المستخدم.",
        enabledUser:    "تم تفعيل المستخدم.",
        disabledUser:   "تم تعطيل المستخدم.",
        director:       "مدير",
        user:           "مستخدم",
        active:         "نشط",
        disabled:       "معطّل",
        enable:         "تفعيل",
        disable:        "تعطيل",
        passMismatch:   "كلمتا المرور غير متطابقتين.",
        passShort:      "كلمة المرور قصيرة جداً.",
        fieldsRequired: "يرجى تعبئة جميع الحقول المطلوبة.",
        confirmEnable:  "هل تريد تفعيل هذا المستخدم؟",
        confirmDisable: "هل تريد تعطيل هذا المستخدم؟"
    },

    fr: {
        save:           "Enregistrer",
        error:          "Une erreur est survenue.",
        savedInfo:      "Informations enregistrées.",
        savedPass:      "Mot de passe modifié.",
        savedUser:      "Utilisateur créé.",
        enabledUser:    "Utilisateur activé.",
        disabledUser:   "Utilisateur désactivé.",
        director:       "Directeur",
        user:           "Utilisateur",
        active:         "Actif",
        disabled:       "Désactivé",
        enable:         "Activer",
        disable:        "Désactiver",
        passMismatch:   "Les mots de passe ne correspondent pas.",
        passShort:      "Mot de passe trop court.",
        fieldsRequired: "Veuillez remplir tous les champs requis.",
        confirmEnable:  "Activer cet utilisateur ?",
        confirmDisable: "Désactiver cet utilisateur ?"
    },

    en: {
        save:           "Save",
        error:          "An error occurred.",
        savedInfo:      "Information saved.",
        savedPass:      "Password changed.",
        savedUser:      "User created.",
        enabledUser:    "User enabled.",
        disabledUser:   "User disabled.",
        director:       "Director",
        user:           "User",
        active:         "Active",
        disabled:       "Disabled",
        enable:         "Enable",
        disable:        "Disable",
        passMismatch:   "Passwords do not match.",
        passShort:      "Password is too short.",
        fieldsRequired: "Please fill all required fields.",
        confirmEnable:  "Enable this user?",
        confirmDisable: "Disable this user?"
    }

};


// =====================================================
// Helpers
// =====================================================

const $ = function (id) { return document.getElementById(id); };

function escapeHtml(v) {
    return String(v == null ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openModal(id)  { const el = $(id); if (el) el.classList.add("open"); }
function closeModal(id) { const el = $(id); if (el) el.classList.remove("open"); }


// =====================================================
// Apply Language
// =====================================================

function applyLanguage(lang) {

    if (!T[lang]) lang = "ar";
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

    document.querySelectorAll(".lang-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.lang === lang);
    });

}


// =====================================================
// API
// =====================================================

async function api(action, payload) {

    const body = Object.assign({
        action:        action,
        institutionId: ACTIVE_ID,
        username:      currentUser.username
    }, payload || {});

    const res = await fetch(REST_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
    });

    return await res.json();

}


// =====================================================
// SECTION 1 — Restaurant Info
// =====================================================

async function loadSettings() {

    try {

        const result = await api("restGetSettings");

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        const s = result.settings;

        $("rName").value     = s.name || "";
        $("rPhone").value    = s.phone || "";
        $("rEmail").value    = s.email || "";
        $("rCurrency").value = s.currency || "MRU";

        if (!IS_DIRECTOR) {
            $("rName").disabled     = true;
            $("rPhone").disabled    = true;
            $("rEmail").disabled    = true;
            $("rCurrency").disabled = true;
            $("saveInfoBtn").style.display = "none";
        }

    } catch (e) {
        console.error(e);
    }

}

$("saveInfoBtn").addEventListener("click", async function () {

    const err = $("infoError");
    err.textContent = "";

    const name     = $("rName").value.trim();
    const phone    = $("rPhone").value.trim();
    const email    = $("rEmail").value.trim();
    const currency = $("rCurrency").value;

    if (!name || !currency) {
        err.textContent = T[currentLang].fieldsRequired;
        return;
    }

    const btn = $("saveInfoBtn");
    btn.disabled = true;
    btn.classList.add("loading");

    try {

        const result = await api("restUpdateSettings", {
            name:     name,
            phone:    phone,
            email:    email,
            currency: currency
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        alert(T[currentLang].savedInfo);

    } catch (error) {

        err.textContent = error.message || T[currentLang].error;

    } finally {

        btn.disabled = false;
        btn.classList.remove("loading");

    }

});


// =====================================================
// SECTION 2 — Change own password
// =====================================================

$("savePassBtn").addEventListener("click", async function () {

    const err = $("passError");
    err.textContent = "";

    const curPass = $("curPass").value;
    const newPass = $("newPass").value;
    const conf    = $("confirmPass").value;

    if (!curPass || !newPass || !conf) {
        err.textContent = T[currentLang].fieldsRequired;
        return;
    }

    if (newPass !== conf) {
        err.textContent = T[currentLang].passMismatch;
        return;
    }

    if (newPass.length < 4) {
        err.textContent = T[currentLang].passShort;
        return;
    }

    const btn = $("savePassBtn");
    btn.disabled = true;
    btn.classList.add("loading");

    try {

        const result = await api("restChangePassword", {
            currentPassword: curPass,
            newPassword:     newPass
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        $("curPass").value = "";
        $("newPass").value = "";
        $("confirmPass").value = "";

        alert(T[currentLang].savedPass);

    } catch (error) {

        err.textContent = error.message || T[currentLang].error;

    } finally {

        btn.disabled = false;
        btn.classList.remove("loading");

    }

});


// =====================================================
// SECTION 3 — Users (Director only)
// =====================================================

async function loadUsers() {

    if (!IS_DIRECTOR) return;

    try {

        const result = await api("restGetUsers");
        usersCache = Array.isArray(result.users) ? result.users : [];
        renderUsers();

    } catch (e) {
        console.error(e);
    }

}

function renderUsers() {

    const tbody = $("usersTableBody");
    const empty = $("usersEmpty");

    tbody.innerHTML = "";

    if (!usersCache.length) {
        empty.style.display = "flex";
        return;
    }

    empty.style.display = "none";

    usersCache.forEach(function (u) {

        const roleKey = String(u.role || "").toLowerCase() === "director"
            ? "director" : "user";

        const roleText = T[currentLang][roleKey];

        const statusKey = String(u.status || "").toLowerCase() === "active"
            ? "active" : "disabled";

        const statusText = T[currentLang][statusKey];

        const statusCls = statusKey === "active" ? "status-active" : "status-disabled";

        const isDirector = roleKey === "director";

        const row = document.createElement("tr");
        row.innerHTML =
            "<td>" + escapeHtml(u.username) + "</td>" +
            "<td>" + escapeHtml(roleText) + "</td>" +
            '<td><span class="status-pill ' + statusCls + '">' + escapeHtml(statusText) + "</span></td>" +
            '<td><div class="row-actions">' +
                (isDirector
                    ? '<span style="color:var(--text-muted);font-size:0.8rem;">—</span>'
                    : (statusKey === "active"
                        ? '<button class="row-btn danger" data-disable="' + escapeHtml(u.username) + '">' +
                            '<i class="fas fa-ban"></i> ' + T[currentLang].disable +
                          "</button>"
                        : '<button class="row-btn" data-enable="' + escapeHtml(u.username) + '">' +
                            '<i class="fas fa-check"></i> ' + T[currentLang].enable +
                          "</button>"
                      )
                ) +
            "</div></td>";

        tbody.appendChild(row);

    });

    document.querySelectorAll("[data-disable]").forEach(function (b) {
        b.addEventListener("click", function () {
            disableUser(b.dataset.disable);
        });
    });

    document.querySelectorAll("[data-enable]").forEach(function (b) {
        b.addEventListener("click", function () {
            enableUser(b.dataset.enable);
        });
    });

}


// Add user
$("addUserBtn").addEventListener("click", function () {
    $("addUserError").textContent = "";
    $("addUserForm").reset();
    openModal("addUserModal");
});

$("addUserForm").addEventListener("submit", async function (e) {

    e.preventDefault();

    const err = $("addUserError");
    err.textContent = "";

    const newUsername = $("nuUsername").value.trim();
    const password    = $("nuPassword").value;

    if (!newUsername || !password) {
        err.textContent = T[currentLang].fieldsRequired;
        return;
    }

    const btn = $("saveUserBtn");
    btn.disabled = true;
    btn.classList.add("loading");

    try {

        const result = await api("restAddUser", {
            newUsername: newUsername,
            password:    password
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        closeModal("addUserModal");
        await loadUsers();
        alert(T[currentLang].savedUser);

    } catch (error) {

        err.textContent = error.message || T[currentLang].error;

    } finally {

        btn.disabled = false;
        btn.classList.remove("loading");

    }

});


// Enable user
async function enableUser(username) {

    if (!window.confirm(T[currentLang].confirmEnable)) return;

    try {

        const result = await api("restEnableUser", {
            targetUsername: username
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        await loadUsers();
        alert(T[currentLang].enabledUser);

    } catch (error) {

        alert(error.message || T[currentLang].error);

    }

}


// Disable user
async function disableUser(username) {

    if (!window.confirm(T[currentLang].confirmDisable)) return;

    try {

        const result = await api("restDisableUser", {
            targetUsername: username
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        await loadUsers();
        alert(T[currentLang].disabledUser);

    } catch (error) {

        alert(error.message || T[currentLang].error);

    }

}


// =====================================================
// Modal close
// =====================================================

document.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", function () {
        closeModal(el.dataset.close);
    });
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        document.querySelectorAll(".modal.open").forEach(function (m) {
            m.classList.remove("open");
        });
    }
});


// =====================================================
// Language switcher
// =====================================================

document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        applyLanguage(btn.dataset.lang);
        renderUsers();
    });
});


// =====================================================
// Back button
// =====================================================

$("backBtn").addEventListener("click", function () {
    window.location.href =
        "rest.html?id=" + encodeURIComponent(ACTIVE_ID);
});


// =====================================================
// Init
// =====================================================

applyLanguage(currentLang);

if (IS_DIRECTOR) {
    $("usersSection").style.display = "block";
    loadUsers();
}

loadSettings();

requestAnimationFrame(function () {
    setTimeout(function () {
        if (pageLoader) pageLoader.classList.add("hidden");
    }, 250);
});
