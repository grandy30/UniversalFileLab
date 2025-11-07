// generate_universalfilelab.js
// Node.js v18+ recommended

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const projectRoot = path.join(__dirname, "UniversalFileLab");

// Helper functions
function createDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
}

// 1️⃣ Create folder structure
createDir(projectRoot);
createDir(path.join(projectRoot, "server/api/payments"));
createDir(path.join(projectRoot, "server/migrations"));
createDir(path.join(projectRoot, "client/src/pages"));

// 2️⃣ server/package.json
writeFile(path.join(projectRoot, "server/package.json"), `{
  "name": "universalfilelab-server",
  "version": "1.0.0",
  "main": "server.js",
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "axios": "^1.7.0",
    "body-parser": "^1.20.2",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "pg": "^8.12.0"
  }
}`);

// 3️⃣ server/.env.example
writeFile(path.join(projectRoot, "server/.env.example"), `# Database
DATABASE_URL=postgresql://neondb_owner:password@ep-tiny-snow-ahvkef98.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Server
PORT=5000
NODE_ENV=production
JWT_SECRET=supersecret_jwt_token

# CoinPayments
COINPAYMENTS_MERCHANT_ID=your_merchant_id
COINPAYMENTS_PUBLIC_KEY=your_public_key
COINPAYMENTS_PRIVATE_KEY=your_private_key
COINPAYMENTS_IPN_SECRET=your_ipn_secret
COINPAYMENTS_CURRENCY=USDT
COINPAYMENTS_IPN_URL=https://universalfilelab.onrender.com/api/payments/ipn
`);

// 4️⃣ server/migrations/001_create_payments_table.sql
writeFile(path.join(projectRoot, "server/migrations/001_create_payments_table.sql"), `CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    txn_id VARCHAR(255) UNIQUE NOT NULL,
    amount NUMERIC(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USDT',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
`);

// 5️⃣ server/db.js
writeFile(path.join(projectRoot, "server/db.js"), `import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
export default pool;
`);

// 6️⃣ server/api/payments/coinpayments.js
writeFile(path.join(projectRoot, "server/api/payments/coinpayments.js"), `import express from "express";
import axios from "axios";
import crypto from "crypto";
import pool from "../../db.js";

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const { amount, currency = "USDT", item_name, email } = req.body;
    const payload = new URLSearchParams();
    payload.append("version", 1);
    payload.append("cmd", "create_transaction");
    payload.append("amount", amount);
    payload.append("currency1", currency);
    payload.append("currency2", currency);
    payload.append("buyer_email", email);
    payload.append("item_name", item_name);
    payload.append("ipn_url", process.env.COINPAYMENTS_IPN_URL);

    const auth = {
      username: process.env.COINPAYMENTS_PUBLIC_KEY,
      password: process.env.COINPAYMENTS_PRIVATE_KEY
    };

    const response = await axios.post("https://www.coinpayments.net/api.php", payload, { auth });

    await pool.query(
      "INSERT INTO payments(txn_id, amount, currency, status, email) VALUES($1,$2,$3,$4,$5)",
      [response.data.result.txn_id, amount, currency, "pending", email]
    );

    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.post("/ipn", async (req, res) => {
  const hmac = req.headers["hmac"];
  const generatedHmac = crypto.createHmac("sha512", process.env.COINPAYMENTS_IPN_SECRET)
    .update(req.rawBody || "").digest("hex");

  if (hmac !== generatedHmac) return res.status(403).send("Invalid IPN");
  const { txn_id, status } = req.body;
  await pool.query("UPDATE payments SET status=$1 WHERE txn_id=$2", [status, txn_id]);
  res.send("OK");
});

export default router;
`);

// 7️⃣ server/server.js with auto-run migrations
writeFile(path.join(projectRoot, "server/server.js"), `import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import pool from "./db.js";
import paymentRoutes from "./api/payments/coinpayments.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api/payments/ipn", bodyParser.raw({ type: "*/*" }));
app.use("/api/payments", paymentRoutes);

async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
    console.log(\`Migration applied: \${file}\`);
  }
}

runMigrations()
  .then(() => {
    console.log("✅ All migrations applied.");
    app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
  })
  .catch(err => {
    console.error("❌ Migration error:", err);
    process.exit(1);
  });
`);

// 8️⃣ client/package.json
writeFile(path.join(projectRoot, "client/package.json"), `{
  "name": "universalfilelab-client",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "axios": "^1.7.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}`);

// 9️⃣ client/.env
writeFile(path.join(projectRoot, "client/.env"), `REACT_APP_BACKEND_URL=https://universalfilelab.onrender.com`);

// 10️⃣ client/src/pages/checkout.jsx
writeFile(path.join(projectRoot, "client/src/pages/checkout.jsx"), `import React, { useState } from "react";
import axios from "axios";

const Checkout = () => {
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(\`\${process.env.REACT_APP_BACKEND_URL}/api/payments/create\`, { amount, email, item_name: "UniversalFileLab Subscription" });
      if (response.data?.result?.checkout_url) setPaymentUrl(response.data.result.checkout_url);
      else setError("Failed to create payment.");
    } catch (err) {
      console.error(err);
      setError("Error connecting to backend.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "50px auto", textAlign: "center" }}>
      <h2>Pay with USDT</h2>
      <form onSubmit={handleSubmit}>
        <input type="number" min="0.1" step="0.01" placeholder="Amount" value={amount} onChange={(e)=>setAmount(e.target.value)} required/>
        <input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required/>
        <button type="submit">{loading ? "Processing..." : "Pay Now"}</button>
      </form>
      {paymentUrl && <a href={paymentUrl} target="_blank" rel="noopener noreferrer">Go to CoinPayments</a>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default Checkout;
`);

// 11️⃣ Dockerfile
writeFile(path.join(projectRoot, "Dockerfile"), `FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server ./server
WORKDIR /app/server
EXPOSE 5000
CMD ["node", "server.js"]
`);

// 12️⃣ render.yaml
writeFile(path.join(projectRoot, "render.yaml"), `services:
  - type: web
    name: universalfilelab
    env: docker
    branch: main
    dockerfilePath: ./Dockerfile
    envVars:
      - key: DATABASE_URL
        value: postgresql://neondb_owner:npg_sXpU9zVQ2tON@ep-tiny-snow-ahvkef98-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
      - key: COINPAYMENTS_MERCHANT_ID
        value: e786072de3d94e03ac092a542a067ad8
      - key: COINPAYMENTS_PUBLIC_KEY
        value: your_real_public_key_here
      - key: COINPAYMENTS_PRIVATE_KEY
        value: your_real_private_key_here
      - key: COINPAYMENTS_IPN_SECRET
        value: supersecretipn123
      - key: COINPAYMENTS_IPN_URL
        value: https://universalfilelab.onrender.com/api/payments/ipn
      - key: COINPAYMENTS_CURRENCY
        value: USDT
`);

// 13️⃣ README.md
writeFile(path.join(projectRoot, "README.md"), `# UniversalFileLab

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
`);

// 14️⃣ Generate ZIP using Archiver
const zipFile = path.join(__dirname, "UniversalFileLab.zip");
const output = fs.createWriteStream(zipFile);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`✅ Fully deployable ZIP generated at: ${zipFile} (${archive.pointer()} total bytes)`);
});

archive.on("error", err => { throw err; });

archive.pipe(output);
archive.directory(projectRoot, false);
archive.finalize();
