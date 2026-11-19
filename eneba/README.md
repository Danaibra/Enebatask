# Eneba-style marketplace (React + TypeScript, Go backend)
All content (hero, shelves, filters, offers, cart math, layout/footer texts, payment methods) is served by the Go API in `backend/main.go`; the React app only renders it.
Data is in-memory (resets on restart). Payments are simulated: any 16-digit card works, numbers ending `0002` are declined. Promo code: `WELCOME10`.

## Run locally
    cd backend && go run .            # :8080
    cd frontend && npm i && npm run dev

## Deploy on Render
1. Push this folder to a GitHub repo.
2. Render > New > Blueprint > pick the repo (uses `render.yaml` + `Dockerfile`), or New > Web Service > Runtime: Docker.
3. Your public URL will be https://<service-name>.onrender.com
