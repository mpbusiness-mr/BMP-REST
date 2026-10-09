// =====================================================
// BMP REST · Admin Authentication
// =====================================================

const ADMIN_SESSION_KEY = "bmpAdminUser";
const ADMIN_LOGIN_PAGE  = "adminlogin.html";
const ADMIN_DASH_PAGE   = "admin.html";


function getAdminUser() {

    try {
        return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY));
    } catch (error) {
        console.error("Invalid admin session:", error);
        localStorage.removeItem(ADMIN_SESSION_KEY);
        return null;
    }

}


function requireAdminLogin() {

    const admin = getAdminUser();

    const valid =
        admin &&
        admin.id &&
        String(admin.status || "").trim().toLowerCase() === "active";

    if (!valid) {

        localStorage.removeItem(ADMIN_SESSION_KEY);

        window.location.href = ADMIN_LOGIN_PAGE;

        return null;

    }

    return admin;

}


function logoutAdmin() {

    localStorage.removeItem(ADMIN_SESSION_KEY);

    window.location.href = ADMIN_LOGIN_PAGE;

}
