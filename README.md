# TaxiMax - Taxi Booking Application

A full-stack taxi booking application with real-time updates using Socket.IO.

## Features
- Rider and Driver interfaces
- Real-time ride booking and tracking
- Dynamic pricing based on deadhead distance
- Optimized ride matching
- Clean, modern UI

## Tech Stack
- Frontend: React + Vite
- Backend: Express.js + Socket.IO
- Database: SQLite (for development)
- Maps: Google Maps API

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Create `.env` files:
   - Backend: `backend/.env`
   ```
   PORT=5000
   GOOGLE_MAPS_API_KEY=your_api_key
   AUTH_ENABLED=false
   ```
   - Frontend: `frontend/.env`
   ```
   VITE_API_URL=http://localhost:5000
   VITE_GOOGLE_MAPS_API_KEY=your_api_key
   ```

4. Start the servers:
   ```bash
   # Start backend
   cd backend
   npm run dev

   # Start frontend
   cd ../frontend
   npm run dev
   ```

## Project Structure
```
taximax/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── .env
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   ├── utils/
    │   └── App.jsx
    ├── package.json
    └── .env
``` 