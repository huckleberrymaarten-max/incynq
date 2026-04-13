// ─────────────────────────────────────────────────────
// Q&A Content — edit this file or manage via admin panel
// Structure: array of sections, each with q/a pairs
// ─────────────────────────────────────────────────────

export const QA_DATA = [
  {
    part: "Part One — Members",
    partDesc: "For residents of Second Life using InCynq",
    sections: [
      {
        title: "Getting Started",
        items: [
          { q: "What is InCynq?", a: "InCynq is a social platform built for Second Life residents. It solves the group chat spam problem — instead of noisy SL group messages, you follow the brands and people you care about and only see content that matches your interests." },
          { q: "Is InCynq free for members?", a: "Yes, completely free. No subscription, no paywall, no catch. You will see sponsored posts from brands, but only if they match your chosen interests. Members never pay anything." },
          { q: "Do I need a Second Life account to join?", a: "Yes. A valid SL account is required to register. This is how we confirm you are a real person and not a fake or bot account. Your SL avatar name becomes your InCynq username." },
          { q: "Does InCynq need my Second Life password?", a: "Never. InCynq has its own separate password. We will never ask for your SL password. If anyone claiming to be InCynq asks for it, it is a scam." },
          { q: "How do I activate my account after registering?", a: "After registering you will see a Pending Activation screen. Visit an InCynq terminal inworld in Second Life and tap it. The terminal confirms it is really you. Come back to the app and your account activates automatically." },
          { q: "What is the minimum age?", a: "16 — the same as Second Life. Adult content requires you to be 18 or over and SL adult-verified." },
        ],
      },
      {
        title: "Your Profile",
        items: [
          { q: "What name shows on my profile?", a: "Your SL display name by default. If it differs from your SL username, both are shown — display name large, @username smaller below it. You can switch to showing your username only in Settings → Privacy → Show Display Name." },
          { q: "Can I use SL special characters in my name and posts?", a: "Yes. InCynq has a built-in SL character picker — tap the ★ button in any text field. It includes decorative borders, name deco, Japanese characters, symbols, and emoji — everything people commonly use in SL names and posts." },
          { q: "Can people find me in search?", a: "Yes, by default. Turn off Appear in Discovery in Settings → Privacy if you want to stay off the radar. Your posts are still visible to your followers either way." },
          { q: "How do I change my interests?", a: "Go to your profile and tap Edit Interests. Toggle groups on or off. Subgroups expand when you select a group. Changes take effect immediately and update your feed." },
          { q: "Can I upload a profile photo?", a: "Yes. In Edit Profile, tap the camera icon on your avatar and upload an image." },
        ],
      },
      {
        title: "The Feed",
        items: [
          { q: "Why don't I see posts from everyone?", a: "By design. InCynq only shows you posts from people and brands you follow, matched to your interest groups. No algorithm deciding what is popular — just the things you chose to follow." },
          { q: "Why am I seeing sponsored posts?", a: "Brands pay to appear in feeds. You only ever see sponsored posts if the brand's chosen interest groups match yours. No random ads — only things relevant to your SL interests." },
          { q: "What does 'Based on your interests' mean?", a: "It means that sponsored post was targeted to one of your interest groups specifically. It is there because it matched what you told InCynq you care about." },
          { q: "What is 'Out of This World' as a report reason?", a: "Content that has nothing to do with Second Life — real life content that doesn't belong on a platform for the SL community. You can report it and we will review it manually." },
          { q: "What happens when I report a post?", a: "The post is immediately auto-hidden for you and goes to our manual review queue. We review every single report ourselves. It is completely anonymous." },
          { q: "Can I post links or SLurls?", a: "No. Links and SLurls are not allowed in regular posts — this keeps the feed spam-free. Brands who want to include a teleport link need a paid ad." },
        ],
      },
      {
        title: "Stories, Events & Pings",
        items: [
          { q: "What are Stories?", a: "24-hour visual posts. Pick an image, add text and hashtags with your chosen colour and position, post it. It disappears after 24 hours." },
          { q: "Can I post events for free?", a: "Yes. Creating and posting events is completely free for all members. You only pay if you want to boost your event for more visibility." },
          { q: "What are Pings?", a: "InCynq's name for direct messages. Private one-to-one conversations between members. Tap the 💬 icon in the top navigation to open your Pings." },
          { q: "Can I report a Ping?", a: "Yes. Open the conversation and tap the 🚩 flag button in the header." },
        ],
      },
      {
        title: "Safety & Privacy",
        items: [
          { q: "How does InCynq verify members?", a: "Every member must have a valid SL account and activate inworld via an InCynq terminal. The terminal reads your SL avatar identity directly. No anonymous accounts, no fake profiles." },
          { q: "What content is completely banned?", a: "Anything involving minors, hate speech, harassment, impersonation, spam, and scams. Zero tolerance — permanent ban and reported to authorities where required by law." },
          { q: "Are suspensions automatic?", a: "No. Every suspension is a manual decision by the InCynq team after reviewing a report. Reports auto-hide content but nothing else happens until a human makes a call." },
          { q: "How do I unlock adult content?", a: "Settings → Privacy → Maturity Level → Adult. You must confirm your SL account is adult-verified and that you are 18 or over. If not yet verified on SL, there is a direct link to secondlife.com/my/account/verify." },
          { q: "Does InCynq sell my data?", a: "Never. InCynq is operated from Ireland under EU GDPR. We collect only what is needed to run the platform. We do not sell, share, or trade your personal data with anyone." },
          { q: "How do I delete my account?", a: "Settings → Delete Account. You have a 14-day cool-off period to change your mind. After that, everything is permanently deleted." },
        ],
      },
      {
        title: "Grid Status",
        items: [
          { q: "What is Grid Status?", a: "Your online status as shown on InCynq. Three options: 🟢 In-world (visible to everyone), 🟡 Friends only (visible to mutual follows only), or ⚫ Hidden (always shows as offline)." },
          { q: "Can I hide my status completely?", a: "Yes. Set Grid Status to Hidden and you will always appear offline to everyone on InCynq." },
          { q: "Does InCynq override my SL privacy settings?", a: "No. If you have hidden your online status in SL privacy settings, InCynq follows that and shows you as offline regardless of what you have set on InCynq." },
        ],
      },
      {
        title: "Email & Notifications",
        items: [
          { q: "What emails does InCynq send?", a: "Only what you choose. Account emails (activation, important notices) always come through. Everything else — InCynq News, Tips & Guides, Special Offers — is optional and toggleable in Settings → Email." },
          { q: "Does InCynq show me ads from outside companies?", a: "No. InCynq products are ad-free from third parties. The only sponsored content you see comes from Second Life brands within InCynq, matched to your own chosen interests." },
          { q: "Can I pause push notifications?", a: "Yes. Settings → Notifications. Toggle Push Notifications, Pings, and Event Reminders individually." },
        ],
      },
    ],
  },
  {
    part: "Part Two — Brands",
    partDesc: "For Second Life businesses, creators, and sim owners",
    sections: [
      {
        title: "Setting Up Your Brand Account",
        items: [
          { q: "What do I need before creating a brand account?", a: "A member account on InCynq. Brand accounts are always linked to a personal member account. You manage both from one login and switch between them instantly." },
          { q: "How do I create a brand account?", a: "Settings → Add Brand Account. Fill in your brand name, description, logo, and brand email. Pay the 3,500 L$ activation fee inworld at an InCynq terminal. That 3,500 L$ goes directly into your Brand Wallet as ad credit — nothing is wasted." },
          { q: "Can I have more than one brand account?", a: "Not in the current version. One member account, one brand account, linked together." },
          { q: "How do I switch between my personal and brand account?", a: "Tap your avatar in the top navigation to open the account switcher. All linked accounts are shown. Tap any account to switch instantly — no logout needed." },
          { q: "What is the Brand Team feature?", a: "You can invite one Manager to help run your brand account. A manager can post, create events, boost, manage ads, top up the wallet, and reply to comments. They cannot delete the brand, invite others, or transfer ownership." },
          { q: "How do I invite a manager?", a: "Settings → Brand Team → Invite a Manager. Enter their SL avatar name. They get a notification and can accept. You can cancel the invite or remove a manager at any time." },
        ],
      },
      {
        title: "Advertising",
        items: [
          { q: "How does InCynq advertising work?", a: "You create location ads that appear in the feed and explore for members who match your chosen interest groups. Ads run for 7 days. Members only see your ad if they have joined at least one of the groups you targeted." },
          { q: "What are the ad tiers?", a: "⚡ Basic — 250 L$/week. Highlighted in search and explore. Reaches ~2,000 residents per day. ⭐ Featured — 750 L$/week. Featured card injected in feed. Reaches ~6,000 residents per day. 👑 Premium — 1,500 L$/week. Top story, feed, and explore banner. Reaches ~15,000 residents per day. All at launch pricing." },
          { q: "How does interest group targeting work?", a: "You pick which interest groups see your ad. Members only see it if they have joined at least one of your chosen groups. Pricing scales with the number of groups: 1 group = base price, 2 groups = 1.8×, 3 groups = 2.5×, 4 or more groups = 3× (capped)." },
          { q: "What is Random Rotation?", a: "When you select 2 or more interest groups, you can enable Random Rotation. Your ad rotates through your selected groups randomly instead of targeting all simultaneously. This costs 25% less. Good for broad reach on a tighter budget." },
          { q: "Can I run adult ads?", a: "Only if your brand owner account has SL adult verification. Adult ads are shown exclusively to adult-verified members. Running adult ads to non-adult audiences results in immediate account suspension. No exceptions." },
          { q: "Will ad prices increase?", a: "Yes. Current pricing is launch pricing — intentionally low while the platform is growing. As InCynq's audience grows, prices will increase. We will always give you at least 30 days' notice. Brands that join early get the best rates permanently until they change." },
          { q: "Can I get a refund on ad spend?", a: "No. Once L$ is charged for an ad, it cannot be reversed. The no-refunds notice is shown clearly at every payment step before you confirm." },
        ],
      },
      {
        title: "Brand Wallet",
        items: [
          { q: "What is the Brand Wallet?", a: "A L$ balance held on InCynq, used for running ads and boosting events. It is created automatically when you activate your brand account. The 3,500 L$ activation fee becomes your opening balance." },
          { q: "How do I top up my Brand Wallet?", a: "In the Advertise tab, tap Top Up. Choose an amount, receive a unique payment code (ICQ-XXXXXXXX), find an InCynq terminal inworld, pay the exact amount and enter your code. Come back to the app and tap I've Paid." },
          { q: "What happens to my wallet if my account is suspended?", a: "Your Brand Wallet is frozen. No ads can run and no new payments can be made until the suspension is lifted. If the account is permanently banned, the wallet balance is forfeited." },
          { q: "Are wallet balances refundable?", a: "No. All wallet L$ is non-refundable. This applies to activation fees, ad spend, event boosts, and Cynqified application fees." },
        ],
      },
      {
        title: "Events & Boosting",
        items: [
          { q: "Can brands post events?", a: "Yes. Event creation is free for brands and members alike. Brands can post events for their locations, product launches, parties, live sets — anything inworld." },
          { q: "How does event boosting work?", a: "Tap Boost on your event. Choose a tier (⚡ Basic, ⭐ Featured, 👑 Premium) and number of days (1, 2, or 3). L$ is deducted from your Brand Wallet. If your balance is insufficient, the top-up flow opens automatically." },
          { q: "Can I use SL characters in event titles?", a: "Yes. Tap the ★ button next to the event title field to open the SL character picker. Add decorative characters, borders, and symbols just like you would in SL itself." },
        ],
      },
      {
        title: "Cynqified Brand Verification",
        items: [
          { q: "What is the Cynqified badge?", a: "The ⚡ Cynqified badge is InCynq's brand verification. It tells the community you have been manually reviewed and confirmed as a legitimate Second Life brand. It shows on your profile, your posts, and your ads." },
          { q: "How do I apply?", a: "Settings → Get Cynqified. Fill in your SL location or Marketplace URL, a description of your brand, and how long you have been in Second Life. The 1,500 L$ application fee is charged on submission. We review within 24–48 hours." },
          { q: "Is the fee refundable if rejected?", a: "No. The 1,500 L$ is non-refundable whether approved or rejected. Make sure your application is complete and accurate before submitting." },
          { q: "What does Cynqified mean to members?", a: "It tells them your brand has been manually checked by InCynq and is the real deal. It is not an endorsement of your products or services — just confirmation that you are who you say you are." },
          { q: "Can the badge be removed?", a: "Yes. If your brand breaches InCynq's Terms & Conditions, the badge can be revoked. Serious breaches — especially adult content violations or harassment — also result in suspension or permanent ban." },
        ],
      },
      {
        title: "Safety & Enforcement for Brands",
        items: [
          { q: "What happens if my brand is reported?", a: "Reports go to our manual review queue. Content is auto-hidden pending review. We review every report ourselves. Nothing happens to your account automatically — a human makes every decision." },
          { q: "What counts as a serious breach for a brand?", a: "Adult content shown to non-adults, harassment, hate speech, fraud, impersonation, and anything involving minors. These are treated seriously from the first offence." },
          { q: "What is the suspension process?", a: "First serious offence: immediate suspension, Brand Wallet frozen, all ads paused. You can appeal at support@incynq.app. Second offence or extremely severe first offence: permanent ban, wallet forfeited, no appeal." },
          { q: "Can I appeal a suspension?", a: "Yes. Contact support@incynq.app with your brand name and the reason you believe the suspension was issued in error. We aim to respond within 48 hours." },
          { q: "Are there automated suspensions?", a: "No. We do not auto-suspend anyone based on report counts or algorithms. Every action is a manual decision made by the InCynq team." },
        ],
      },
      {
        title: "Brand Email & Notifications",
        items: [
          { q: "What emails do brand accounts receive?", a: "Account emails (suspension notices, billing confirmations) always come through. Optional emails include: Ad Performance Reports (weekly reach summary) and Billing & Wallet (top-up reminders). Both are on by default and individually toggleable in Settings → Email." },
          { q: "Can I turn off billing emails?", a: "Yes. Settings → Email → Billing & Wallet. Toggle it off. Just be aware you won't get top-up reminders if your wallet runs low." },
        ],
      },
    ],
  },
];
