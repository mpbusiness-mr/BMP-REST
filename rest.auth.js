// =====================================================
// BMP REST · Restaurant Authentication
// =====================================================

const REST_SESSION_KEY = "bmpRestaurantUser";
const REST_LOGIN_PAGE  = "rest.login.html";
const REST_DASH_PAGE   = "rest.html";


function getRestaurantUser() {

    try {
        return JSON.parse(localStorage.getItem(REST_SESSION_KEY));
    } catch (error) {
        console.error("Invalid restaurant session:", error);
        localStorage.removeItem(REST_SESSION_KEY);
        return null;
    }

}


function requireRestaurantLogin() {

    const user = getRestaurantUser();

    const role = user && String(user.role || "").trim().toLowerCase();

    const validRole = role === "director" || role === "user";

    const valid =
        user &&
        user.institutionId &&
        user.username &&
        validRole &&
        String(user.status || "").trim().toLowerCase() === "active";

    if (!valid) {

        localStorage.removeItem(REST_SESSION_KEY);

        window.location.href = REST_LOGIN_PAGE;

        return null;

    }

    return user;

}


function getActiveRestaurantId() {

    const user = requireRestaurantLogin();
    if (!user) return null;

    const urlParams = new URLSearchParams(window.location.search);
    const requested = urlParams.get("id");

    if (requested && requested !== user.institutionId) {
        window.location.href =
            REST_DASH_PAGE + "?id=" + encodeURIComponent(user.institutionId);
        return null;
    }

    return user.institutionId;

}


function logoutRestaurant() {

    localStorage.removeItem(REST_SESSION_KEY);

    window.location.href = REST_LOGIN_PAGE;

}


function isRestaurantDirector() {

    const user = getRestaurantUser();
    if (!user) return false;

    return String(user.role || "").trim().toLowerCase() === "director";

}
