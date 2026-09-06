# Maritime AI Estimator

An AI-powered floating infrastructure cost estimator. Click a coastal location on the map → the AI analyzes real marine conditions → recommends the right Bluet product and gives a budget estimate. No 3-page form needed.

Built for the **Vantaa Startup Deal Challenge** (pitch day: June 4, 2026).

---

## How It Works

1. You click anywhere on the coastal map
2. The app sends the coordinates to an AI agent
3. The AI calls a real weather API to get wave height, wind speed, and ice risk
4. It compares those conditions against Bluet's product specs
5. It streams back a recommendation + budget estimate in real time
6. You can generate and download a formal project proposal

---

## Getting Started

### Step 1: Get a Google Gemini API key (free, 2 minutes)

The AI runs on **Google Gemini**'s free API tier (no credit card needed). This used to run on GitHub Models, but GitHub fully retired that service on July 30, 2026.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with any Google account
3. Click **"Create API key"**
4. Copy the key

### Step 2: Create your environment file

Create a file called `.env.local` in the project root folder (same level as `package.json`):

```
# Required: Gemini API key for AI access
GEMINI_API_KEY=your_gemini_key_here

# Optional: for live marine weather data (app works without this)
WEATHER_API_KEY=your_weatherapi_key_here
```

> **Note:** `.env.local` is listed in `.gitignore` and will never be committed to GitHub. Your keys stay private.

**Optional: Live weather data**

- Sign up free at [weatherapi.com](https://www.weatherapi.com/) (no credit card)
- Copy your API key into `.env.local`
- Without it, the app uses realistic Baltic Sea average values, still works great for demos

### Step 3: Install dependencies (first time only)

```bash
npm install
```

### Step 4: Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
maritime-ai-estimator/
├── app/
│   ├── api/chat/route.ts          # AI agent: tool calling, streaming, system prompt
│   ├── components/
│   │   ├── MapWrapper.tsx         # Solves the Leaflet/Next.js SSR loading issue
│   │   ├── LeafletMapComponent.tsx # Interactive map with click handler
│   │   ├── ChatSidebar.tsx        # Streaming chat UI, auto-triggers on map click
│   │   └── ProposalPreview.tsx    # Proposal modal with download button
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # Main page: holds state, wires components together
├── knowledge/
│   └── products.json              # Bluet product specs: edit this during the workshop!
├── tools/
│   └── marineWeather.ts           # Weather API fetcher with Baltic Sea fallback
├── .env.example                   # Template: copy to .env.local and fill in keys
└── README.md
```

---

## Key Concept: What "Tool Calling" Means

When you click the map, the AI doesn't invent weather data. Here's what actually happens:

```
User clicks map
  → AI receives coordinates
  → AI decides to call getMarineConditions(lat, lng)   ← this is a "tool call"
  → Our code fetches real weather from WeatherAPI
  → Returns: { waveHeight: 0.8m, windSpeed: 14kph, iceRisk: "Moderate" }
  → AI reads the real data + product specs
  → AI writes its recommendation based on actual conditions
```

This is what makes the output trustworthy: it's grounded in real data, not guesswork.

---

## Tech Stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js 15 (App Router)                            |
| Language       | TypeScript                                         |
| AI / Streaming | Vercel AI SDK v4                                   |
| AI Model       | Google Gemini: `gemini-3.1-flash-lite` (free tier) |
| Map            | React-Leaflet + OpenStreetMap tiles                |
| Styling        | Tailwind CSS                                       |
| Weather Data   | WeatherAPI.com (optional)                          |

---

## Pitch Day Tips:

- **`knowledge/products.json`** is designed to be edited live. During the morning workshop when the Bluet founders tell you their real constraints, update this file and the AI will immediately reflect those changes.
- The AI fallback (no WeatherAPI key) uses accurate Baltic Sea seasonal averages, safe to demo offline.
- Record a backup demo video before June 4 in case of Wi-Fi issues at the venue.
