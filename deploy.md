Deploy steps (≈5 min, no CLI install)
Commit & push these changes (incl. render.yaml) to ThomasTolo/Kollekt — I haven't committed anything; say the word and I will.
Go to dashboard.render.com → New → Blueprint, connect the repo. Render reads render.yaml.
When prompted for the sync: false secrets, paste from your .env: SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, APP_SECURITY_JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and set GOOGLE_REDIRECT_URI=https://kollekt-backend.onrender.com/api/google-calendar/callback.
Deploy. Confirm the live host matches kollekt-backend.onrender.com; if Render adds a suffix, update VITE_API_URL in .env.mobile.
Note: Render's free plan cold-starts after inactivity (~50s first request) — fine for testing in Xcode.

Let me confirm the build finished cleanly.