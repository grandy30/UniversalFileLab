# UniversalFileLab

UniversalFileLab is a web app that allows users to pay in USDT via CoinPayments and stores payment info in Neon PostgreSQL.

## Setup
1. Copy server/.env.example to server/.env and fill Neon DB + CoinPayments keys
2. Install server dependencies:
   cd server
   npm install
3. Install client dependencies:
   cd client
   npm install
4. Run server:
   node server.js
5. Run client:
   npm start
6. Deploy to Render:
   - Push repo to GitHub
   - Connect Render
   - Use Docker build
   - Set environment variables in Render dashboard
