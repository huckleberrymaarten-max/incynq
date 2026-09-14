// ============================================================
// InCynq_Greeter.lsl v3.0
// - Touch to open owner menu
// - Test button: sends a fresh greeting to owner each touch
// - Hover text: object name, on/off status, range
// - Hover text toggle
// - Whitelist notecard (avatar name or UUID per line — greeter ignores them)
// - Settings persist via llLinksetDataWrite (survive resets)
// ============================================================

integer MSG_READY   = 9102;
integer MSG_AD      = 100;
integer MSG_DONE    = 101;
integer MSG_REQUEST = 200;

// ---- Persisted settings ----
integer gActive    = TRUE;
float   gRange     = 10.0;
integer gCooldown  = 1200;   // seconds
integer gShowHover = TRUE;

// ---- Runtime ----
integer gReady = FALSE;
integer gBusy  = FALSE;

list    gSeen    = [];       // [uuid_str, timestamp, ...]
integer MAX_SEEN = 40;

list    gQueue       = [];   // [uuid_str, display_name, ...]
key     gPendingKey  = NULL_KEY;
string  gPendingName = "";

// ---- Whitelist ----
list    gWhitelist = [];
integer gLoadingWL = FALSE;
integer gWLLine    = 0;
key     gWLQuery   = NULL_KEY;
integer gWLReady   = FALSE;   // TRUE once whitelist is loaded or confirmed missing

// ---- Menu ----
string  gOwnerName   = "";     // captured at touch_start via llDetectedName
integer gTestMode    = FALSE;  // TRUE while a test greeting is running
integer gMenuChannel = 0;
integer gMenuHandle  = 0;
key     gMenuAv      = NULL_KEY;

// ============================================================
// Helpers
// ============================================================

string Replace(string src, string from, string to)
{
    return llDumpList2String(llParseString2List(src, [from], []), to);
}

UpdateHoverText()
{
    if (!gShowHover)
    {
        llSetText("", ZERO_VECTOR, 0.0);
        return;
    }
    if (!gActive)
    {
        llSetText("InCynq Greeter\nOFF", <1.0, 0.0, 0.0>, 1.0);
        return;
    }
    string cd = (string)(gCooldown / 60) + " min cooldown";
    llSetText(
        "InCynq Greeter\n● ON  |  Range: " + (string)((integer)gRange) + "m\n" + cd,
        <0.0, 0.85, 1.0>, 1.0
    );
}

SaveSettings()
{
    llLinksetDataWrite("icg_active",    (string)gActive);
    llLinksetDataWrite("icg_range",     (string)gRange);
    llLinksetDataWrite("icg_cooldown",  (string)gCooldown);
    llLinksetDataWrite("icg_hovertext", (string)gShowHover);
}

LoadSettings()
{
    string v;
    v = llLinksetDataRead("icg_active");    if (v != "") gActive    = (integer)v;
    v = llLinksetDataRead("icg_range");     if (v != "") gRange     = (float)v;
    v = llLinksetDataRead("icg_cooldown");  if (v != "") gCooldown  = (integer)v;
    v = llLinksetDataRead("icg_hovertext"); if (v != "") gShowHover = (integer)v;
}

StartSensor()
{
    if (!gReady)   return;   // engine not ready yet
    if (!gWLReady) return;   // whitelist not loaded yet
    if (gActive)
        llSensorRepeat("", NULL_KEY, AGENT, gRange, PI, 5.0);
    else
        llSensorRemove();
}

integer OnCooldown(key id)
{
    integer i = llListFindList(gSeen, [(string)id]);
    if (i == -1) return FALSE;
    integer t = llList2Integer(gSeen, i + 1);
    if (llGetUnixTime() - t < gCooldown) return TRUE;
    gSeen = llDeleteSubList(gSeen, i, i + 1);
    return FALSE;
}

SetCooldown(key id)
{
    integer i = llListFindList(gSeen, [(string)id]);
    if (i != -1)
    {
        gSeen = llListReplaceList(gSeen, [llGetUnixTime()], i + 1, i + 1);
        return;
    }
    gSeen += [(string)id, llGetUnixTime()];
    if (llGetListLength(gSeen) > MAX_SEEN * 2)
        gSeen = llDeleteSubList(gSeen, 0, 1);
}

integer IsWhitelisted(key id, string name)
{
    if (llListFindList(gWhitelist, [(string)id]) != -1) return TRUE;
    if (llListFindList(gWhitelist, [name])        != -1) return TRUE;
    return FALSE;
}

ProcessQueue()
{
    if (gBusy)           return;
    if (!gReady)         return;
    if (!llGetListLength(gQueue)) return;
    gPendingKey  = (key)llList2String(gQueue, 0);
    gPendingName = llList2String(gQueue, 1);
    gQueue       = llDeleteSubList(gQueue, 0, 1);
    gBusy        = TRUE;
    llMessageLinked(LINK_SET, MSG_REQUEST, "REQUEST_GREETING", NULL_KEY);
}

LoadWhitelist()
{
    gWhitelist = [];
    gWLReady   = FALSE;
    if (llGetInventoryType("Whitelist") != INVENTORY_NOTECARD)
    {
        llOwnerSay("ℹ️ No Whitelist notecard found — all avatars will be greeted.");
        gWLReady = TRUE;
        StartSensor();
        return;
    }
    gWLLine    = 0;
    gLoadingWL = TRUE;
    gWLQuery   = llGetNotecardLine("Whitelist", 0);
}

// ---- Menu ----

CloseMenu()
{
    llSetTimerEvent(0.0);
    if (gMenuHandle) { llListenRemove(gMenuHandle); gMenuHandle = 0; }
}

OpenMenu(key av)
{
    CloseMenu();
    gMenuAv      = av;
    gMenuChannel = (integer)(llFrand(99999.0) * -1) - 1000;
    gMenuHandle  = llListen(gMenuChannel, "", av, "");
    llSetTimerEvent(30.0);

    string activeBtn;
    if (gActive) activeBtn = "● Turn OFF";
    else         activeBtn = "○ Turn ON";

    string hoverBtn;
    if (gShowHover) hoverBtn = "Hide Hover";
    else            hoverBtn = "Show Hover";

    string activeStatus;
    if (gActive) activeStatus = "ON ✅";
    else         activeStatus = "OFF ⭕";

    llDialog(av,
        "━━━━ InCynq Greeter ━━━━\n\n" +
        "Status: "   + activeStatus + "\n" +
        "Range: "    + (string)((integer)gRange) + "m\n" +
        "Cooldown: " + (string)(gCooldown / 60) + " min",
        [activeBtn, "Range", "Cooldown",
         "Test", hoverBtn,  "Close"],
        gMenuChannel);
}

OpenRangeMenu(key av)
{
    CloseMenu();
    gMenuAv      = av;
    gMenuChannel = (integer)(llFrand(99999.0) * -1) - 1000;
    gMenuHandle  = llListen(gMenuChannel, "", av, "");
    llSetTimerEvent(30.0);
    llDialog(av,
        "━━━━ InCynq Greeter ━━━━\n\nSelect sensor range.\nCurrent: " +
        (string)((integer)gRange) + "m\n\nPage 1 of 2",
        ["5m", "10m", "12m", "15m", "20m", "25m",
         "30m", "◀ Back", "More ▶"],
        gMenuChannel);
}

OpenRangeMenu2(key av)
{
    CloseMenu();
    gMenuAv      = av;
    gMenuChannel = (integer)(llFrand(99999.0) * -1) - 1000;
    gMenuHandle  = llListen(gMenuChannel, "", av, "");
    llSetTimerEvent(30.0);
    llDialog(av,
        "━━━━ InCynq Greeter ━━━━\n\nSelect sensor range.\nCurrent: " +
        (string)((integer)gRange) + "m\n\nPage 2 of 2",
        ["35m", "40m", "45m", "50m", "96m",
         "◀ Back", "◀◀ Prev"],
        gMenuChannel);
}

OpenCooldownMenu(key av)
{
    CloseMenu();
    gMenuAv      = av;
    gMenuChannel = (integer)(llFrand(99999.0) * -1) - 1000;
    gMenuHandle  = llListen(gMenuChannel, "", av, "");
    llSetTimerEvent(30.0);
    llDialog(av,
        "━━━━ InCynq Greeter ━━━━\n\nHow long before the same avatar is greeted again?\nCurrent: " +
        (string)(gCooldown / 60) + " min",
        ["10 min", "20 min", "30 min", "60 min", "◀ Back"],
        gMenuChannel);
}

// ============================================================
// Main
// ============================================================

default
{
    state_entry()
    {
        LoadSettings();
        llSetText("InCynq Greeter\n⏳ Loading — please wait...", <1.0, 1.0, 0.0>, 1.0);
        LoadWhitelist();
        // Sensor starts after whitelist loaded (see dataserver)
    }

    link_message(integer s, integer num, string msg, key id)
    {
        if (num == MSG_READY)
        {
            gReady = TRUE;
            gBusy  = FALSE;
            UpdateHoverText();
            llOwnerSay("✅ Greeter is live — welcoming visitors.");
            StartSensor();
            ProcessQueue();
            return;
        }

        if (num == MSG_AD)
        {
            if (!gBusy) return;
            string greeting = Replace(msg, "{name}", gPendingName);
            if (llStringLength(llStringTrim(greeting, STRING_TRIM)) > 0)
                llInstantMessage(gPendingKey, greeting);
            return;
        }

        if (num == MSG_DONE)
        {
            gTestMode = FALSE;
            gBusy     = FALSE;
            ProcessQueue();
        }
    }

    touch_start(integer n)
    {
        key toucher = llDetectedKey(0);
        if (toucher != llGetOwner()) return;
        gOwnerName = llDetectedName(0);   // reliable here
        OpenMenu(toucher);
    }

    listen(integer channel, string name, key id, string msg)
    {
        if (channel != gMenuChannel) return;
        if (id != llGetOwner())      return;

        CloseMenu();

        if (msg == "Close") return;

        // ---- Toggle active ----
        if (msg == "● Turn OFF" || msg == "○ Turn ON")
        {
            gActive = !gActive;
            SaveSettings();
            UpdateHoverText();
            StartSensor();
            string activeMsg;
            if (gActive) activeMsg = "ON ✅";
            else         activeMsg = "OFF ⭕";
            llOwnerSay("InCynq Greeter: " + activeMsg);
            OpenMenu(id);
            return;
        }

        // ---- Toggle hover text ----
        if (msg == "Show Hover" || msg == "Hide Hover")
        {
            gShowHover = !gShowHover;
            SaveSettings();
            UpdateHoverText();
            OpenMenu(id);
            return;
        }

        // ---- Submenus ----
        if (msg == "Range")    { OpenRangeMenu(id);    return; }
        if (msg == "Cooldown") { OpenCooldownMenu(id); return; }

        // ---- Test ----
        if (msg == "Test")
        {
            if (!gReady)
            {
                llOwnerSay("⚠️ Engine not ready yet — wait for all notecards to load.");
                OpenMenu(id);
                return;
            }
            if (gBusy)
            {
                llOwnerSay("⚠️ Engine is busy — try again in a moment.");
                OpenMenu(id);
                return;
            }
            // Bypass queue and sensor entirely — send straight to owner
            string testName = gOwnerName;
            if (testName == "") testName = "there";
            gTestMode    = TRUE;
            gBusy        = TRUE;
            gPendingKey  = llGetOwner();
            gPendingName = testName;
            llMessageLinked(LINK_SET, MSG_REQUEST, "REQUEST_GREETING", NULL_KEY);
            llOwnerSay("📨 Test greeting incoming — check your IMs.");
            OpenMenu(id);
            return;
        }

        // ---- Range picks ----
        if (msg == "5m")  { gRange =  5.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "10m") { gRange = 10.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "12m") { gRange = 12.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "15m") { gRange = 15.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "20m") { gRange = 20.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "25m") { gRange = 25.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "30m") { gRange = 30.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "35m") { gRange = 35.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "40m") { gRange = 40.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "45m") { gRange = 45.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "50m") { gRange = 50.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }
        if (msg == "96m") { gRange = 96.0; SaveSettings(); UpdateHoverText(); StartSensor(); OpenMenu(id); return; }

        // ---- Range page navigation ----
        if (msg == "More ▶")  { OpenRangeMenu2(id); return; }
        if (msg == "◀◀ Prev") { OpenRangeMenu(id);  return; }

        // ---- Cooldown picks ----
        if (msg == "10 min") { gCooldown =  600; SaveSettings(); OpenMenu(id); return; }
        if (msg == "20 min") { gCooldown = 1200; SaveSettings(); OpenMenu(id); return; }
        if (msg == "30 min") { gCooldown = 1800; SaveSettings(); OpenMenu(id); return; }
        if (msg == "60 min") { gCooldown = 3600; SaveSettings(); OpenMenu(id); return; }

        // ---- Back ----
        if (msg == "◀ Back") { OpenMenu(id); return; }
    }

    timer()
    {
        CloseMenu();
    }

    dataserver(key q, string data)
    {
        if (!gLoadingWL)   return;
        if (q != gWLQuery) return;

        if (data == EOF)
        {
            gLoadingWL = FALSE;
            gWLReady   = TRUE;
            llOwnerSay("📋 Whitelist — " + (string)llGetListLength(gWhitelist) + " entries loaded.");
            StartSensor();
            return;
        }
        string entry = llStringTrim(data, STRING_TRIM);
        if (llStringLength(entry) > 0 && llGetSubString(entry, 0, 0) != "#")
            gWhitelist += [entry];
        gWLLine++;
        gWLQuery = llGetNotecardLine("Whitelist", gWLLine);
    }

    sensor(integer n)
    {
        if (!gReady)  return;
        if (!gActive) return;
        integer i;
        for (i = 0; i < n; i++)
        {
            key    av = llDetectedKey(i);
            string nm = llDetectedName(i);
            if (av == llGetOwner())    jump skip;
            if (IsWhitelisted(av, nm)) jump skip;
            if (OnCooldown(av))        jump skip;
            SetCooldown(av);
            gQueue += [(string)av, nm];
            @skip;
        }
        ProcessQueue();
    }

    no_sensor() { }

    changed(integer change)
    {
        if (change & CHANGED_INVENTORY)
        {
            gReady = FALSE;
            llSetText("InCynq Greeter\n⏳ Reloading — please wait...", <1.0, 1.0, 0.0>, 1.0);
            LoadWhitelist();
        }
    }
}
