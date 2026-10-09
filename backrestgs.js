



// =====================================================
// BMP REST Backend
// Standalone restaurant + restaurant-admin API
// =====================================================

// =====================================================
// Constants
// =====================================================

const SPREADSHEET_ID =
    "1bgA_bryT4YJbtDQzZ23qmm4aeZR4S27oAVsJ4ZnGqFo";

const SHEET_NAME = "Sheet1";

const BMP_RESTAURANT_PAYMENT_METHODS = [
    "Cash",
    "Bankily",
    "Sedad",
    "Masrivi",
    "Bimbank",
    "Gimtel"
];


// =====================================================
// Entry points
// =====================================================

function doGet() {

    return jsonResponse({
        success: true,
        message: "BMP REST API is running.",
        method: "POST",
        status: "online"
    });

}


function doPost(e) {

    try {

        if (!e || !e.postData || !e.postData.contents) {

            return jsonResponse({
                success: false,
                message: "No request data received."
            });

        }

        const data   = JSON.parse(e.postData.contents);
        const action = data.action;

        const handled = handleRestaurantAction(action, data);

        if (handled) return handled;

        return jsonResponse({
            success: false,
            message: "Unknown action."
        });

    } catch (error) {

        return jsonResponse({
            success: false,
            message: error.message || "Server error."
        });

    }

}


// =====================================================
// Router
// =====================================================

function handleRestaurantAction(action, data) {

    // ---- Admin ----
    if (action === "adminLogin")            return adminLogin(data);
    if (action === "getInstitutions")       return getInstitutions();
    if (action === "createInstitution")     return createInstitution(data);
    if (action === "updateInstitutionStatus") return updateInstitutionStatus(data);
    if (action === "getActivityLogs")       return getActivityLogs(data);
    if (action === "adminGetUsers")         return adminGetUsers(data);
    if (action === "adminEnableUser")       return adminEnableUser(data);
    if (action === "adminDisableUser")      return adminDisableUser(data);
    if (action === "adminDeleteUser")       return adminDeleteUser(data);
    if (action === "adminResetPassword")    return adminResetPassword(data);

    // ---- Restaurant ----
    if (action === "restLogin")             return restLogin(data);
    if (action === "restGetSummary")        return restGetSummary(data);
    if (action === "restGetOrders")         return restGetOrders(data);
    if (action === "restAddOrder")          return restAddOrder(data);
    if (action === "restGetOrder")          return restGetOrder(data);
    if (action === "restGetDebts")          return restGetDebts(data);
    if (action === "restAddDebt")           return restAddDebt(data);
    if (action === "restAddDebtPayment")    return restAddDebtPayment(data);
    if (action === "restSettleDebt")        return restSettleDebt(data);
    if (action === "restDeleteDebt")        return restDeleteDebt(data);
    if (action === "restGetReports")        return restGetReports(data);
    if (action === "restChangePassword")    return restChangePassword(data);
    if (action === "restGetSettings")       return restGetSettings(data);
    if (action === "restUpdateSettings")    return restUpdateSettings(data);
    if (action === "restGetUsers")          return restGetUsers(data);
    if (action === "restAddUser")           return restAddUser(data);
    if (action === "restChangeUserPassword") return restChangeUserPassword(data);
    if (action === "restEnableUser")        return restEnableUser(data);

    return null;

}


// =====================================================
// Core helpers
// =====================================================

function jsonResponse(data) {

    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);

}


function setColumnValue(row, headers, columnName, value) {

    const index = headers.indexOf(columnName);
    if (index !== -1) row[index] = value;

}


function restNormalizePhone(phone) {

    return String(phone || "").replace(/\D/g, "");

}


function restComputeDebtStatus(amountOwed, amountPaid) {

    const owed = Number(amountOwed || 0);
    const paid = Number(amountPaid || 0);

    if (owed <= 0) return "settled";
    if (paid > 0)  return "partial";
    return "unpaid";

}


function restGenerateOrderNumber(sheet, headers) {

    const index = headers.indexOf("orderNumber");
    let maxNumber = 0;

    const currentYear = new Date().getFullYear();
    const lastRow = sheet.getLastRow();

    if (index !== -1 && lastRow > 1) {

        const values =
            sheet
                .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
                .getValues();

        values.forEach(function (row) {

            const orderNumber = String(row[index] || "").trim();
            const match       = orderNumber.match(/^ORD-(\d{4})-(\d+)$/);

            if (!match) return;

            const year = Number(match[1]);
            const num  = Number(match[2]);

            if (year === currentYear && num > maxNumber) {
                maxNumber = num;
            }

        });

    }

    return (
        "ORD-" +
        currentYear +
        "-" +
        String(maxNumber + 1).padStart(5, "0")
    );

}


function generateRestaurantId(institutionsSheet) {

    const currentYear =
        new Date().getFullYear().toString().slice(-2);

    const rows = institutionsSheet.getDataRange().getValues();

    let highestNumber = 0;

    for (let i = 1; i < rows.length; i++) {

        const id = String(rows[i][0] || "");

        const match = id.match(/^RT(\d{4})\d{2}$/);

        if (match) {

            const number = parseInt(match[1], 10);

            if (number > highestNumber) highestNumber = number;

        }

    }

    return (
        "RT" +
        String(highestNumber + 1).padStart(4, "0") +
        currentYear
    );

}


function logActivityBackend(institutionSpreadsheet, data) {

    let logsSheet =
        institutionSpreadsheet.getSheetByName("Activity Logs");

    if (!logsSheet) {

        logsSheet = institutionSpreadsheet.insertSheet("Activity Logs");

        logsSheet.appendRow([
            "logId",
            "username",
            "role",
            "action",
            "details",
            "date"
        ]);

    }

    logsSheet.appendRow([
        "LOG-" + Utilities.getUuid(),
        data.username || "",
        data.role     || "",
        data.action   || "",
        data.details  || "",
        new Date()
    ]);

}


// =====================================================
// Authentication helpers
// =====================================================

function restAuthUser(masterSS, institutionId, username) {

    const authSheet = masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) {
        return { success: false, message: "Authentication sheet not found." };
    }

    const rows = authSheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][0] || "").trim();
        const rowUsername      = String(rows[i][1] || "").trim();
        const rowRole          = String(rows[i][3] || "").trim();
        const rowStatus        = String(rows[i][4] || "").trim();

        if (
            rowInstitutionId === institutionId &&
            rowUsername.toLowerCase() === username.toLowerCase()
        ) {

            if (rowStatus.toLowerCase() !== "active") {

                return {
                    success: false,
                    message: "User account is disabled."
                };

            }

            return {
                success: true,
                username: rowUsername,
                role: rowRole
            };

        }

    }

    return { success: false, message: "User access denied." };

}


function restGetInstitution(masterSS, institutionId) {

    const institutionsSheet = masterSS.getSheetByName("Institutions");

    if (!institutionsSheet) return null;

    const rows = institutionsSheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {

        const rowId = String(rows[i][0] || "").trim();

        if (rowId === institutionId) {

            return {
                id:           rowId,
                type:         String(rows[i][1]  || ""),
                name:         String(rows[i][2]  || ""),
                phone:        String(rows[i][3]  || ""),
                email:        String(rows[i][4]  || ""),
                licenseStart: String(rows[i][5]  || ""),
                licenseEnd:   String(rows[i][6]  || ""),
                status:       String(rows[i][7]  || ""),
                username:     String(rows[i][8]  || ""),
                sheetId:      String(rows[i][9]  || ""),
                sheetUrl:     String(rows[i][10] || "")
            };

        }

    }

    return null;

}


function restAuthContext(institutionId, username) {

    institutionId = String(institutionId || "").trim();
    username      = String(username      || "").trim();

    if (!institutionId) throw new Error("Institution ID is required.");
    if (!username)      throw new Error("Username is required.");

    const masterSS = SpreadsheetApp.openById(SPREADSHEET_ID);

    const authenticated = restAuthUser(masterSS, institutionId, username);

    if (!authenticated.success) {
        throw new Error(authenticated.message);
    }

    const institution = restGetInstitution(masterSS, institutionId);

    if (!institution) {
        throw new Error("Institution not found.");
    }

    if (String(institution.status || "").toLowerCase() !== "active") {
        throw new Error("Institution is disabled.");
    }

    if (!institution.sheetId) {
        throw new Error("Institution database not found.");
    }

    if (institution.licenseEnd) {

        const licenseEnd = new Date(institution.licenseEnd);

        if (!isNaN(licenseEnd.getTime()) && new Date() > licenseEnd) {
            throw new Error("The institution license has expired.");
        }

    }

    const institutionSS = SpreadsheetApp.openById(institution.sheetId);

    return {
        masterSS:      masterSS,
        institutionSS: institutionSS,
        institution:   institution,
        authenticated: authenticated
    };

}


// =====================================================
// Sheet helpers
// =====================================================

function restEnsureOrdersSheet(institutionSS) {

    let sheet = institutionSS.getSheetByName("Restaurant Orders");

    if (!sheet) {

        sheet = institutionSS.insertSheet("Restaurant Orders");

        sheet.appendRow([
            "orderId",
            "orderNumber",
            "customerName",
            "customerPhone",
            "subtotal",
            "paymentMethod",
            "recordedBy",
            "createdAt"
        ]);

    }

    return sheet;

}


function restEnsureDebtsSheet(institutionSS) {

    let sheet = institutionSS.getSheetByName("Restaurant Debts");

    if (!sheet) {

        sheet = institutionSS.insertSheet("Restaurant Debts");

        sheet.appendRow([
            "debtId",
            "customerName",
            "customerPhone",
            "amountOwed",
            "amountPaid",
            "totalAmount",
            "status",
            "notes",
            "recordedBy",
            "createdAt",
            "settledAt"
        ]);

    }

    return sheet;

}


function restReadHeaders(sheet) {

    return sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0]
        .map(function (h) { return String(h).trim(); });

}



// =====================================================
// ADMIN — Login
// =====================================================

function adminLogin(data) {

    const username = String(data.username || "");
    const password = String(data.password || "");

    const masterSS = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet    = masterSS.getSheetByName(SHEET_NAME);

    if (!sheet) {
        return jsonResponse({ success: false, message: "Admin sheet not found." });
    }

    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {

        const id             = String(rows[i][0] || "");
        const sheetUsername  = String(rows[i][1] || "");
        const sheetPassword  = String(rows[i][2] || "");
        const status         = String(rows[i][3] || "");

        if (sheetUsername === username && sheetPassword === password) {

            return jsonResponse({
                success: true,
                id: id,
                status: status
            });

        }

    }

    return jsonResponse({
        success: false,
        message: "Invalid username or password."
    });

}


// =====================================================
// ADMIN — Get institutions
// =====================================================

function getInstitutions() {

    const masterSS = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet    = masterSS.getSheetByName("Institutions");

    if (!sheet) {
        return jsonResponse({ success: true, institutions: [] });
    }

    const rows = sheet.getDataRange().getValues();
    const institutions = [];

    for (let i = 1; i < rows.length; i++) {

        institutions.push({
            id:           String(rows[i][0]  || ""),
            type:         String(rows[i][1]  || ""),
            name:         String(rows[i][2]  || ""),
            phone:        String(rows[i][3]  || ""),
            email:        String(rows[i][4]  || ""),
            licenseStart: String(rows[i][5]  || ""),
            licenseEnd:   String(rows[i][6]  || ""),
            status:       String(rows[i][7]  || ""),
            username:     String(rows[i][8]  || ""),
            sheetId:      String(rows[i][9]  || ""),
            sheetUrl:     String(rows[i][10] || ""),
            createdAt:
                rows[i][11] instanceof Date
                    ? rows[i][11].toISOString()
                    : String(rows[i][11] || "")
        });

    }

    return jsonResponse({ success: true, institutions: institutions });

}


// =====================================================
// ADMIN — Create institution (restaurant)
// =====================================================

function createInstitution(data) {

    const type         = String(data.type         || "restaurant").trim();
    const name         = String(data.name         || "").trim();
    const phone        = String(data.phone        || "").trim();
    const email        = String(data.email        || "").trim();
    const licenseStart = String(data.licenseStart || "").trim();
    const licenseEnd   = String(data.licenseEnd   || "").trim();
    const username     = String(data.username     || "").trim();
    const password     = String(data.password     || "");

    if (type !== "restaurant") {
        throw new Error("Only restaurants can be created from this panel.");
    }

    if (!name)         throw new Error("Institution name is required.");
    if (!licenseStart) throw new Error("License start date is required.");
    if (!licenseEnd)   throw new Error("License end date is required.");
    if (!username)     throw new Error("Main username is required.");
    if (!password)     throw new Error("Main password is required.");

    const masterSS = SpreadsheetApp.openById(SPREADSHEET_ID);

    let institutionsSheet = masterSS.getSheetByName("Institutions");

    if (!institutionsSheet) {

        institutionsSheet = masterSS.insertSheet("Institutions");

        institutionsSheet.appendRow([
            "institutionId",
            "type",
            "name",
            "phone",
            "email",
            "licenseStart",
            "licenseEnd",
            "status",
            "username",
            "sheetId",
            "sheetUrl",
            "createdAt"
        ]);

    }

    let authSheet = masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) {

        authSheet = masterSS.insertSheet("Schools Authentication");

        authSheet.appendRow([
            "institutionId",
            "username",
            "password",
            "role",
            "status",
            "createdAt"
        ]);

    }

    const authRows = authSheet.getDataRange().getValues();

    for (let i = 1; i < authRows.length; i++) {

        const existingUsername = String(authRows[i][1] || "").toLowerCase();

        if (existingUsername === username.toLowerCase()) {
            throw new Error("This username is already in use.");
        }

    }

    const institutionId = generateRestaurantId(institutionsSheet);

    const institutionSpreadsheet = SpreadsheetApp.create(
        "BMP - " + name + " - " + institutionId
    );

    const institutionSpreadsheetId  = institutionSpreadsheet.getId();
    const institutionSpreadsheetUrl = institutionSpreadsheet.getUrl();

    setupRestaurantSpreadsheet(institutionSpreadsheet, {
        id:           institutionId,
        type:         type,
        name:         name,
        phone:        phone,
        email:        email,
        licenseStart: licenseStart,
        licenseEnd:   licenseEnd,
        username:     username
    });

    institutionsSheet.appendRow([
        institutionId,
        type,
        name,
        phone,
        email,
        licenseStart,
        licenseEnd,
        "active",
        username,
        institutionSpreadsheetId,
        institutionSpreadsheetUrl,
        new Date()
    ]);

    authSheet.appendRow([
        institutionId,
        username,
        password,
        "Director",
        "active",
        new Date()
    ]);

    return jsonResponse({
        success: true,
        institution: {
            id:           institutionId,
            type:         type,
            name:         name,
            phone:        phone,
            email:        email,
            licenseStart: licenseStart,
            licenseEnd:   licenseEnd,
            status:       "active",
            username:     username,
            sheetId:      institutionSpreadsheetId,
            sheetUrl:     institutionSpreadsheetUrl
        }
    });

}


// =====================================================
// ADMIN — Update institution status
// =====================================================

function updateInstitutionStatus(data) {

    const institutionId = String(data.institutionId || "");
    const newStatus     = String(data.status        || "");

    if (!institutionId) throw new Error("Institution ID is required.");

    if (newStatus !== "active" && newStatus !== "disabled") {
        throw new Error("Invalid institution status.");
    }

    const masterSS = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet    = masterSS.getSheetByName("Institutions");

    if (!sheet) throw new Error("Institutions sheet not found.");

    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {

        const existingId = String(rows[i][0] || "");

        if (existingId === institutionId) {

            sheet.getRange(i + 1, 8).setValue(newStatus);

            return jsonResponse({
                success: true,
                institutionId: institutionId,
                status: newStatus
            });

        }

    }

    throw new Error("Institution not found.");

}


// =====================================================
// ADMIN — Activity logs
// =====================================================

function getActivityLogs(data) {

    const institutionId = String(data.institutionId || "").trim();

    if (!institutionId) throw new Error("Institution ID is required.");

    const masterSS = SpreadsheetApp.openById(SPREADSHEET_ID);

    const institution = restGetInstitution(masterSS, institutionId);

    if (!institution) throw new Error("Institution not found.");
    if (!institution.sheetId) throw new Error("Institution database not found.");

    const institutionSS = SpreadsheetApp.openById(institution.sheetId);
    const sheet         = institutionSS.getSheetByName("Activity Logs");

    if (!sheet) return jsonResponse({ success: true, logs: [] });

    const lastRow    = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow <= 1 || lastColumn <= 0) {
        return jsonResponse({ success: true, logs: [] });
    }

    const values  = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = values[0].map(function (h) { return String(h).trim(); });

    const logs = [];

    for (let i = 1; i < values.length; i++) {

        const row = values[i];

        if (row.every(function (v) { return v === "" || v === null; })) continue;

        const log = {};

        headers.forEach(function (header, index) {

            let value = row[index];

            if (value instanceof Date) value = value.toISOString();

            log[header] = value;

        });

        logs.push(log);

    }

    return jsonResponse({ success: true, logs: logs });

}


// =====================================================
// ADMIN — Users of a restaurant
// =====================================================

function adminGetUsers(data) {

    const institutionId = String(data.institutionId || "").trim();

    if (!institutionId) throw new Error("Institution ID is required.");

    const masterSS = SpreadsheetApp.openById(SPREADSHEET_ID);
    const authSheet = masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");

    if (institutionIdIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    const users = [];

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();

        if (rowInstitutionId !== institutionId) continue;

        users.push({
            username: String(rows[i][headers.indexOf("username")] || ""),
            role:     String(rows[i][headers.indexOf("role")]     || ""),
            status:   String(rows[i][headers.indexOf("status")]   || "")
        });

    }

    return jsonResponse({ success: true, users: users });

}


// =====================================================
// ADMIN — Enable / disable / delete users
// =====================================================

function adminEnableUser(data) {
    return adminSetUserStatus(data, "active");
}

function adminDisableUser(data) {
    return adminSetUserStatus(data, "disabled");
}

function adminSetUserStatus(data, newStatus) {

    const institutionId = String(data.institutionId || "").trim();
    const username      = String(data.username      || "").trim();

    if (!institutionId) throw new Error("Institution ID is required.");
    if (!username)      throw new Error("Username is required.");

    const masterSS  = SpreadsheetApp.openById(SPREADSHEET_ID);
    const authSheet = masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");
    const usernameIndex      = headers.indexOf("username");
    const statusIndex        = headers.indexOf("status");
    const roleIndex          = headers.indexOf("role");

    if (institutionIdIndex === -1 || usernameIndex === -1 || statusIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();
        const rowUsername      = String(rows[i][usernameIndex]      || "").trim();
        const rowRole          = String(rows[i][roleIndex]          || "").trim();

        if (
            rowInstitutionId === institutionId &&
            rowUsername.toLowerCase() === username.toLowerCase()
        ) {

            if (
                rowRole.toLowerCase() === "director" &&
                newStatus === "disabled"
            ) {
                throw new Error("The Director account cannot be disabled.");
            }

            authSheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);

            return jsonResponse({
                success: true,
                username: rowUsername,
                status:   newStatus
            });

        }

    }

    throw new Error("User not found.");

}


function adminDeleteUser(data) {

    const institutionId = String(data.institutionId || "").trim();
    const username      = String(data.username      || "").trim();

    if (!institutionId) throw new Error("Institution ID is required.");
    if (!username)      throw new Error("Username is required.");

    const masterSS  = SpreadsheetApp.openById(SPREADSHEET_ID);
    const authSheet = masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");
    const usernameIndex      = headers.indexOf("username");
    const roleIndex          = headers.indexOf("role");

    if (institutionIdIndex === -1 || usernameIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();
        const rowUsername      = String(rows[i][usernameIndex]      || "").trim();
        const rowRole          = String(rows[i][roleIndex]          || "").trim();

        if (
            rowInstitutionId === institutionId &&
            rowUsername.toLowerCase() === username.toLowerCase()
        ) {

            if (rowRole.toLowerCase() === "director") {
                throw new Error("The Director account cannot be deleted.");
            }

            authSheet.deleteRow(i + 1);

            return jsonResponse({
                success: true,
                message: "User deleted successfully."
            });

        }

    }

    throw new Error("User not found.");

}


// =====================================================
// ADMIN — Reset user password
// =====================================================

function adminResetPassword(data) {

    const institutionId = String(data.institutionId || "").trim();
    const username      = String(data.username      || "").trim();
    const newPassword   = String(data.newPassword   || "");

    if (!institutionId) throw new Error("Institution ID is required.");
    if (!username)      throw new Error("Username is required.");
    if (!newPassword)   throw new Error("New password is required.");

    if (newPassword.length < 4) {
        throw new Error("Password must contain at least 4 characters.");
    }

    const masterSS  = SpreadsheetApp.openById(SPREADSHEET_ID);
    const authSheet = masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");
    const usernameIndex      = headers.indexOf("username");
    const passwordIndex      = headers.indexOf("password");

    if (institutionIdIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();
        const rowUsername      = String(rows[i][usernameIndex]      || "").trim();

        if (
            rowInstitutionId === institutionId &&
            rowUsername.toLowerCase() === username.toLowerCase()
        ) {

            authSheet.getRange(i + 1, passwordIndex + 1).setValue(newPassword);

            return jsonResponse({
                success: true,
                message: "Password reset successfully."
            });

        }

    }

    throw new Error("User not found.");

}


// =====================================================
// RESTAURANT — Login
// =====================================================

function restLogin(data) {

    const username = String(data.username || "").trim();
    const password = String(data.password || "");

    if (!username) return jsonResponse({ success: false, message: "Username is required." });
    if (!password) return jsonResponse({ success: false, message: "Password is required." });

    const masterSS  = SpreadsheetApp.openById(SPREADSHEET_ID);
    const authSheet = masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) {
        return jsonResponse({ success: false, message: "Authentication sheet not found." });
    }

    const authRows = authSheet.getDataRange().getValues();

    let authenticatedUser = null;

    for (let i = 1; i < authRows.length; i++) {

        const rowUsername = String(authRows[i][1] || "").trim();
        const rowPassword = String(authRows[i][2] || "");

        if (
            rowUsername.toLowerCase() === username.toLowerCase() &&
            rowPassword === password
        ) {

            authenticatedUser = {
                institutionId: String(authRows[i][0] || ""),
                username:      rowUsername,
                role:          String(authRows[i][3] || ""),
                status:        String(authRows[i][4] || "")
            };

            break;

        }

    }

    if (!authenticatedUser) {
        return jsonResponse({ success: false, message: "Invalid username or password." });
    }

    if (authenticatedUser.status.toLowerCase() !== "active") {
        return jsonResponse({ success: false, message: "This user account is disabled." });
    }

    const institution = restGetInstitution(masterSS, authenticatedUser.institutionId);

    if (!institution) {
        return jsonResponse({ success: false, message: "Institution not found." });
    }

    if (institution.type.toLowerCase() !== "restaurant") {
        return jsonResponse({
            success: false,
            message: "This account is not a restaurant account."
        });
    }

    if (institution.status.toLowerCase() !== "active") {
        return jsonResponse({ success: false, message: "This restaurant is disabled." });
    }

    if (institution.licenseEnd) {

        const licenseEnd = new Date(institution.licenseEnd);

        if (!isNaN(licenseEnd.getTime()) && new Date() > licenseEnd) {
            return jsonResponse({
                success: false,
                message: "The restaurant license has expired."
            });
        }

    }

    return jsonResponse({
        success: true,
        user: {
            id:               authenticatedUser.institutionId,
            username:         authenticatedUser.username,
            role:             authenticatedUser.role,
            status:           authenticatedUser.status,
            institutionId:    institution.id,
            institutionType:  institution.type,
            institutionName:  institution.name,
            institutionPhone: institution.phone,
            institutionEmail: institution.email,
            licenseStart:     institution.licenseStart,
            licenseEnd:       institution.licenseEnd,
            sheetId:          institution.sheetId,
            loginTime:        new Date().toISOString()
        }
    });

}



// =====================================================
// RESTAURANT — Summary (dashboard tiles)
// =====================================================

function restGetSummary(data) {

    const context = restAuthContext(data.institutionId, data.username);
    const sheet   = context.institutionSS.getSheetByName("Restaurant Orders");

    let todayOrders = 0;
    let todayIncome = 0;
    let monthOrders = 0;
    let monthIncome = 0;

    const now = new Date();
    const todayStr = now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");

    const monthPrefix = now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0");

    if (sheet) {

        const lastRow = sheet.getLastRow();

        if (lastRow > 1) {

            const headers = restReadHeaders(sheet);
            const values  = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

            const amountIndex = headers.indexOf("subtotal");
            const dateIndex   = headers.indexOf("createdAt");

            values.forEach(function (row) {

                if (row.every(function (v) { return v === "" || v === null; })) return;

                let dateStr = "";
                const dateVal = row[dateIndex];

                if (dateVal instanceof Date) {
                    dateStr = dateVal.getFullYear() + "-" +
                        String(dateVal.getMonth() + 1).padStart(2, "0") + "-" +
                        String(dateVal.getDate()).padStart(2, "0");
                } else {
                    dateStr = String(dateVal || "").slice(0, 10);
                }

                const amount = Number(row[amountIndex] || 0);

                if (dateStr === todayStr) {
                    todayOrders++;
                    todayIncome += amount;
                }

                if (dateStr.slice(0, 7) === monthPrefix) {
                    monthOrders++;
                    monthIncome += amount;
                }

            });

        }

    }

    let outstanding = 0;
    const debtsSheet = context.institutionSS.getSheetByName("Restaurant Debts");

    if (debtsSheet) {

        const lastRow = debtsSheet.getLastRow();

        if (lastRow > 1) {

            const headers    = restReadHeaders(debtsSheet);
            const owedIndex  = headers.indexOf("amountOwed");
            const statIndex  = headers.indexOf("status");

            const values = debtsSheet.getRange(2, 1, lastRow - 1, debtsSheet.getLastColumn()).getValues();

            values.forEach(function (row) {

                if (row.every(function (v) { return v === "" || v === null; })) return;

                if (String(row[statIndex] || "").toLowerCase() !== "settled") {
                    outstanding += Number(row[owedIndex] || 0);
                }

            });

        }

    }

    return jsonResponse({
        success: true,
        summary: {
            todayOrders: todayOrders,
            todayIncome: todayIncome,
            monthOrders: monthOrders,
            monthIncome: monthIncome,
            outstanding: outstanding
        }
    });

}


// =====================================================
// RESTAURANT — Orders
// =====================================================

function restGetOrders(data) {

    const context = restAuthContext(data.institutionId, data.username);
    const sheet   = context.institutionSS.getSheetByName("Restaurant Orders");

    if (!sheet) return jsonResponse({ success: true, orders: [] });

    const lastRow    = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow <= 1 || lastColumn <= 0) {
        return jsonResponse({ success: true, orders: [] });
    }

    const values  = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = values[0].map(function (h) { return String(h).trim(); });

    const orders = [];

    for (let i = 1; i < values.length; i++) {

        const row = values[i];

        if (row.every(function (v) { return v === "" || v === null; })) continue;

        const order = {};

        headers.forEach(function (header, index) {

            let value = row[index];

            if (value instanceof Date) value = value.toISOString();

            order[header] = value;

        });

        orders.push(order);

    }

    return jsonResponse({ success: true, orders: orders });

}


function restGetOrder(data) {

    const context = restAuthContext(data.institutionId, data.username);
    const orderId = String(data.orderId || "").trim();

    if (!orderId) throw new Error("Order ID is required.");

    const sheet = context.institutionSS.getSheetByName("Restaurant Orders");

    if (!sheet) throw new Error("Restaurant Orders sheet not found.");

    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) throw new Error("Order not found.");

    const headers      = values[0].map(function (h) { return String(h).trim(); });
    const orderIdIndex = headers.indexOf("orderId");

    if (orderIdIndex === -1) {
        throw new Error("Restaurant Orders sheet structure is invalid.");
    }

    for (let i = 1; i < values.length; i++) {

        const rowOrderId = String(values[i][orderIdIndex] || "").trim();

        if (rowOrderId === orderId) {

            const order = {};

            headers.forEach(function (header, index) {

                let value = values[i][index];

                if (value instanceof Date) value = value.toISOString();

                order[header] = value;

            });

            return jsonResponse({ success: true, order: order });

        }

    }

    throw new Error("Order not found.");

}


function restAddOrder(data) {

    const context = restAuthContext(data.institutionId, data.username);

    const customerName  = String(data.customerName  || "").trim();
    const customerPhone = String(data.customerPhone || "").trim();
    const subtotal      = Number(data.subtotal || 0);
    const paymentMethod = String(data.paymentMethod || "").trim();

    if (!subtotal || subtotal <= 0) {
        throw new Error("A valid subtotal is required.");
    }

    if (!paymentMethod) {
        throw new Error("Payment method is required.");
    }

    const methodOk = BMP_RESTAURANT_PAYMENT_METHODS.some(function (m) {
        return m.toLowerCase() === paymentMethod.toLowerCase();
    });

    if (!methodOk) throw new Error("Invalid payment method.");

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {

        const sheet   = restEnsureOrdersSheet(context.institutionSS);
        const headers = restReadHeaders(sheet);

        const orderNumber = restGenerateOrderNumber(sheet, headers);
        const orderId     = "ORD-" + Utilities.getUuid();
        const now         = new Date();

        const newRow = new Array(headers.length).fill("");

        setColumnValue(newRow, headers, "orderId",       orderId);
        setColumnValue(newRow, headers, "orderNumber",   orderNumber);
        setColumnValue(newRow, headers, "customerName",  customerName);
        setColumnValue(newRow, headers, "customerPhone", customerPhone);
        setColumnValue(newRow, headers, "subtotal",      subtotal);
        setColumnValue(newRow, headers, "paymentMethod", paymentMethod);
        setColumnValue(newRow, headers, "recordedBy",    context.authenticated.username);
        setColumnValue(newRow, headers, "createdAt",     now);

        sheet.appendRow(newRow);

        logActivityBackend(context.institutionSS, {
            username: context.authenticated.username,
            role:     context.authenticated.role,
            action:   "Recorded Restaurant Order",
            details:  "Order " + orderNumber + " - " + subtotal + " - " + paymentMethod
        });

        return jsonResponse({
            success: true,
            order: {
                orderId:       orderId,
                orderNumber:   orderNumber,
                customerName:  customerName,
                customerPhone: customerPhone,
                subtotal:      subtotal,
                paymentMethod: paymentMethod,
                recordedBy:    context.authenticated.username,
                createdAt:     now.toISOString()
            }
        });

    } finally {
        lock.releaseLock();
    }

}


// =====================================================
// RESTAURANT — Debts
// =====================================================

function restGetDebts(data) {

    const context = restAuthContext(data.institutionId, data.username);
    const sheet   = context.institutionSS.getSheetByName("Restaurant Debts");

    if (!sheet) return jsonResponse({ success: true, debts: [] });

    const lastRow    = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow <= 1 || lastColumn <= 0) {
        return jsonResponse({ success: true, debts: [] });
    }

    const values  = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = values[0].map(function (h) { return String(h).trim(); });

    const debts = [];

    for (let i = 1; i < values.length; i++) {

        const row = values[i];

        if (row.every(function (v) { return v === "" || v === null; })) continue;

        const debt = {};

        headers.forEach(function (header, index) {

            let value = row[index];

            if (value instanceof Date) value = value.toISOString();

            debt[header] = value;

        });

        debts.push(debt);

    }

    return jsonResponse({ success: true, debts: debts });

}


function restAddDebt(data) {

    const context = restAuthContext(data.institutionId, data.username);

    const customerName  = String(data.customerName || "").trim();
    const customerPhone = restNormalizePhone(data.customerPhone);
    const amountOwed    = Number(data.amountOwed || 0);
    const amountPaid    = Number(data.amountPaid || 0);
    const notes         = String(data.notes || "").trim();

    if (!customerName) throw new Error("Customer name is required.");
    if (customerPhone.length !== 8) throw new Error("Phone number must be 8 digits.");
    if (!amountOwed || amountOwed <= 0) throw new Error("A valid amount owed is required.");

    const totalAmount = amountOwed + amountPaid;
    const status      = restComputeDebtStatus(amountOwed, amountPaid);

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {

        const sheet   = restEnsureDebtsSheet(context.institutionSS);
        const headers = restReadHeaders(sheet);

        const debtId = "DEBT-" + Utilities.getUuid();
        const now    = new Date();

        const newRow = new Array(headers.length).fill("");

        setColumnValue(newRow, headers, "debtId",        debtId);
        setColumnValue(newRow, headers, "customerName",  customerName);
        setColumnValue(newRow, headers, "customerPhone", customerPhone);
        setColumnValue(newRow, headers, "amountOwed",    amountOwed);
        setColumnValue(newRow, headers, "amountPaid",    amountPaid);
        setColumnValue(newRow, headers, "totalAmount",   totalAmount);
        setColumnValue(newRow, headers, "status",        status);
        setColumnValue(newRow, headers, "notes",         notes);
        setColumnValue(newRow, headers, "recordedBy",    context.authenticated.username);
        setColumnValue(newRow, headers, "createdAt",     now);

        sheet.appendRow(newRow);

        logActivityBackend(context.institutionSS, {
            username: context.authenticated.username,
            role:     context.authenticated.role,
            action:   "Added Restaurant Debt",
            details:  customerName + " - " + customerPhone + " - Owed: " + amountOwed
        });

        return jsonResponse({
            success: true,
            debt: {
                debtId:        debtId,
                customerName:  customerName,
                customerPhone: customerPhone,
                amountOwed:    amountOwed,
                amountPaid:    amountPaid,
                totalAmount:   totalAmount,
                status:        status,
                notes:         notes,
                recordedBy:    context.authenticated.username,
                createdAt:     now.toISOString(),
                settledAt:     ""
            }
        });

    } finally {
        lock.releaseLock();
    }

}


function restAddDebtPayment(data) {

    const context = restAuthContext(data.institutionId, data.username);

    const debtId        = String(data.debtId || "").trim();
    const paymentAmount = Number(data.amount || 0);

    if (!debtId) throw new Error("Debt ID is required.");
    if (!paymentAmount || paymentAmount <= 0) throw new Error("A valid payment amount is required.");

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {

        const sheet = context.institutionSS.getSheetByName("Restaurant Debts");

        if (!sheet) throw new Error("Restaurant Debts sheet not found.");

        const lastRow    = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();

        if (lastRow <= 1) throw new Error("Debt not found.");

        const values  = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
        const headers = values[0].map(function (h) { return String(h).trim(); });

        const debtIdIndex    = headers.indexOf("debtId");
        const owedIndex      = headers.indexOf("amountOwed");
        const paidIndex      = headers.indexOf("amountPaid");
        const totalIndex     = headers.indexOf("totalAmount");
        const statusIndex    = headers.indexOf("status");
        const settledAtIndex = headers.indexOf("settledAt");

        if (debtIdIndex === -1 || owedIndex === -1 || paidIndex === -1 || statusIndex === -1) {
            throw new Error("Restaurant Debts sheet structure is invalid.");
        }

        let foundRow = -1;

        for (let i = 1; i < values.length; i++) {

            const rowId = String(values[i][debtIdIndex] || "").trim();

            if (rowId === debtId) { foundRow = i + 1; break; }

        }

        if (foundRow === -1) throw new Error("Debt not found.");

        const rowNumber = foundRow - 1;

        const currentOwed = Number(values[rowNumber][owedIndex] || 0);
        const currentPaid = Number(values[rowNumber][paidIndex] || 0);

        if (paymentAmount > currentOwed) {
            throw new Error("Payment amount exceeds amount owed.");
        }

        const newOwed   = currentOwed - paymentAmount;
        const newPaid   = currentPaid + paymentAmount;
        const newTotal  = newOwed + newPaid;
        const newStatus = restComputeDebtStatus(newOwed, newPaid);
        const now       = new Date();

        sheet.getRange(foundRow, owedIndex + 1).setValue(newOwed);
        sheet.getRange(foundRow, paidIndex + 1).setValue(newPaid);

        if (totalIndex !== -1) {
            sheet.getRange(foundRow, totalIndex + 1).setValue(newTotal);
        }

        sheet.getRange(foundRow, statusIndex + 1).setValue(newStatus);

        if (settledAtIndex !== -1 && newStatus === "settled") {
            sheet.getRange(foundRow, settledAtIndex + 1).setValue(now);
        }

        logActivityBackend(context.institutionSS, {
            username: context.authenticated.username,
            role:     context.authenticated.role,
            action:   "Added Restaurant Debt Payment",
            details:  "Debt " + debtId + " - Payment: " + paymentAmount
        });

        return jsonResponse({
            success: true,
            debt: {
                debtId:      debtId,
                amountOwed:  newOwed,
                amountPaid:  newPaid,
                totalAmount: newTotal,
                status:      newStatus,
                settledAt:   newStatus === "settled" ? now.toISOString() : ""
            }
        });

    } finally {
        lock.releaseLock();
    }

}


function restSettleDebt(data) {

    const context = restAuthContext(data.institutionId, data.username);
    const debtId  = String(data.debtId || "").trim();

    if (!debtId) throw new Error("Debt ID is required.");

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {

        const sheet = context.institutionSS.getSheetByName("Restaurant Debts");

        if (!sheet) throw new Error("Restaurant Debts sheet not found.");

        const lastRow    = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();

        if (lastRow <= 1) throw new Error("Debt not found.");

        const values  = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
        const headers = values[0].map(function (h) { return String(h).trim(); });

        const debtIdIndex    = headers.indexOf("debtId");
        const owedIndex      = headers.indexOf("amountOwed");
        const paidIndex      = headers.indexOf("amountPaid");
        const totalIndex     = headers.indexOf("totalAmount");
        const statusIndex    = headers.indexOf("status");
        const settledAtIndex = headers.indexOf("settledAt");

        if (debtIdIndex === -1 || owedIndex === -1 || paidIndex === -1 || statusIndex === -1) {
            throw new Error("Restaurant Debts sheet structure is invalid.");
        }

        let foundRow = -1;

        for (let i = 1; i < values.length; i++) {

            const rowId = String(values[i][debtIdIndex] || "").trim();

            if (rowId === debtId) { foundRow = i + 1; break; }

        }

        if (foundRow === -1) throw new Error("Debt not found.");

        const rowNumber = foundRow - 1;

        const currentOwed = Number(values[rowNumber][owedIndex] || 0);
        const currentPaid = Number(values[rowNumber][paidIndex] || 0);

        const newOwed  = 0;
        const newPaid  = currentPaid + currentOwed;
        const newTotal = newOwed + newPaid;
        const now      = new Date();

        sheet.getRange(foundRow, owedIndex + 1).setValue(newOwed);
        sheet.getRange(foundRow, paidIndex + 1).setValue(newPaid);

        if (totalIndex !== -1) {
            sheet.getRange(foundRow, totalIndex + 1).setValue(newTotal);
        }

        sheet.getRange(foundRow, statusIndex + 1).setValue("settled");

        if (settledAtIndex !== -1) {
            sheet.getRange(foundRow, settledAtIndex + 1).setValue(now);
        }

        logActivityBackend(context.institutionSS, {
            username: context.authenticated.username,
            role:     context.authenticated.role,
            action:   "Settled Restaurant Debt",
            details:  "Debt " + debtId + " settled."
        });

        return jsonResponse({
            success: true,
            debt: {
                debtId:      debtId,
                amountOwed:  newOwed,
                amountPaid:  newPaid,
                totalAmount: newTotal,
                status:      "settled",
                settledAt:   now.toISOString()
            }
        });

    } finally {
        lock.releaseLock();
    }

}


function restDeleteDebt(data) {

    const context = restAuthContext(data.institutionId, data.username);

    if (String(context.authenticated.role || "").toLowerCase() !== "director") {
        throw new Error("Only the Director can delete debts.");
    }

    const debtId = String(data.debtId || "").trim();

    if (!debtId) throw new Error("Debt ID is required.");

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {

        const sheet = context.institutionSS.getSheetByName("Restaurant Debts");

        if (!sheet) throw new Error("Restaurant Debts sheet not found.");

        const lastRow    = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();

        if (lastRow <= 1) throw new Error("Debt not found.");

        const values  = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
        const headers = values[0].map(function (h) { return String(h).trim(); });

        const debtIdIndex = headers.indexOf("debtId");

        if (debtIdIndex === -1) {
            throw new Error("Restaurant Debts sheet structure is invalid.");
        }

        let foundRow = -1;

        for (let i = 1; i < values.length; i++) {

            const rowId = String(values[i][debtIdIndex] || "").trim();

            if (rowId === debtId) { foundRow = i + 1; break; }

        }

        if (foundRow === -1) throw new Error("Debt not found.");

        sheet.deleteRow(foundRow);

        logActivityBackend(context.institutionSS, {
            username: context.authenticated.username,
            role:     context.authenticated.role,
            action:   "Deleted Restaurant Debt",
            details:  "Debt " + debtId + " deleted."
        });

        return jsonResponse({
            success: true,
            message: "Debt deleted successfully."
        });

    } finally {
        lock.releaseLock();
    }

}



// =====================================================
// RESTAURANT — Reports
// =====================================================

function restGetReports(data) {

    const context = restAuthContext(data.institutionId, data.username);

    const filterMonth  = String(data.month         || "").trim();
    const filterMethod = String(data.paymentMethod || "").trim();

    const sheet = context.institutionSS.getSheetByName("Restaurant Orders");

    const orders = [];

    if (sheet) {

        const lastRow    = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();

        if (lastRow > 1 && lastColumn > 0) {

            const values  = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
            const headers = restReadHeaders(sheet);

            const orderNumberIndex = headers.indexOf("orderNumber");
            const customerNameIndex= headers.indexOf("customerName");
            const customerPhoneIndex= headers.indexOf("customerPhone");
            const amountIndex      = headers.indexOf("subtotal");
            const methodIndex      = headers.indexOf("paymentMethod");
            const byIndex          = headers.indexOf("recordedBy");
            const dateIndex        = headers.indexOf("createdAt");

            values.forEach(function (row) {

                if (row.every(function (v) { return v === "" || v === null; })) return;

                let dateStr = "";
                const dateVal = row[dateIndex];

                if (dateVal instanceof Date) {
                    dateStr = dateVal.getFullYear() + "-" +
                        String(dateVal.getMonth() + 1).padStart(2, "0") + "-" +
                        String(dateVal.getDate()).padStart(2, "0");
                } else {
                    dateStr = String(dateVal || "").slice(0, 10);
                }

                const month = dateStr.slice(0, 7);
                const method = String(row[methodIndex] || "");

                if (filterMonth && month !== filterMonth) return;
                if (filterMethod && method.toLowerCase() !== filterMethod.toLowerCase()) return;

                orders.push({
                    orderNumber:   String(row[orderNumberIndex]  || ""),
                    customerName:  String(row[customerNameIndex] || ""),
                    customerPhone: String(row[customerPhoneIndex]|| ""),
                    amount:        Number(row[amountIndex]       || 0),
                    paymentMethod: method,
                    recordedBy:    String(row[byIndex]           || ""),
                    date:          dateStr,
                    month:         month
                });

            });

        }

    }

    let totalAmount = 0;
    const byMonth      = {};
    const byMethod     = {};
    const byDay        = {};

    orders.forEach(function (o) {

        totalAmount += o.amount;

        byMonth[o.month]   = byMonth[o.month]   || { orders: 0, total: 0 };
        byMethod[o.paymentMethod] = byMethod[o.paymentMethod] || { orders: 0, total: 0 };
        byDay[o.date]      = byDay[o.date]      || { orders: 0, total: 0 };

        byMonth[o.month].orders++;
        byMonth[o.month].total += o.amount;

        byMethod[o.paymentMethod].orders++;
        byMethod[o.paymentMethod].total += o.amount;

        byDay[o.date].orders++;
        byDay[o.date].total += o.amount;

    });

    const totalOrders = orders.length;
    const avgTicket   = totalOrders > 0 ? totalAmount / totalOrders : 0;

    let topMethod = "";
    let topMethodCount = 0;

    Object.keys(byMethod).forEach(function (m) {
        if (byMethod[m].orders > topMethodCount) {
            topMethodCount = byMethod[m].orders;
            topMethod = m;
        }
    });

    const monthRows = Object.keys(byMonth).sort().map(function (m) {
        return { month: m, orders: byMonth[m].orders, total: byMonth[m].total };
    });

    const methodRows = Object.keys(byMethod).sort().map(function (m) {
        return { method: m, orders: byMethod[m].orders, total: byMethod[m].total };
    });

    const dayRows = Object.keys(byDay).sort().map(function (d) {
        return { date: d, orders: byDay[d].orders, total: byDay[d].total };
    });

    return jsonResponse({
        success: true,
        totals: {
            totalOrders: totalOrders,
            totalAmount: totalAmount,
            avgTicket:   avgTicket,
            topMethod:   topMethod
        },
        byMonth:  monthRows,
        byMethod: methodRows,
        byDay:    dayRows,
        orders:   orders
    });

}


// =====================================================
// RESTAURANT — Change own password
// =====================================================

function restChangePassword(data) {

    const context       = restAuthContext(data.institutionId, data.username);
    const currentPass   = String(data.currentPassword || "");
    const newPassword   = String(data.newPassword     || "");

    if (!currentPass)  throw new Error("Current password is required.");
    if (!newPassword)  throw new Error("New password is required.");
    if (newPassword.length < 4) throw new Error("New password must be at least 4 characters.");

    const authSheet = context.masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");
    const usernameIndex      = headers.indexOf("username");
    const passwordIndex      = headers.indexOf("password");

    if (institutionIdIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();
        const rowUsername      = String(rows[i][usernameIndex]      || "").trim();
        const rowPassword      = String(rows[i][passwordIndex]      || "");

        if (
            rowInstitutionId === context.institution.id &&
            rowUsername.toLowerCase() === context.authenticated.username.toLowerCase()
        ) {

            if (rowPassword !== currentPass) {
                throw new Error("Current password is incorrect.");
            }

            authSheet.getRange(i + 1, passwordIndex + 1).setValue(newPassword);

            logActivityBackend(context.institutionSS, {
                username: context.authenticated.username,
                role:     context.authenticated.role,
                action:   "Changed Password",
                details:  "User changed own password."
            });

            return jsonResponse({
                success: true,
                message: "Password updated successfully."
            });

        }

    }

    throw new Error("User not found.");

}


// =====================================================
// RESTAURANT — Settings
// =====================================================

function restGetSettings(data) {

    const context = restAuthContext(data.institutionId, data.username);

    const settingsSheet = context.institutionSS.getSheetByName("School Settings");

    function readSetting(key) {
        if (!settingsSheet) return "";
        const lastRow = settingsSheet.getLastRow();
        if (lastRow <= 1) return "";
        const values = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
        for (let i = 0; i < values.length; i++) {
            if (String(values[i][0] || "").trim() === key) {
                return values[i][1];
            }
        }
        return "";
    }

    return jsonResponse({
        success: true,
        settings: {
            institutionId: context.institution.id,
            name:          context.institution.name  || "",
            phone:         context.institution.phone || "",
            email:         context.institution.email || "",
            currency:      readSetting("currency") || "MRU",
            logo:          readSetting("logo")     || "",
            licenseStart:  context.institution.licenseStart || "",
            licenseEnd:    context.institution.licenseEnd   || "",
            status:        context.institution.status       || ""
        }
    });

}


function restUpdateSettings(data) {

    const context = restAuthContext(data.institutionId, data.username);

    if (String(context.authenticated.role || "").toLowerCase() !== "director") {
        throw new Error("Only the Director can update restaurant settings.");
    }

    const name     = String(data.name     || "").trim();
    const phone    = String(data.phone    || "").trim();
    const email    = String(data.email    || "").trim();
    const currency = String(data.currency || "").trim();
    const logo     = String(data.logo     || "").trim();

    if (!name)     throw new Error("Restaurant name is required.");
    if (!currency) throw new Error("Currency is required.");

    let settingsSheet = context.institutionSS.getSheetByName("School Settings");

    if (!settingsSheet) {
        settingsSheet = context.institutionSS.insertSheet("School Settings");
        settingsSheet.appendRow(["key", "value", "updatedAt"]);
    }

    function saveSetting(key, value) {

        const lastRow = settingsSheet.getLastRow();

        if (lastRow > 1) {

            const rows = settingsSheet.getRange(2, 1, lastRow - 1, 1).getValues();

            for (let i = 0; i < rows.length; i++) {

                if (String(rows[i][0] || "").trim() === key) {
                    settingsSheet.getRange(i + 2, 2).setValue(value);
                    settingsSheet.getRange(i + 2, 3).setValue(new Date());
                    return;
                }

            }

        }

        settingsSheet.appendRow([key, value, new Date()]);

    }

    saveSetting("currency", currency);
    saveSetting("logo",     logo);

    function updateInstitutionInfo(field, value) {

        const infoSheet = context.institutionSS.getSheetByName("Institution Info");
        if (!infoSheet) return;

        const rows = infoSheet.getDataRange().getValues();

        for (let i = 0; i < rows.length; i++) {

            if (String(rows[i][0] || "").trim().toLowerCase() === field.toLowerCase()) {
                infoSheet.getRange(i + 1, 2).setValue(value);
                return;
            }

        }

        infoSheet.appendRow([field, value]);

    }

    updateInstitutionInfo("Name",     name);
    updateInstitutionInfo("Phone",    phone);
    updateInstitutionInfo("Email",    email);
    updateInstitutionInfo("Currency", currency);
    updateInstitutionInfo("Logo",     logo);

    const institutionsSheet = context.masterSS.getSheetByName("Institutions");

    if (institutionsSheet) {

        const rows = institutionsSheet.getDataRange().getValues();

        for (let i = 1; i < rows.length; i++) {

            const rowId = String(rows[i][0] || "").trim();

            if (rowId === context.institution.id) {

                institutionsSheet.getRange(i + 1, 3).setValue(name);
                institutionsSheet.getRange(i + 1, 4).setValue(phone);
                institutionsSheet.getRange(i + 1, 5).setValue(email);

                break;

            }

        }

    }

    logActivityBackend(context.institutionSS, {
        username: context.authenticated.username,
        role:     context.authenticated.role,
        action:   "Updated Restaurant Settings",
        details:  "Updated restaurant settings."
    });

    return jsonResponse({
        success: true,
        message: "Settings saved successfully.",
        settings: {
            institutionId: context.institution.id,
            name:          name,
            phone:         phone,
            email:         email,
            currency:      currency,
            logo:          logo
        }
    });

}


// =====================================================
// RESTAURANT — Users management (Director only)
// =====================================================

function restGetUsers(data) {

    const context = restAuthContext(data.institutionId, data.username);

    if (String(context.authenticated.role || "").toLowerCase() !== "director") {
        throw new Error("Only the Director can view users.");
    }

    const authSheet = context.masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");
    const usernameIndex      = headers.indexOf("username");
    const roleIndex          = headers.indexOf("role");
    const statusIndex        = headers.indexOf("status");
    const createdAtIndex     = headers.indexOf("createdAt");

    if (institutionIdIndex === -1 || usernameIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    const users = [];

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();

        if (rowInstitutionId !== context.institution.id) continue;

        users.push({
            username: String(rows[i][usernameIndex]  || ""),
            role:     String(rows[i][roleIndex]      || ""),
            status:   String(rows[i][statusIndex]    || ""),
            createdAt:
                rows[i][createdAtIndex] instanceof Date
                    ? rows[i][createdAtIndex].toISOString()
                    : String(rows[i][createdAtIndex] || "")
        });

    }

    return jsonResponse({ success: true, users: users });

}


function restAddUser(data) {

    const context = restAuthContext(data.institutionId, data.username);

    if (String(context.authenticated.role || "").toLowerCase() !== "director") {
        throw new Error("Only the Director can add users.");
    }

    const newUsername = String(data.newUsername || "").trim();
    const password    = String(data.password    || "");

    if (!newUsername) throw new Error("New username is required.");
    if (!password)    throw new Error("Password is required.");
    if (newUsername.length < 3) throw new Error("Username must be at least 3 characters.");
    if (password.length < 4)    throw new Error("Password must be at least 4 characters.");

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {

        const authSheet = context.masterSS.getSheetByName("Schools Authentication");

        if (!authSheet) throw new Error("Authentication sheet not found.");

        const rows    = authSheet.getDataRange().getValues();
        const headers = rows[0].map(function (h) { return String(h).trim(); });

        const usernameIndex = headers.indexOf("username");

        if (usernameIndex === -1) {
            throw new Error("Authentication sheet structure is invalid.");
        }

        for (let i = 1; i < rows.length; i++) {

            const existingUsername = String(rows[i][usernameIndex] || "").toLowerCase();

            if (existingUsername === newUsername.toLowerCase()) {
                throw new Error("This username is already in use.");
            }

        }

        const now = new Date();

        const newRow = new Array(headers.length).fill("");

        setColumnValue(newRow, headers, "institutionId", context.institution.id);
        setColumnValue(newRow, headers, "username",      newUsername);
        setColumnValue(newRow, headers, "password",      password);
        setColumnValue(newRow, headers, "role",          "User");
        setColumnValue(newRow, headers, "status",        "active");
        setColumnValue(newRow, headers, "createdAt",     now);

        authSheet.appendRow(newRow);

        logActivityBackend(context.institutionSS, {
            username: context.authenticated.username,
            role:     context.authenticated.role,
            action:   "Added User",
            details:  "Added user \"" + newUsername + "\"."
        });

        return jsonResponse({
            success: true,
            message: "User created successfully.",
            user: {
                username: newUsername,
                role:     "User",
                status:   "active"
            }
        });

    } finally {
        lock.releaseLock();
    }

}


function restChangeUserPassword(data) {

    const context = restAuthContext(data.institutionId, data.username);

    if (String(context.authenticated.role || "").toLowerCase() !== "director") {
        throw new Error("Only the Director can change another user's password.");
    }

    const targetUsername = String(data.targetUsername || "").trim();
    const newPassword    = String(data.newPassword    || "");

    if (!targetUsername) throw new Error("Target username is required.");
    if (!newPassword)    throw new Error("New password is required.");
    if (newPassword.length < 4) throw new Error("Password must be at least 4 characters.");

    const authSheet = context.masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");
    const usernameIndex      = headers.indexOf("username");
    const passwordIndex      = headers.indexOf("password");

    if (institutionIdIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();
        const rowUsername      = String(rows[i][usernameIndex]      || "").trim();

        if (
            rowInstitutionId === context.institution.id &&
            rowUsername.toLowerCase() === targetUsername.toLowerCase()
        ) {

            authSheet.getRange(i + 1, passwordIndex + 1).setValue(newPassword);

            logActivityBackend(context.institutionSS, {
                username: context.authenticated.username,
                role:     context.authenticated.role,
                action:   "Reset User Password",
                details:  "Reset password for user \"" + rowUsername + "\"."
            });

            return jsonResponse({
                success: true,
                message: "Password updated successfully."
            });

        }

    }

    throw new Error("User not found.");

}


function restEnableUser(data) {

    const context = restAuthContext(data.institutionId, data.username);

    if (String(context.authenticated.role || "").toLowerCase() !== "director") {
        throw new Error("Only the Director can enable users.");
    }

    const targetUsername = String(data.targetUsername || "").trim();

    if (!targetUsername) throw new Error("Target username is required.");

    const authSheet = context.masterSS.getSheetByName("Schools Authentication");

    if (!authSheet) throw new Error("Authentication sheet not found.");

    const rows    = authSheet.getDataRange().getValues();
    const headers = rows[0].map(function (h) { return String(h).trim(); });

    const institutionIdIndex = headers.indexOf("institutionId");
    const usernameIndex      = headers.indexOf("username");
    const statusIndex        = headers.indexOf("status");
    const roleIndex          = headers.indexOf("role");

    if (institutionIdIndex === -1 || usernameIndex === -1 || statusIndex === -1) {
        throw new Error("Authentication sheet structure is invalid.");
    }

    for (let i = 1; i < rows.length; i++) {

        const rowInstitutionId = String(rows[i][institutionIdIndex] || "").trim();
        const rowUsername      = String(rows[i][usernameIndex]      || "").trim();
        const rowRole          = String(rows[i][roleIndex]          || "").trim();

        if (
            rowInstitutionId === context.institution.id &&
            rowUsername.toLowerCase() === targetUsername.toLowerCase()
        ) {

            if (rowRole.toLowerCase() === "director") {
                throw new Error("The Director account is already active.");
            }

            authSheet.getRange(i + 1, statusIndex + 1).setValue("active");

            logActivityBackend(context.institutionSS, {
                username: context.authenticated.username,
                role:     context.authenticated.role,
                action:   "Enabled User",
                details:  "Enabled user \"" + rowUsername + "\"."
            });

            return jsonResponse({
                success: true,
                message: "User enabled successfully."
            });

        }

    }

    throw new Error("User not found.");

}


// =====================================================
// SETUP — Restaurant spreadsheet on creation
// =====================================================

function setupRestaurantSpreadsheet(spreadsheet, institution) {

    // ---- Institution Info ----
    const firstSheet = spreadsheet.getSheets()[0];
    firstSheet.setName("Institution Info");
    firstSheet.clear();

    firstSheet.getRange("A1:B10").setValues([
        ["Field",             "Value"],
        ["Institution ID",    institution.id],
        ["Type",              institution.type],
        ["Name",              institution.name],
        ["Phone",             institution.phone],
        ["Email",             institution.email],
        ["License Start",     institution.licenseStart],
        ["License End",       institution.licenseEnd],
        ["Status",            "active"],
        ["Director Username", institution.username]
    ]);

    // ---- Users ----
    const usersSheet = spreadsheet.insertSheet("Users");
    usersSheet.appendRow([
        "userId",
        "username",
        "role",
        "status",
        "createdAt",
        "permissions"
    ]);
    usersSheet.appendRow([
        "USR-001",
        institution.username,
        "Director",
        "active",
        new Date(),
        JSON.stringify({
            orders:      true,
            debts:       true,
            reports:     true,
            settings:    true,
            manageUsers: true
        })
    ]);

    // ---- Restaurant Orders (lazy-built, but create the header now) ----
    const ordersSheet = spreadsheet.insertSheet("Restaurant Orders");
    ordersSheet.appendRow([
        "orderId",
        "orderNumber",
        "customerName",
        "customerPhone",
        "subtotal",
        "paymentMethod",
        "recordedBy",
        "createdAt"
    ]);

    // ---- Restaurant Debts ----
    const debtsSheet = spreadsheet.insertSheet("Restaurant Debts");
    debtsSheet.appendRow([
        "debtId",
        "customerName",
        "customerPhone",
        "amountOwed",
        "amountPaid",
        "totalAmount",
        "status",
        "notes",
        "recordedBy",
        "createdAt",
        "settledAt"
    ]);

    // ---- Activity Logs ----
    const logsSheet = spreadsheet.insertSheet("Activity Logs");
    logsSheet.appendRow([
        "logId",
        "username",
        "role",
        "action",
        "details",
        "date"
    ]);

}

