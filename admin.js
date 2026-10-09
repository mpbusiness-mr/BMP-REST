// =====================================================
// BMP REST · Admin Dashboard
// =====================================================

const REST_API_URL =
    "https://script.google.com/macros/s/AKfycbzTivPDnfsW6V0mwiXAlz7zj26LSZIU3P0VQEzjFlXsZxEZrAbWyxQ1XUpmS_5Q7VYq2w/exec";

const LANG_KEY = "bmpLanguage";


// =====================================================
// Require Admin Login
// =====================================================

const currentAdmin = requireAdminLogin();

if (!currentAdmin) {
    throw new Error("Admin login required.");
}


// =====================================================
// Translations
// =====================================================

const T = {

    ar: {
        loading:        "جارٍ التحميل...",
        loadError:      "تعذر تحميل البيانات.",
        noRestaurants:  "لا توجد مطاعم بعد.",
        active:         "نشطة",
        disabled:       "معطلة",
        expired:        "منتهية",
        view:           "عرض",
        disable:        "تعطيل",
        enable:         "تفعيل",
        confirmDisable: "هل تريد تعطيل هذا المطعم؟",
        confirmEnable:  "هل تريد تفعيل هذا المطعم؟",
        statusUpdated:  "تم تحديث الحالة.",
        creating:       "جارٍ الإنشاء...",
        created:        "تم إنشاء المطعم بنجاح.",
        createError:    "تعذر إنشاء المطعم.",
        requiredFields: "يرجى تعبئة جميع الحقول المطلوبة.",
        noLogs:         "لا توجد عمليات.",
        selectRest:     "اختر المطعم"
    },

    fr: {
        loading:        "Chargement...",
        loadError:      "Impossible de charger les données.",
        noRestaurants:  "Aucun restaurant pour le moment.",
        active:         "Actif",
        disabled:       "Désactivé",
        expired:        "Expiré",
        view:           "Voir",
        disable:        "Désactiver",
        enable:         "Activer",
        confirmDisable: "Désactiver ce restaurant ?",
        confirmEnable:  "Activer ce restaurant ?",
        statusUpdated:  "Statut mis à jour.",
        creating:       "Création...",
        created:        "Restaurant créé avec succès.",
        createError:    "Impossible de créer le restaurant.",
        requiredFields: "Veuillez remplir tous les champs requis.",
        noLogs:         "Aucune activité.",
        selectRest:     "Choisir un restaurant"
    },

    en: {
        loading:        "Loading...",
        loadError:      "Failed to load data.",
        noRestaurants:  "No restaurants yet.",
        active:         "Active",
        disabled:       "Disabled",
        expired:        "Expired",
        view:           "View",
        disable:        "Disable",
        enable:         "Enable",
        confirmDisable: "Disable this restaurant?",
        confirmEnable:  "Enable this restaurant?",
        statusUpdated:  "Status updated.",
        creating:       "Creating...",
        created:        "Restaurant created successfully.",
        createError:    "Failed to create restaurant.",
        requiredFields: "Please fill all required fields.",
        noLogs:         "No activity yet.",
        selectRest:     "Choose a restaurant"
    }

};

let currentLang = localStorage.getItem(LANG_KEY) || "ar";
if (!T[currentLang]) currentLang = "ar";


// =====================================================
// Elements
// =====================================================

const pageLoader        = document.getElementById("pageLoader");
const adminName         = document.getElementById("adminName");
const totalRestaurants  = document.getElementById("totalRestaurants");
const activeRestaurants = document.getElementById("activeRestaurants");

const institutionsModal     = document.getElementById("institutionsModal");
const institutionsTableWrap = document.getElementById("institutionsTableWrap");
const institutionsTableBody = document.getElementById("institutionsTableBody");
const institutionsEmpty     = document.getElementById("institutionsEmpty");
const institutionsLoading   = document.getElementById("institutionsLoading");

const createModal     = document.getElementById("createModal");
const createForm      = document.getElementById("createForm");
const createError     = document.getElementById("createError");
const createSubmitBtn = document.getElementById("createSubmitBtn");

const logsModal       = document.getElementById("logsModal");
const logInstitution  = document.getElementById("logInstitution");
const logsTableWrap   = document.getElementById("logsTableWrap");
const logsTableBody   = document.getElementById("logsTableBody");
const logsEmpty       = document.getElementById("logsEmpty");
const logsLoading     = document.getElementById("logsLoading");

const langButtons = document.querySelectorAll(".lang-btn");


// =====================================================
// Apply language
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

    langButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.lang === lang);
    });

}

langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
        applyLanguage(btn.dataset.lang);
    });
});


// =====================================================
// Modal helpers
// =====================================================

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("open");
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("open");
}

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
// API helper
// =====================================================

async function api(action, payload) {

    const body = Object.assign({ action: action }, payload || {});

    const res = await fetch(REST_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
    });

    return await res.json();

}


// =====================================================
// Summary init
// =====================================================

adminName.textContent = currentAdmin.username || currentAdmin.id || "-";


// =====================================================
// Load institutions
// =====================================================

let cachedInstitutions = [];

async function loadInstitutions() {

    institutionsLoading.style.display = "flex";
    institutionsTableWrap.style.display = "none";
    institutionsEmpty.style.display = "none";

    try {

        const result = await api("getInstitutions");

        if (!result.success) {
            throw new Error(result.message || T[currentLang].loadError);
        }

        cachedInstitutions = Array.isArray(result.institutions)
            ? result.institutions.filter(function (i) {
                return String(i.type || "").toLowerCase() === "restaurant";
            })
            : [];

        // Summary
        totalRestaurants.textContent = cachedInstitutions.length;

        activeRestaurants.textContent = cachedInstitutions.filter(function (i) {
            return String(i.status || "").toLowerCase() === "active";
        }).length;

        renderInstitutions();

    } catch (error) {

        institutionsLoading.style.display = "none";
        institutionsEmpty.style.display = "flex";
        institutionsEmpty.querySelector("p").textContent =
            error.message || T[currentLang].loadError;

    }

}


function translateStatus(status) {

    const s = String(status || "").toLowerCase();

    if (s === "active")   return T[currentLang].active;
    if (s === "disabled") return T[currentLang].disabled;
    if (s === "expired")  return T[currentLang].expired;

    return status;

}


function isExpired(institution) {

    if (!institution.licenseEnd) return false;

    const end = new Date(institution.licenseEnd);
    if (isNaN(end.getTime())) return false;

    return new Date() > end;

}


function renderInstitutions() {

    institutionsLoading.style.display = "none";
    institutionsTableBody.innerHTML = "";

    if (!cachedInstitutions.length) {
        institutionsEmpty.style.display = "flex";
        return;
    }

    institutionsTableWrap.style.display = "block";

    cachedInstitutions.forEach(function (inst) {

        const status = isExpired(inst)
            ? "expired"
            : String(inst.status || "").toLowerCase();

        const statusClass =
            status === "active"   ? "status-active"
          : status === "disabled" ? "status-disabled"
          : "status-expired";

        const row = document.createElement("tr");

        row.innerHTML =
            "<td>" + escapeHtml(inst.id) + "</td>" +
            "<td>" + escapeHtml(inst.name) + "</td>" +
            "<td>" + escapeHtml(inst.phone || "-") + "</td>" +
            '<td><span class="status-pill ' + statusClass + '">' +
                escapeHtml(translateStatus(status)) + "</span></td>" +
            "<td>" + escapeHtml(formatDate(inst.licenseStart)) + " → " + escapeHtml(formatDate(inst.licenseEnd)) + "</td>" +
            '<td><div class="row-actions">' +
                '<button class="row-btn" data-toggle-id="' + escapeHtml(inst.id) + '">' +
                    '<i class="fas fa-power-off"></i> ' +
                    (String(inst.status || "").toLowerCase() === "active"
                        ? T[currentLang].disable
                        : T[currentLang].enable) +
                "</button>" +
            "</div></td>";

        institutionsTableBody.appendChild(row);

    });

    document.querySelectorAll("[data-toggle-id]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            toggleInstitution(btn.dataset.toggleId);
        });
    });

}


function escapeHtml(value) {

    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function formatDate(value) {

    if (!value) return "-";

    const str = String(value).trim();

    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];

    const d = new Date(str);
    if (isNaN(d.getTime())) return str;

    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");

}


async function toggleInstitution(institutionId) {

    const inst = cachedInstitutions.find(function (i) { return i.id === institutionId; });
    if (!inst) return;

    const currentlyActive = String(inst.status || "").toLowerCase() === "active";
    const newStatus = currentlyActive ? "disabled" : "active";

    const confirmMsg = currentlyActive
        ? T[currentLang].confirmDisable
        : T[currentLang].confirmEnable;

    if (!window.confirm(confirmMsg)) return;

    try {

        const result = await api("updateInstitutionStatus", {
            institutionId: institutionId,
            status:        newStatus
        });

        if (!result.success) {
            throw new Error(result.message);
        }

        inst.status = newStatus;
        renderInstitutions();

    } catch (error) {

        alert(error.message || T[currentLang].loadError);

    }

}


// =====================================================
// Create institution
// =====================================================

createForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    createError.textContent = "";

    const name         = document.getElementById("cName").value.trim();
    const phone        = document.getElementById("cPhone").value.trim();
    const email        = document.getElementById("cEmail").value.trim();
    const licenseStart = document.getElementById("cLicenseStart").value;
    const licenseEnd   = document.getElementById("cLicenseEnd").value;
    const username     = document.getElementById("cUsername").value.trim();
    const password     = document.getElementById("cPassword").value;

    if (!name || !licenseStart || !licenseEnd || !username || !password) {
        createError.textContent = T[currentLang].requiredFields;
        return;
    }

    createSubmitBtn.disabled = true;
    createSubmitBtn.classList.add("loading");

    const label = createSubmitBtn.querySelector(".btn-label");
    if (label) label.textContent = T[currentLang].creating;

    try {

        const result = await api("createInstitution", {
            type:         "restaurant",
            name:         name,
            phone:        phone,
            email:        email,
            licenseStart: licenseStart,
            licenseEnd:   licenseEnd,
            username:     username,
            password:     password
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].createError);
        }

        createForm.reset();
        closeModal("createModal");
        await loadInstitutions();
        alert(T[currentLang].created);

    } catch (error) {

        createError.textContent =
            error.message || T[currentLang].createError;

    } finally {

        createSubmitBtn.disabled = false;
        createSubmitBtn.classList.remove("loading");
        if (label) label.textContent =
            currentLang === "ar" ? "إنشاء"
          : currentLang === "fr" ? "Créer"
          : "Create";

    }

});


// =====================================================
// Activity logs
// =====================================================

async function loadLogsFor(institutionId) {

    logsLoading.style.display = "flex";
    logsTableWrap.style.display = "none";
    logsEmpty.style.display = "none";

    try {

        const result = await api("getActivityLogs", {
            institutionId: institutionId
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].loadError);
        }

        const logs = Array.isArray(result.logs) ? result.logs : [];

        logsLoading.style.display = "none";
        logsTableBody.innerHTML = "";

        if (!logs.length) {
            logsEmpty.style.display = "flex";
            return;
        }

        logsTableWrap.style.display = "block";

        logs.slice().reverse().forEach(function (log) {

            const row = document.createElement("tr");

            row.innerHTML =
                "<td>" + escapeHtml(log.username || "-") + "</td>" +
                "<td>" + escapeHtml(log.role     || "-") + "</td>" +
                "<td>" + escapeHtml(log.action   || "-") + "</td>" +
                "<td>" + escapeHtml(log.details  || "-") + "</td>" +
                "<td>" + escapeHtml(formatDateTime(log.date)) + "</td>";

            logsTableBody.appendChild(row);

        });

    } catch (error) {

        logsLoading.style.display = "none";
        logsEmpty.style.display = "flex";
        logsEmpty.querySelector("p").textContent =
            error.message || T[currentLang].loadError;

    }

}


function formatDateTime(value) {

    if (!value) return "-";

    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);

    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0") + " " +
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0");

}


// =====================================================
// Button handlers
// =====================================================

document.getElementById("institutionsButton").addEventListener("click", async function () {
    openModal("institutionsModal");
    await loadInstitutions();
});

document.getElementById("createButton").addEventListener("click", function () {
    createError.textContent = "";
    openModal("createModal");
});

document.getElementById("logsButton").addEventListener("click", async function () {

    openModal("logsModal");

    if (!cachedInstitutions.length) {
        await loadInstitutions();
    }

    logInstitution.innerHTML = '<option value="">' + T[currentLang].selectRest + "</option>";

    cachedInstitutions.forEach(function (inst) {
        const opt = document.createElement("option");
        opt.value = inst.id;
        opt.textContent = inst.name + " (" + inst.id + ")";
        logInstitution.appendChild(opt);
    });

    logsTableWrap.style.display = "none";
    logsEmpty.style.display = "none";

});

logInstitution.addEventListener("change", function () {

    const id = logInstitution.value;

    if (!id) {
        logsTableWrap.style.display = "none";
        logsEmpty.style.display = "none";
        return;
    }

    loadLogsFor(id);

});

document.getElementById("logoutButton").addEventListener("click", function () {
    logoutAdmin();
});

document.getElementById("backButton").addEventListener("click", function () {
    window.history.back();
});


// =====================================================
// Init
// =====================================================

applyLanguage(currentLang);

// Hide loader
requestAnimationFrame(function () {
    setTimeout(function () {
        if (pageLoader) pageLoader.classList.add("hidden");
    }, 250);
});

// Preload summary
loadInstitutions();
