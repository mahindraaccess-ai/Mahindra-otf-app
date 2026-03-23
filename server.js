// ─────────────────────────────────────────────────────────────────────────────
//  OTF Form Backend  ·  Node.js + Express  ·  Deploy FREE on Render.com
//
//  SETUP (5 steps):
//  1. npm install
//  2. Create a Google Cloud Service Account → download JSON key
//  3. Create a Google Sheet with two tabs: "Summary" and "Items"
//  4. Share the sheet with the service account email as Editor
//  5. In Render dashboard → Environment, set these 3 vars:
//       GOOGLE_SERVICE_ACCOUNT_JSON  = paste the entire JSON key file contents
//       SPREADSHEET_ID               = the long ID from your Sheet URL
//       SECRET_TOKEN                 = any secret string (also set in otf-form.html)
// ─────────────────────────────────────────────────────────────────────────────

'use strict';
const express    = require('express');
const cors       = require('cors');
const { google } = require('googleapis');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Health check — Render uses this to know the service is alive ──────────────
app.get('/', (_req, res) => res.json({ status: 'ok', app: 'OTF Backend' }));

// ── Google Sheets client ──────────────────────────────────────────────────────
function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth  = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ── POST /submit ──────────────────────────────────────────────────────────────
app.post('/submit', async (req, res) => {
  // Token guard
  if (process.env.SECRET_TOKEN) {
    const tok = req.headers['x-secret-token'];
    if (tok !== process.env.SECRET_TOKEN)
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  try {
    const {
      otfNumber = '', outlet = '', date = '',
      customerName = '', customerCode = '',
      regNo = '', engineNo = '', chassisNo = '',
      totalPrice = 0, receivedForFitment = '', vehicleDelivery = '',
      items = []
    } = req.body;

    const sheets = getSheets();
    const sheetId = process.env.SPREADSHEET_ID;
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // ── Append one summary row ────────────────────────────────────────────────
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Summary!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          timestamp, otfNumber, outlet, date,
          customerName, customerCode, regNo, engineNo, chassisNo,
          `₹${Number(totalPrice).toLocaleString('en-IN')}`,
          receivedForFitment, vehicleDelivery
        ]]
      }
    });

    // ── Append item rows ──────────────────────────────────────────────────────
    if (items.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Items!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: items.map(it => [
            otfNumber,
            it.slNo   ?? '',
            it.desc   ?? it.description ?? '',
            it.part   ?? it.partNumber  ?? '',
            it.qty    ?? it.quantity    ?? '',
            it.crp    ?? ''
          ])
        }
      });
    }

    res.json({ status: 'success' });

  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.listen(PORT, () => console.log(`OTF backend on :${PORT}`));
