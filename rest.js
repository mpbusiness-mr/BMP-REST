// =====================================================
// BMP REST · Dashboard
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

let allOrders = [];
let allDebts  = [];
let pendingPaymentDebtId = null;

let currentLang = localStorage.getItem(LANG_KEY) || "ar";


// =====================================================
// Currency label
// =====================================================

const CURRENCY_LABEL = "MRU";


// =====================================================
// Translations
// =====================================================

const T = {

    ar: {
        active: "نشطة", disabled: "معطلة", expired: "منتهية",
        unpaid: "غير مدفوع", partial: "جزئي", settled: "مسدّد",
        all: "الكل",
        pay: "دفعة", settle: "تسديد", delete: "حذف",
        confirmSettle: "هل تريد تسديد هذا الدين بالكامل؟",
        confirmDelete: "هل تريد حذف هذا الدين نهائياً؟",
        noData: "لا توجد بيانات.",
        save: "حفظ",
        cancel: "إلغاء",
        error: "حدث خطأ.",
        saving: "جارٍ الحفظ...",
        phoneError: "رقم الهاتف يجب أن يكون 8 أرقام."
    },

    fr: {
        active: "Actif", disabled: "Désactivé", expired: "Expiré",
        unpaid: "Impayé", partial: "Partiel", settled: "Réglé",
        all: "Tout",
        pay: "Paiement", settle: "Régler", delete: "Supprimer",
        confirmSettle: "Régler cette dette en entier ?",
        confirmDelete: "Supprimer cette dette ?",
        noData: "Aucune donnée.",
        save: "Enregistrer",
        cancel: "Annuler",
        error: "Une erreur est survenue.",
        saving: "Enregistrement...",
        phoneError: "Le téléphone doit contenir 8 chiffres."
    },

    en: {
        active: "Active", disabled: "Disabled", expired: "Expired",
        unpaid: "Unpaid", partial: "Partial", settled: "Settled",
        all: "All",
        pay: "Pay", settle: "Settle", delete: "Delete",
        confirmSettle: "Settle this debt in full?",
        confirmDelete: "Delete this debt permanently?",
        noData: "No data.",
        save: "Save",
        cancel: "Cancel",
        error: "An error occurred.",
        saving: "Saving...",
        phoneError: "Phone must be 8 digits."
    }

};


// =====================================================
// Elements
// =====================================================

const $ = function (id) { return document.getElementById(id); };

const pageLoader = $("pageLoader");
const langButtons = document.querySelectorAll(".lang-btn");


// =====================================================
// Helpers
// =====================================================

function escapeHtml(v) {
    return String(v == null ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function fmtDate(v) {
    if (!v) return "-";
    const s = String(v).trim();
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

function fmtTime(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "-";
    return String(d.getHours()).padStart(2, "0") + ":" +
           String(d.getMinutes()).padStart(2, "0");
}

function fmtMoney(v) {
    const n = Number(v || 0);
    return n.toFixed(2) + " " + CURRENCY_LABEL;
}

function monthKey(dateStr) {
    return String(dateStr || "").slice(0, 7);
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

    langButtons.forEach(function (b) {
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
// Summary display
// =====================================================

$("restaurantName").textContent = currentUser.institutionName || "-";
$("restaurantId").textContent   = ACTIVE_ID;

function statusFromLicense() {
    if (!currentUser.licenseEnd) return "active";
    const d = new Date(currentUser.licenseEnd);
    if (isNaN(d.getTime())) return "active";
    return new Date() > d ? "expired" : "active";
}

$("restaurantStatus").textContent =
    T[currentLang][statusFromLicense()] || "active";


// =====================================================
// Summary tiles
// =====================================================

async function loadSummary() {

    try {

        const result = await api("restGetSummary");
        if (!result.success) return;

        const s = result.summary;

        $("tileTodayOrders").textContent = s.todayOrders;
        $("tileTodayIncome").textContent = fmtMoney(s.todayIncome);
        $("tileMonthOrders").textContent = s.monthOrders;
        $("tileMonthIncome").textContent = fmtMoney(s.monthIncome);
        $("tileOutstanding").textContent = fmtMoney(s.outstanding);

    } catch (e) {
        console.error(e);
    }

}


// =====================================================
// Orders
// =====================================================

async function loadOrders() {

    try {

        const result = await api("restGetOrders");
        allOrders = Array.isArray(result.orders) ? result.orders : [];

        populateOrderFilters();
        renderOrders();

    } catch (e) {
        console.error(e);
    }

}

function populateOrderFilters() {

    const monthSel  = $("ordersMonthFilter");
    const methodSel = $("ordersMethodFilter");

    if (!monthSel) return;

    const months = new Set();
    allOrders.forEach(function (o) {
        const m = monthKey(o.createdAt);
        if (m) months.add(m);
    });

    const curMonth = monthSel.value;
    monthSel.innerHTML = '<option value="">' + T[currentLang].all + '</option>';

    Array.from(months).sort().reverse().forEach(function (m) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        monthSel.appendChild(opt);
    });

    monthSel.value = curMonth;

    const curMethod = methodSel.value;
    methodSel.innerHTML = '<option value="">' + T[currentLang].all + '</option>';

    ["Cash","Bankily","Sedad","Masrivi","Bimbank","Gimtel"].forEach(function (m) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        methodSel.appendChild(opt);
    });

    methodSel.value = curMethod;

}

function renderOrders() {

    const search = String($("ordersSearch").value || "").toLowerCase().trim();
    const month  = $("ordersMonthFilter").value;
    const method = $("ordersMethodFilter").value;

    const tbody = $("ordersTableBody");
    const empty = $("ordersEmpty");

    tbody.innerHTML = "";

    const filtered = allOrders.filter(function (o) {

        const m = monthKey(o.createdAt);
        if (month && m !== month) return false;
        if (method && o.paymentMethod !== method) return false;

        if (search) {
            const s =
                String(o.orderNumber   || "").toLowerCase() + " " +
                String(o.customerName  || "").toLowerCase() + " " +
                String(o.customerPhone || "").toLowerCase() + " " +
                String(o.itemName      || "").toLowerCase();
            if (s.indexOf(search) === -1) return false;
        }

        return true;

    }).sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (!filtered.length) {
        empty.style.display = "flex";
        return;
    }

    empty.style.display = "none";

    filtered.forEach(function (o) {

        const row = document.createElement("tr");
        row.innerHTML =
            "<td>" + escapeHtml(o.orderNumber || "-") + "</td>" +
            "<td>" + escapeHtml(o.customerName || "-") + "</td>" +
            "<td>" + escapeHtml(o.customerPhone || "-") + "</td>" +
            "<td>" + escapeHtml(o.itemName || "-") + "</td>" +
            "<td>" + fmtMoney(o.subtotal) + "</td>" +
            "<td>" + escapeHtml(o.paymentMethod || "-") + "</td>" +
            "<td>" + escapeHtml(o.recordedBy || "-") + "</td>" +
            "<td>" + fmtDate(o.createdAt) + " " + fmtTime(o.createdAt) + "</td>";

        tbody.appendChild(row);

    });

}


// =====================================================
// Debts
// =====================================================

async function loadDebts() {

    try {

        const result = await api("restGetDebts");
        allDebts = Array.isArray(result.debts) ? result.debts : [];
        renderDebts();

    } catch (e) {
        console.error(e);
    }

}

function renderDebts() {

    const search = String($("debtsSearch").value || "").toLowerCase().trim();
    const status = $("debtsStatusFilter").value;

    const tbody = $("debtsTableBody");
    const empty = $("debtsEmpty");

    tbody.innerHTML = "";

    const filtered = allDebts.filter(function (d) {

        if (status && d.status !== status) return false;

        if (search) {
            const s =
                String(d.customerName  || "").toLowerCase() + " " +
                String(d.customerPhone || "").toLowerCase();
            if (s.indexOf(search) === -1) return false;
        }

        return true;

    });

    if (!filtered.length) {
        empty.style.display = "flex";
        return;
    }

    empty.style.display = "none";

    filtered.forEach(function (d) {

        const statusKey = String(d.status || "unpaid").toLowerCase();
        const statusCls = "status-" + statusKey;
        const statusTxt = T[currentLang][statusKey] || statusKey;

        const row = document.createElement("tr");
        row.innerHTML =
            "<td>" + escapeHtml(d.customerName) + "</td>" +
            "<td>" + escapeHtml(d.customerPhone) + "</td>" +
            "<td>" + fmtMoney(d.amountOwed) + "</td>" +
            "<td>" + fmtMoney(d.amountPaid) + "</td>" +
            "<td>" + fmtMoney(d.totalAmount) + "</td>" +
            '<td><span class="status-pill ' + statusCls + '">' + escapeHtml(statusTxt) + "</span></td>" +
            '<td><div class="row-actions">' +
                '<button class="row-btn" data-pay-id="' + escapeHtml(d.debtId) + '">' +
                    '<i class="fas fa-money-bill"></i> ' + T[currentLang].pay +
                "</button>" +
                (statusKey !== "settled"
                    ? '<button class="row-btn" data-settle-id="' + escapeHtml(d.debtId) + '">' +
                        '<i class="fas fa-check"></i> ' + T[currentLang].settle +
                      "</button>"
                    : "") +
                (IS_DIRECTOR
                    ? '<button class="row-btn danger" data-delete-id="' + escapeHtml(d.debtId) + '">' +
                        '<i class="fas fa-trash"></i> ' + T[currentLang].delete +
                      "</button>"
                    : "") +
            "</div></td>";

        tbody.appendChild(row);

    });

    document.querySelectorAll("[data-pay-id]").forEach(function (b) {
        b.addEventListener("click", function () {
            openPaymentModal(b.dataset.payId);
        });
    });

    document.querySelectorAll("[data-settle-id]").forEach(function (b) {
        b.addEventListener("click", function () {
            settleDebt(b.dataset.settleId);
        });
    });

    document.querySelectorAll("[data-delete-id]").forEach(function (b) {
        b.addEventListener("click", function () {
            deleteDebt(b.dataset.deleteId);
        });
    });

}


// =====================================================
// Orders modal handlers
// =====================================================

$("ordersCard").addEventListener("click", async function () {
    openModal("ordersModal");
    await loadOrders();
});

$("ordersSearch").addEventListener("input", renderOrders);
$("ordersMonthFilter").addEventListener("change", renderOrders);
$("ordersMethodFilter").addEventListener("change", renderOrders);

$("addOrderBtn").addEventListener("click", function () {
    $("orderFormError").textContent = "";
    $("addOrderForm").reset();
    openModal("addOrderModal");
});

$("addOrderForm").addEventListener("submit", async function (e) {

    e.preventDefault();

    const err = $("orderFormError");
    err.textContent = "";

    const customerName  = $("orderCustomerName").value.trim();
    const customerPhone = $("orderCustomerPhone").value.trim();
    const itemName      = $("orderItemName").value.trim();
    const subtotal      = Number($("orderSubtotal").value);
    const paymentMethod = $("orderPaymentMethod").value;

    if (!subtotal || subtotal <= 0) {
        err.textContent = T[currentLang].error;
        return;
    }

    const btn = $("saveOrderBtn");
    btn.disabled = true;
    btn.classList.add("loading");

    try {

        const result = await api("restAddOrder", {
            customerName:  customerName,
            customerPhone: customerPhone,
            itemName:      itemName,
            subtotal:      subtotal,
            paymentMethod: paymentMethod
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        closeModal("addOrderModal");
        await loadOrders();
        await loadSummary();

    } catch (error) {

        err.textContent = error.message || T[currentLang].error;

    } finally {

        btn.disabled = false;
        btn.classList.remove("loading");

    }

});


// =====================================================
// Debts modal handlers
// =====================================================

$("debtsCard").addEventListener("click", async function () {
    openModal("debtsModal");
    await loadDebts();
});

$("debtsSearch").addEventListener("input", renderDebts);
$("debtsStatusFilter").addEventListener("change", renderDebts);

$("addDebtBtn").addEventListener("click", function () {
    $("debtFormError").textContent = "";
    $("addDebtForm").reset();
    $("debtAmountPaid").value = 0;
    openModal("addDebtModal");
});

$("addDebtForm").addEventListener("submit", async function (e) {

    e.preventDefault();

    const err = $("debtFormError");
    err.textContent = "";

    const customerName  = $("debtCustomerName").value.trim();
    const customerPhone = $("debtCustomerPhone").value.trim();
    const amountOwed    = Number($("debtAmountOwed").value);
    const amountPaid    = Number($("debtAmountPaid").value || 0);
    const notes         = $("debtNotes").value.trim();

    if (customerPhone.length !== 8) {
        err.textContent = T[currentLang].phoneError;
        return;
    }

    const btn = $("saveDebtBtn");
    btn.disabled = true;
    btn.classList.add("loading");

    try {

        const result = await api("restAddDebt", {
            customerName:  customerName,
            customerPhone: customerPhone,
            amountOwed:    amountOwed,
            amountPaid:    amountPaid,
            notes:         notes
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        closeModal("addDebtModal");
        await loadDebts();
        await loadSummary();

    } catch (error) {

        err.textContent = error.message || T[currentLang].error;

    } finally {

        btn.disabled = false;
        btn.classList.remove("loading");

    }

});


// Payment modal
function openPaymentModal(debtId) {

    const debt = allDebts.find(function (d) { return d.debtId === debtId; });
    if (!debt) return;

    pendingPaymentDebtId = debtId;

    $("paymentOwedNow").textContent = fmtMoney(debt.amountOwed);
    $("paymentAmount").value = "";
    $("paymentFormError").textContent = "";

    openModal("addPaymentModal");

}

$("addPaymentForm").addEventListener("submit", async function (e) {

    e.preventDefault();

    const err = $("paymentFormError");
    err.textContent = "";

    const amount = Number($("paymentAmount").value);

    if (!amount || amount <= 0) {
        err.textContent = T[currentLang].error;
        return;
    }

    const btn = $("savePaymentBtn");
    btn.disabled = true;
    btn.classList.add("loading");

    try {

        const result = await api("restAddDebtPayment", {
            debtId: pendingPaymentDebtId,
            amount: amount
        });

        if (!result.success) {
            throw new Error(result.message || T[currentLang].error);
        }

        closeModal("addPaymentModal");
        await loadDebts();
        await loadSummary();

    } catch (error) {

        err.textContent = error.message || T[currentLang].error;

    } finally {

        btn.disabled = false;
        btn.classList.remove("loading");

    }

});


// Settle
async function settleDebt(debtId) {

    if (!window.confirm(T[currentLang].confirmSettle)) return;

    try {

        const result = await api("restSettleDebt", { debtId: debtId });

        if (!result.success) throw new Error(result.message);

        await loadDebts();
        await loadSummary();

    } catch (error) {

        alert(error.message || T[currentLang].error);

    }

}


// Delete
async function deleteDebt(debtId) {

    if (!window.confirm(T[currentLang].confirmDelete)) return;

    try {

        const result = await api("restDeleteDebt", { debtId: debtId });

        if (!result.success) throw new Error(result.message);

        await loadDebts();
        await loadSummary();

    } catch (error) {

        alert(error.message || T[currentLang].error);

    }

}


// =====================================================
// Reports
// =====================================================

async function loadReports() {

    const month  = $("reportMonthFilter").value;
    const method = $("reportMethodFilter").value;

    try {

        const result = await api("restGetReports", {
            month:         month,
            paymentMethod: method
        });

        if (!result.success) throw new Error(result.message);

        $("reportTotalOrders").textContent = result.totals.totalOrders;
        $("reportTotalIncome").textContent = fmtMoney(result.totals.totalAmount);
        $("reportAvgTicket").textContent   = fmtMoney(result.totals.avgTicket);
        $("reportTopMethod").textContent   = result.totals.topMethod || "-";

        const methodBody = $("reportMethodBody");
        methodBody.innerHTML = "";
        result.byMethod.forEach(function (row) {
            const tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + escapeHtml(row.method) + "</td>" +
                "<td>" + row.orders + "</td>" +
                "<td>" + fmtMoney(row.total) + "</td>";
            methodBody.appendChild(tr);
        });

        const monthBody = $("reportMonthBody");
        monthBody.innerHTML = "";
        result.byMonth.forEach(function (row) {
            const tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + escapeHtml(row.month) + "</td>" +
                "<td>" + row.orders + "</td>" +
                "<td>" + fmtMoney(row.total) + "</td>";
            monthBody.appendChild(tr);
        });

        const dayBody = $("reportDayBody");
        dayBody.innerHTML = "";
        result.byDay.forEach(function (row) {
            const tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + escapeHtml(row.date) + "</td>" +
                "<td>" + row.orders + "</td>" +
                "<td>" + fmtMoney(row.total) + "</td>";
            dayBody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
    }

}

$("reportsCard").addEventListener("click", async function () {

    openModal("reportsModal");

    const monthSel = $("reportMonthFilter");
    const methodSel = $("reportMethodFilter");

    if (!monthSel.options.length) {

        monthSel.innerHTML = '<option value="">' + T[currentLang].all + '</option>';
        methodSel.innerHTML = '<option value="">' + T[currentLang].all + '</option>';

        const months = new Set();
        allOrders.forEach(function (o) {
            const m = monthKey(o.createdAt);
            if (m) months.add(m);
        });

        Array.from(months).sort().reverse().forEach(function (m) {
            const o = document.createElement("option");
            o.value = m; o.textContent = m;
            monthSel.appendChild(o);
        });

        ["Cash","Bankily","Sedad","Masrivi","Bimbank","Gimtel"].forEach(function (m) {
            const o = document.createElement("option");
            o.value = m; o.textContent = m;
            methodSel.appendChild(o);
        });

    }

    if (!allOrders.length) {
        await loadOrders();
    }

    await loadReports();

});

$("reportMonthFilter").addEventListener("change", loadReports);
$("reportMethodFilter").addEventListener("change", loadReports);

$("printReportBtn").addEventListener("click", function () {
    window.print();
});


// =====================================================
// Settings / Logout
// =====================================================

$("settingsCard").addEventListener("click", function () {
    window.location.href =
        "rest.settings.html?id=" + encodeURIComponent(ACTIVE_ID);
});

$("logoutBtn").addEventListener("click", function () {
    logoutRestaurant();
});


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

langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
        applyLanguage(btn.dataset.lang);

        $("restaurantStatus").textContent =
            T[currentLang][statusFromLicense()] || "active";

        renderOrders();
        renderDebts();

    });
});


// =====================================================
// Init
// =====================================================

applyLanguage(currentLang);

// Hide loader only after the first data call resolves (success or failure)
async function bootstrap() {

    try {
        await loadSummary();
    } catch (e) {
        console.error("Bootstrap error:", e);
    } finally {
        hideLoader();
    }

}

function hideLoader() {
    if (!pageLoader) return;
    requestAnimationFrame(function () {
        pageLoader.classList.add("hidden");
    });
}

bootstrap();
