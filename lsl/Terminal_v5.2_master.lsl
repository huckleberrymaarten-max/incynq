// ═══════════════════════════════════════════════════════════════
// InCynq Activation Terminal v5.2 — MASTER COPY
//
// INSTALL_TOKEN is set to placeholder ICQ-XXXXXXXX
// Before rezzing a live device:
//   1. Generate a fresh token in Supabase
//   2. Replace ICQ-XXXXXXXX with that token
//   3. Rez — registers automatically
//
// Permissions:
//  Object: No-Mod, No-Copy, Transfer
//  Script: No-Mod, No-Copy, No-Transfer
// ═══════════════════════════════════════════════════════════════

// ───────── VERSION ─────────
string SCRIPT_VERSION = "5.2";

// ───────── CONFIG ─────────
string WEBHOOK_URL   = "https://muzzjvegynsemlsbwggf.supabase.co/functions/v1/sl-webhook";
string INSTALL_TOKEN = "ICQ-XXXXXXXX";  // ⚠️ Replace with a fresh token before rezzing

// Static body texture (face 0) — set on startup, never changes dynamically
key TEX_BODY        = "d937b0ba-99b4-c5a3-f0ec-5c74f24086d1";
key TEX_SHADOW      = "82acdf94-4032-4a9a-16f2-a4e2b19e7aa7";  // Face 2 — ground shadow

// Texture UUIDs — loaded from Supabase on startup via texture push system
key TEX_IDLE        = "65a7ad3a-e7a8-622c-0a53-537339b76298";
key TEX_ENTER_CODE  = "21364837-9cae-966d-8887-b57db60da032";
key TEX_PROCESSING  = "a4604240-6531-d88b-a6fc-2a85204c300b";
key TEX_ACTIVATED   = "958ecb61-ca7c-e351-8e9f-70780066339c";
key TEX_MAINTENANCE = "41d09fd5-d14a-463c-a2c9-379710635d87";

integer DISPLAY_LINK  = 0;
integer SCREEN_FACE   = 2;

// ───────── State ─────────
key     gPendingHTTP;
key     gToucherKey;
string  gToucherName;
integer gListenHandle  = -1;
integer gChatChannel;
integer gRegistered    = FALSE;
// TRUE only when the SERVER rejected our token (bad / used / wrong type).
// Retrying that is pointless, so we stop and say so. Network failures leave
// this FALSE and keep retrying — see timer().
integer gTokenRejected = FALSE;
integer gStatusTick    = 0;     // 2-min tick counter for status check
integer gMaintenance   = FALSE;
string  gCurrentAction = "";
vector  gLastPos       = ZERO_VECTOR;
rotation gLastRot      = ZERO_ROTATION;

// ───────── Helpers ─────────
string jsonEscape(string s) {
    string out = "";
    integer i;
    integer len = llStringLength(s);
    for (i = 0; i < len; i++) {
        string c = llGetSubString(s, i, i);
        if (c == "\"")      out += "\\\"";
        else if (c == "\\") out += "\\\\";
        else                out += c;
    }
    return out;
}

string buildBody(string action, list extras) {
    string body = "{\"action\":\"" + action + "\"";
    integer i;
    integer n = llGetListLength(extras);
    for (i = 0; i < n; i += 2) {
        string k = llList2String(extras, i);
        string v = llList2String(extras, i + 1);
        if ((string)((integer)v) == v && v != "")
            body += ",\"" + k + "\":" + v;
        else
            body += ",\"" + k + "\":\"" + jsonEscape(v) + "\"";
    }
    return body + "}";
}

sendWebhook(string action, list payload) {
    gCurrentAction = action;
    gPendingHTTP   = llHTTPRequest(WEBHOOK_URL, [
        HTTP_METHOD,         "POST",
        HTTP_MIMETYPE,       "application/json",
        HTTP_BODY_MAXLENGTH, 16384,
        HTTP_VERIFY_CERT,    TRUE,
        HTTP_CUSTOM_HEADER,  "X-InCynq-Source",      "lsl",
        HTTP_CUSTOM_HEADER,  "X-InCynq-Object-UUID", (string)llGetKey(),
        HTTP_CUSTOM_HEADER,  "X-InCynq-Timestamp",   (string)llGetUnixTime(),
        HTTP_CUSTOM_HEADER,  "X-InCynq-Region",      llGetRegionName()
    ], buildBody(action, payload));
}

setTex(key tex) {
    llSetLinkTexture(DISPLAY_LINK, tex, 1);
}

setScreenTex(key tex) {
    llSetLinkTexture(DISPLAY_LINK, tex, 1);
}

setFloat(string text, vector col) {
    llSetText(text, col, 1.0);
}

clearFloat() {
    llSetText("", <0,0,0>, 0.0);
}


// ───────── Why did the request fail? ─────────
// Every failure used to read "Connection error", so a dead webhook, an expired
// install token and a genuine network blip were indistinguishable. That turned
// a backend outage into three weeks of guesswork.
string httpReason(integer status) {
    if (status == 503) return "Service unavailable";
    if (status == 502) return "Server error";
    if (status == 504) return "Server timed out";
    if (status == 500) return "Server error";
    if (status == 401) return "Not authorised";
    if (status == 403) return "Access denied";
    if (status == 404) return "Service not found";
    if (status == 499) return "Request timed out";
    if (status == 0)   return "No response";
    return "Connection error (" + (string)status + ")";
}

// ───────── Version check ─────────
checkScriptVersion() {
    string myName = llGetScriptName();
    float  myVer  = (float)SCRIPT_VERSION;
    integer i;
    integer count = llGetInventoryNumber(INVENTORY_SCRIPT);
    for (i = 0; i < count; i++) {
        string name = llGetInventoryName(INVENTORY_SCRIPT, i);
        if (name != myName && llSubStringIndex(name, "InCynq Terminal v") == 0) {
            string verStr = llGetSubString(name, 28, -1);
            float  ver    = (float)verStr;
            if (ver > myVer) {
                llOwnerSay("Terminal Newer version (" + name + ") detected. Removing v" + SCRIPT_VERSION + ".");
                llRemoveInventory(myName);
                return;
            }
        }
    }
}

// ───────── Maintenance mode ─────────
goMaintenance() {
    gMaintenance = TRUE;
    setTex(TEX_MAINTENANCE);
    setFloat("Terminal Offline\nMaintenance in progress", <1.0, 0.3, 0.3>);
    if (gListenHandle != -1) { llListenRemove(gListenHandle); gListenHandle = -1; }
    syncTimer();   // Keep status check running during maintenance
}

// ───────── States ─────────
goIdle() {
    if (gListenHandle != -1) { llListenRemove(gListenHandle); gListenHandle = -1; }
    gToucherKey    = NULL_KEY;
    gToucherName   = "";
    gCurrentAction = "";
    if (gRegistered) syncTimer(); else llSetTimerEvent(0.0);
    if (gRegistered && !gMaintenance) {
        setTex(TEX_IDLE);
        clearFloat();
    }
}

showError(string msg) {
    setFloat("Error: " + msg, <1.0, 0.4, 0.4>);
    setTex(TEX_IDLE);
    llSleep(4.0);
    goIdle();
}

showSuccess(string avatarName) {
    setTex(TEX_ACTIVATED);
    setFloat("Welcome, " + avatarName + "!", <0.0, 0.9, 0.4>);
    llSleep(5.0);
    goIdle();
}

// ───────── Position/rotation change check ─────────
checkPositionChanged() {
    if (!gRegistered) return;
    vector   curPos = llGetPos();
    rotation curRot = llGetRot();
    if (llVecDist(curPos, gLastPos) > 0.1 || llAngleBetween(curRot, gLastRot) > 0.01) {
        llOwnerSay("[InCynq] Position/rotation changed — re-registering...");
        selfRegister();
    }
}


// ───────── Maintenance status check ─────────
checkMaintenanceStatus() {
    sendWebhook("check_status", [
        "device_uuid", (string)llGetKey()
    ]);
}

// ───────── Sync timer to 2-minute boundary ─────────
syncTimer() {
    integer now = llGetUnixTime();
    integer nextTick = 120 - (now % 120);
    if (nextTick < 5) nextTick += 120;  // avoid firing immediately
    llSetTimerEvent((float)nextTick);
}

// ───────── Registration ─────────
selfRegister() {
    // ⚠️ Placeholder check — do not register master copy
    if (INSTALL_TOKEN == "ICQ-XXXXXXXX") {
        setFloat("Master copy — no token set.\nEdit INSTALL_TOKEN before rezzing.", <1.0, 0.5, 0.0>);
        llOwnerSay("[InCynq] Master copy detected. Replace INSTALL_TOKEN with a real token before rezzing.");
        gTokenRejected = TRUE;   // unconfigured master copy — don't retry forever
        return;
    }
    llSetLinkTexture(DISPLAY_LINK, TEX_BODY, 0);
    llSetLinkTexture(DISPLAY_LINK, TEX_SHADOW, 2);
    setFloat("Connecting to InCynq...", <1.0, 0.8, 0.0>);
    sendWebhook("register_device", [
        "install_token", INSTALL_TOKEN,
        "device_uuid",   (string)llGetKey(),
        "device_type",   "terminal",
        "device_name",   llGetObjectName(),
        "region",        llGetRegionName(),
        "version",       SCRIPT_VERSION,
        "owner_name",    llKey2Name(llGetOwner()),
        "pos_x",         (string)llGetPos(),
        "rot_z",         (string)llRot2Euler(llGetRot())
    ]);
}

// ───────── Activation flow ─────────
askForCode(key avatar) {
    gToucherKey  = avatar;
    gToucherName = llKey2Name(avatar);
    gChatChannel = -((integer)llFrand(1000000) + 100000);
    if (gListenHandle != -1) llListenRemove(gListenHandle);
    gListenHandle = llListen(gChatChannel, "", avatar, "");
    setScreenTex(TEX_ENTER_CODE);
    setFloat("Waiting for " + gToucherName, <0.4, 0.7, 1.0>);
    llRegionSayTo(avatar, 0,
        "InCynq Activation\n\n" +
        "1. Open your InCynq app\n" +
        "2. Find your activation code (ICQ-XXXXXX)\n" +
        "3. Enter it in the box that just opened\n\n" +
        "Code expires after 24 hours."
    );
    llTextBox(avatar, "Enter your InCynq activation code:", gChatChannel);
    llSetTimerEvent(90.0);
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
default {
    state_entry() {
        gRegistered  = FALSE;
        gMaintenance = FALSE;
        selfRegister();
        gStatusTick = 0;
        syncTimer();   // Sync to 2-min boundary
    }

    on_rez(integer start_param) {
        llResetScript();
    }

    changed(integer change) {
        if (change & CHANGED_OWNER)     { llOwnerSay("Terminal Ownership changed. Re-registering."); llResetScript(); }
        if (change & CHANGED_INVENTORY) { checkScriptVersion(); }
        if (change & CHANGED_REGION)    { llOwnerSay("Terminal Region changed. Re-registering."); llResetScript(); }
    }

    touch_start(integer n) {
        key toucher = llDetectedKey(0);
        if (!gRegistered) {
            llRegionSayTo(toucher, 0, "Terminal is starting up. Please try again in a moment.");
            return;
        }
        if (gMaintenance) {
            llRegionSayTo(toucher, 0, "The InCynq Terminal is currently offline for maintenance. Please try again later.");
            return;
        }
        if (gToucherKey != NULL_KEY) {
            llRegionSayTo(toucher, 0, "Terminal is busy with " + gToucherName + ". Please wait.");
            return;
        }
        askForCode(toucher);
    }

    listen(integer channel, string name, key id, string message) {
        if (channel != gChatChannel || id != gToucherKey) return;
        string code = llToUpper(llStringTrim(message, STRING_TRIM));
        if (llStringLength(code) != 10 || llSubStringIndex(code, "ICQ-") != 0) {
            llRegionSayTo(gToucherKey, 0, "Invalid code format. Codes look like ICQ-X8K3R7.\nTouch the terminal to retry.");
            goIdle();
            return;
        }
        setScreenTex(TEX_PROCESSING);
        setFloat("Activating " + gToucherName + "...", <0.4, 0.7, 1.0>);
        sendWebhook("activate", [
            "code",          code,
            "terminal_uuid", (string)llGetKey(),
            "avatar_uuid",   (string)gToucherKey,
            "avatar_name",   gToucherName
        ]);
    }

    timer() {
        // Not registered yet — retry on the tick instead of sitting dead until
        // somebody resets the script by hand. A failed registration used to be
        // terminal: selfRegister() only ran on state_entry, so after the Aug/Sep
        // webhook outage the whole fleet had to be reset manually.
        if (!gRegistered) {
            syncTimer();
            if (!gTokenRejected) selfRegister();
            return;
        }
        // Session timeout
        if (gToucherKey != NULL_KEY && gCurrentAction == "") {
            llRegionSayTo(gToucherKey, 0, "Activation timeout. Touch the terminal to retry.");
            goIdle();
            return;
        }
        // Sync timer to next 2-min boundary
        syncTimer();
        // Status check — skip if mid-transaction
        gStatusTick++;
        if (gToucherKey == NULL_KEY) checkMaintenanceStatus();
        // Position check every 60 minutes (30 ticks x 2 min)
        if (gStatusTick >= 30) {
            gStatusTick = 0;
            checkPositionChanged();
        }
    }

    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id != gPendingHTTP) return;
        gPendingHTTP = NULL_KEY;

        if (status != 200) {
            string why = httpReason(status);
            llOwnerSay("Terminal HTTP " + (string)status + ": " + body);
            if (gToucherKey != NULL_KEY)
                llRegionSayTo(gToucherKey, 0, why + ". Please try again.");
            if (!gRegistered) setFloat(why + "\nRetrying every 2 min...", <1.0, 0.6, 0.0>);
            else showError(why);
            goIdle();
            return;
        }

        integer ok = (llSubStringIndex(body, "\"success\":true") != -1);

        if (gCurrentAction == "register_device") {
            if (ok) {
                gRegistered = TRUE;
                string texIdle  = llJsonGetValue(body, ["textures", "idle"]);
                string texScr   = llJsonGetValue(body, ["textures", "screen"]);
                string texPaid  = llJsonGetValue(body, ["textures", "paid"]);
                string texMaint = llJsonGetValue(body, ["textures", "maintenance"]);
                if (llStringLength(texIdle)  > 5) TEX_IDLE        = (key)texIdle;
                if (texScr   != JSON_INVALID && texScr   != "") { TEX_ENTER_CODE = (key)texScr; TEX_PROCESSING = (key)texScr; }
                if (texPaid  != JSON_INVALID && texPaid  != "") TEX_ACTIVATED   = (key)texPaid;
                if (texMaint != JSON_INVALID && texMaint != "") TEX_MAINTENANCE  = (key)texMaint;
                integer maint = (llSubStringIndex(body, "maintenance") != -1 && llSubStringIndex(body, "false") == -1);
                if (maint) { goMaintenance(); return; }
                gLastPos = llGetPos();
                gLastRot = llGetRot();
                llOwnerSay("Terminal v" + SCRIPT_VERSION + " registered.");
                goIdle();
            } else {
                string err = llJsonGetValue(body, ["error"]);
                llOwnerSay("Terminal Registration refused: " + err);
                // The server answered and said no — a bad, used or wrong-type
                // token. Retrying cannot fix that, so stop and show why.
                gTokenRejected = TRUE;
                setFloat(err, <1.0, 0.3, 0.3>);
            }
            return;
        }

        if (gCurrentAction == "activate") {
            if (ok) {
                string welcomeCredit = llJsonGetValue(body, ["welcome_credit"]);
                string referralPaid  = llJsonGetValue(body, ["referral_paid"]);
                string referralLine  = "";
                if (referralPaid == "true") referralLine = "Your referrer was rewarded!\n";
                llRegionSayTo(gToucherKey, 0,
                    "Account activated! Welcome to InCynq, " + gToucherName + ".\n" +
                    "You received " + welcomeCredit + " L$ welcome credit.\n" +
                    referralLine +
                    "Open your app to get started!"
                );
                showSuccess(gToucherName);
                gToucherKey    = NULL_KEY;
                gCurrentAction = "";
                if (gListenHandle != -1) { llListenRemove(gListenHandle); gListenHandle = -1; }
            } else {
                string err = llJsonGetValue(body, ["error"]);
                llRegionSayTo(gToucherKey, 0, err + "\nTouch the terminal to try again.");
                showError(err);
                gToucherKey    = NULL_KEY;
                gCurrentAction = "";
                if (gListenHandle != -1) { llListenRemove(gListenHandle); gListenHandle = -1; }
            }
            return;
        }

        // ── CHECK STATUS ──
        if (gCurrentAction == "check_status") {
            integer maint = (llSubStringIndex(body, "maintenance") != -1 && llSubStringIndex(body, "false") == -1);
            if (maint && !gMaintenance) {
                // Say so. Going quiet is exactly when the owner most needs to
                // know — twelve devices silently pausing is how maintenance got
                // left on for an afternoon.
                llOwnerSay("[InCynq] Maintenance mode enabled — pausing.");
                goMaintenance();
            } else if (!maint && gMaintenance) {
                gMaintenance = FALSE;
                llOwnerSay("[InCynq] Maintenance mode disabled — resuming.");
                goIdle();
            }
            return;
        }
    }
}
