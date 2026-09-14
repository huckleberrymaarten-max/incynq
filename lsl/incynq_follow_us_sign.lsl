// InCynq Follow Us Sign v1.0
// Set the object DESCRIPTION to your InCynq username (e.g. lisbeth.placebo)
// Visitors who click are taken to your brand profile on InCynq.
// Owner touch opens the settings menu.

string INCYNQ_BASE_URL = "https://incynq.app/brand/";
string SIGN_TEXTURE    = "966a6bad-54f4-80b8-8fcc-6dd42e5d82bd";
string FRAME_TEXTURE   = "cc154e54-7a39-3c69-d6dd-23d47ea72674";
string BACK_TEXTURE    = "29f5fbee-fb36-9012-ae0e-02e3f4e2a89e";
integer MENU_CHANNEL;
integer MENU_HANDLE;
integer hoverEnabled = TRUE;

string getUsername()
{
    string desc = llGetObjectDesc();
    if (desc != "" && desc != "(No Description)")
        return desc;
    return llKey2Name(llGetOwner());
}

showMenu(key who)
{
    string hoverStatus;
    if (hoverEnabled) hoverStatus = "ON";
    else hoverStatus = "OFF";

    MENU_CHANNEL = (integer)(llFrand(-1000000) - 1000000);
    MENU_HANDLE  = llListen(MENU_CHANNEL, "", who, "");
    llDialog(who, "InCynq Follow Us Sign\n\nProfile username: " + getUsername() + "\nSet in object Description tab.\n\nHover text: " + hoverStatus,
        ["Hover ON", "Hover OFF", "Close"], MENU_CHANNEL);
    llSetTimerEvent(30.0);
}

default
{
    state_entry()
    {
        llSetLinkTexture(1, FRAME_TEXTURE, ALL_SIDES);
        llSetLinkTexture(2, SIGN_TEXTURE, 1);
        llSetLinkTexture(2, BACK_TEXTURE, 0);

        if (hoverEnabled)
            llSetLinkPrimitiveParamsFast(1, [PRIM_TEXT, "Touch to follow us on InCynq!", <0.0, 0.8, 1.0>, 1.0]);
        else
            llSetLinkPrimitiveParamsFast(1, [PRIM_TEXT, "", ZERO_VECTOR, 0.0]);
    }

    touch_start(integer num_detected)
    {
        key toucher = llDetectedKey(0);

        if (toucher == llGetOwner())
        {
            showMenu(toucher);
            return;
        }

        string username    = getUsername();
        string profile_url = INCYNQ_BASE_URL + username;

        integer i;
        for (i = 0; i < num_detected; i++)
        {
            llLoadURL(llDetectedKey(i), "Follow us on InCynq!", profile_url);
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        llListenRemove(MENU_HANDLE);
        llSetTimerEvent(0.0);

        if (message == "Hover ON")
        {
            hoverEnabled = TRUE;
            llSetLinkPrimitiveParamsFast(1, [PRIM_TEXT, "Touch to follow us on InCynq!", <0.0, 0.8, 1.0>, 1.0]);
        }
        else if (message == "Hover OFF")
        {
            hoverEnabled = FALSE;
            llSetLinkPrimitiveParamsFast(1, [PRIM_TEXT, "", ZERO_VECTOR, 0.0]);
        }
    }

    timer()
    {
        llListenRemove(MENU_HANDLE);
        llSetTimerEvent(0.0);
    }
}
