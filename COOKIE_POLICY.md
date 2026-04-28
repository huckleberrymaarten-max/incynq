# Cookie Policy

**Last Updated:** April 24, 2026

## 1. What Are Cookies?

Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve your experience.

This policy also covers **similar technologies** we use, such as browser session storage, which works like a cookie but is automatically cleared when you close your browser tab.

## 2. Cookies We Use

### 2.1 Essential Cookies (Required)

These cookies are necessary for InCynq to function:

| Cookie | Purpose | Duration |
|--------|---------|----------|
| **Session Cookie** | Keeps you logged in | Session (deleted when you close browser) |
| **Auth Token** | Authenticates your account | 7 days (or until logout) |
| **CSRF Token** | Protects against security attacks | Session |

**Legal Basis:** Necessary for contract performance (providing our service)

**You cannot disable these cookies** as they are essential for the platform to work.

### 2.2 Functional Cookies (Optional)

These cookies remember your preferences:

| Cookie | Purpose | Duration |
|--------|---------|----------|
| **Theme Preference** | Remembers dark/light mode | 1 year |
| **Language Preference** | Remembers your language choice | 1 year |
| **Grid Status** | Remembers your last grid status setting | 30 days |

**Legal Basis:** Consent (you can disable in Settings)

### 2.3 Analytics Session Storage (Brand Content Only)

To prevent inflated view counts for brands, we use browser session storage (not a persistent cookie) to deduplicate analytics events within a single browsing session.

| Item | Purpose | Duration |
|------|---------|----------|
| **incynq_session_id** | A random session ID used to group multiple page views in the same session so one user scrolling past a brand post is counted as one impression, not five | Session only — cleared automatically when you close your browser tab |
| **pv_* / pi_* / prv_*** | One-time flags marking "this brand post/profile has already been logged in this session" | Session only |

**Important to know:**
- This data never leaves your browser
- It is only used to **decide whether to send an analytics event** — it's not itself tracking data
- It only applies to brand content — resident posts are never tracked at all
- It contains no personal information, no identifiers, and no history

**Legal Basis:** Legitimate interest (providing brands with accurate, non-inflated analytics — see Privacy Policy section 2.3)

### 2.4 Analytics Data (Server-side, Brand Content Only)

Separate from the session storage above, we also store analytics **in our database** when you interact with brand content. This is not a cookie, but we disclose it here for transparency.

| Event | What's Recorded | Retention |
|-------|-----------------|-----------|
| Brand post impression (post appeared in your feed) | post_id, your user_id, timestamp, source | 365 days |
| Brand post view (you opened its comments) | post_id, your user_id, timestamp, source | 365 days |
| Brand profile visit | profile_id, your user_id, timestamp, source | 365 days |

See the Privacy Policy for full details on who can access this data (spoiler: only the brand can see aggregate counts — your individual identity is never exposed in their dashboard).

## 3. Third-Party Cookies

### 3.1 Supabase (Hosting Provider)

Supabase may set cookies for authentication and session management. These are covered by our Essential Cookies category.

**Privacy Policy:** https://supabase.com/privacy

### 3.2 Cloudflare (Security & CDN)

Cloudflare may set cookies for security and performance:
- `__cf_bm` - Bot management
- `cf_clearance` - Security challenge verification

**Privacy Policy:** https://www.cloudflare.com/privacypolicy/

### 3.3 We Do NOT Use

- ❌ Google Analytics
- ❌ Facebook Pixel
- ❌ Advertising cookies
- ❌ Cross-site tracking cookies

## 4. Your Cookie Choices

### 4.1 Browser Settings

You can control cookies through your browser:

- **Chrome:** Settings > Privacy > Cookies
- **Firefox:** Settings > Privacy > Cookies and Site Data
- **Safari:** Preferences > Privacy > Cookies
- **Edge:** Settings > Privacy > Cookies

**Warning:** Blocking essential cookies will prevent you from using InCynq.

### 4.2 InCynq Settings

You can manage optional cookies in:
**Profile → Settings → Privacy → Cookie Preferences**

### 4.3 Do Not Track

We respect "Do Not Track" browser signals. When enabled, we will not use optional analytics session storage for brand content tracking.

## 5. Cookie Duration

- **Session Cookies / Session Storage:** Deleted when you close your browser tab
- **Persistent Cookies:** Stored for specified duration (7 days to 1 year)
- **You can delete cookies anytime** through your browser settings

## 6. Changes to This Policy

We may update this Cookie Policy. Changes will be posted with a new "Last Updated" date.

## 7. Contact Us

For cookie-related questions:

**Email:** legal@incynq.net
**Data Controller:** Maarten Huckleberry, Ireland, EU

---

**Cookie Summary:** We use essential cookies for login/security, session storage to keep brand analytics accurate, and nothing for cross-site tracking or advertising.
