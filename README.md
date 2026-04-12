# InCynq

**Connect with what matters.**

A social platform for Second Life residents.

---

## Getting started

```bash
npm install
npm run dev
```

App runs at **http://localhost:5173**

---

## Demo login

Username: `maarten.huckleberry`  
Password: anything

---

## Deploy to Vercel

```bash
npm run build
```

Then push to GitHub and connect to Vercel — it deploys automatically on every push.

---

## Project structure

```
src/
  components/     Shared UI components
  screens/        One file per screen
  context/        Global state (AppContext)
  data/           Sample data + helpers
  theme.js        Colour constants
  index.css       Global styles
```

---

## Stack

- React 18 + Vite
- React Router v6
- Zustand (ready to use)
- No UI library — all custom components
