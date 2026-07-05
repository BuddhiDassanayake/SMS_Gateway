# PayHere & Twilio SMS API Service 🚀

A secure Node.js/Express service that handles PayHere payment integrations, verifies payment webhooks, and sends automated SMS notifications via Twilio. It also exposes a protected API endpoint for broadcasting custom SMS messages to a set of pre-configured, verified phone numbers.

---

## ✨ Features

- **PayHere Integration** — Generates the MD5 hash and checkout payload required to initiate a PayHere payment.
- **Payment Webhook Verification** — Validates the PayHere `md5sig` signature on every webhook call to protect against spoofed/fraudulent notifications.
- **Automatic Payment SMS** — Sends a Twilio SMS receipt to the customer automatically when a payment is confirmed (`status_code === '2'`).
- **Broadcast SMS API** — A secured (`x-api-key`) endpoint to send a custom message to up to two pre-configured verified numbers in parallel.
- **Static File Hosting** — Serves static assets from a `public/` directory.
- **Railway Ready** — Uses `process.env.PORT` for dynamic port binding, making it deployable on Railway (or any similar platform) with no code changes.

---

## 📁 Project Structure

```
.
├── public/              # Static assets served at the root URL
├── index.js             # Main server file (Express app)
├── package.json
├── .env                 # Environment variables (not committed)
└── README.md
```

---

## 🛠 Prerequisites

- **Node.js** v18 or higher
- A **Twilio** account with:
  - Account SID
  - Auth Token
  - A Twilio phone number capable of sending SMS
- A **PayHere** merchant account with:
  - Merchant ID
  - Merchant Secret
- [ngrok](https://ngrok.com/) — for exposing your local server so PayHere can reach your webhook during testing

---

## 📦 Installation

```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000

# PayHere Variables
MERCHANT_ID=your_merchant_id
MERCHANT_SECRET=your_merchant_secret
NGROK_URL=https://your-public-url.ngrok-free.dev   # Use your production domain when deployed

# Twilio Variables
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Target Phone Numbers (must include country code, e.g. +947...)
CUSTOMER_PHONE_NUMBER_1=+947XXXXXXXX
CUSTOMER_PHONE_NUMBER_2=+947YYYYYYYY   # Optional — omit or leave blank if you only have one number

# Security Key for the Broadcast SMS API
API_SECRET_KEY=your_super_secret_api_key
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port the server listens on (defaults to `3000`). Not needed on Railway. |
| `MERCHANT_ID` | Yes | Your PayHere merchant ID. |
| `MERCHANT_SECRET` | Yes | Your PayHere merchant secret, used for hash generation and signature verification. |
| `NGROK_URL` | Yes | The public base URL of your server (ngrok URL locally, your real domain in production). Used to build `return_url`, `cancel_url`, and `notify_url`. |
| `TWILIO_ACCOUNT_SID` | Yes | Your Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | Yes | Your Twilio auth token. |
| `TWILIO_PHONE_NUMBER` | Yes | The Twilio number messages are sent from. |
| `CUSTOMER_PHONE_NUMBER_1` | Yes | First verified recipient number for the broadcast SMS API. Also used as the default `custom_1` value for payments. |
| `CUSTOMER_PHONE_NUMBER_2` | No | Second verified recipient number for the broadcast SMS API. |
| `API_SECRET_KEY` | Yes | Secret key required in the `x-api-key` header to call the broadcast SMS endpoint. |

---

## ▶️ Running Locally

```bash
node index.js
```

You should see:

```
=============================================
🚀 Server running on http://localhost:3000
🛡️  SMS API Security requires header: x-api-key
=============================================
```

To test the PayHere webhook locally, expose your server with ngrok and set `NGROK_URL` to the generated public URL:

```bash
ngrok http 3000
```

---

## 📖 API Documentation

### 1. Create Payment

Generates the MD5 hash and JSON payload required to initiate a PayHere checkout.

- **URL:** `/api/create-payment`
- **Method:** `GET`
- **Auth Required:** No

**Success Response — `200 OK`**

```json
{
  "sandbox": true,
  "merchant_id": "1236689",
  "return_url": "https://your-url.com/",
  "cancel_url": "https://your-url.com/",
  "notify_url": "https://your-url.com/notify",
  "order_id": "ORD-1698765432100",
  "items": "Premium UI/UX Course",
  "amount": "2500.00",
  "currency": "LKR",
  "hash": "A1B2C3D4E5F6G7H8I9J0...",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "0771234567",
  "address": "No.1, Galle Road",
  "city": "Colombo",
  "country": "Sri Lanka",
  "custom_1": "+94717383208"
}
```

> **Note:** `order_id`, `amount`, `items`, and customer details are currently hardcoded/generated server-side. To support dynamic checkouts (different products, prices, or customers), extend this endpoint to accept parameters (e.g. via query string or request body) and use them when building the payload and hash.

**How the hash is generated:**

```
hashedSecret = MD5(MERCHANT_SECRET).toUpperCase()
hash = MD5(MERCHANT_ID + order_id + amount + currency + hashedSecret).toUpperCase()
```

---

### 2. PayHere Webhook (Notify URL)

Receives the payment status update from PayHere, verifies the MD5 signature, and — on a successful payment — sends a Twilio SMS receipt to the customer's number (`custom_1`).

- **URL:** `/notify`
- **Method:** `POST`
- **Auth Required:** No (secured via MD5 signature verification instead of an API key)

**Expected Body (sent by PayHere):**

```json
{
  "merchant_id": "1236689",
  "order_id": "ORD-1698765432100",
  "payhere_amount": "2500.00",
  "payhere_currency": "LKR",
  "status_code": "2",
  "md5sig": "...",
  "custom_1": "+94717383208"
}
```

**Signature verification:**

```
hashedSecret = MD5(MERCHANT_SECRET).toUpperCase()
localSig = MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret).toUpperCase()
```

If `localSig` matches the incoming `md5sig`, the request is treated as authentic:

| `status_code` | Meaning | Action |
|---|---|---|
| `2` | Payment successfully captured | Sends an SMS to `custom_1` confirming the payment |
| Other | Payment pending / cancelled / failed, etc. | Logged only — no SMS sent |

If the signature does **not** match, the request is logged as a potential fraud attempt and no SMS is sent.

**Response:** Always returns `200 OK` (empty body) to acknowledge receipt to PayHere, regardless of signature outcome — this is required by PayHere's webhook contract.

---

### 3. Broadcast SMS (Secure API)

Sends a custom SMS message to the verified phone numbers configured in your `.env` file (`CUSTOMER_PHONE_NUMBER_1` and, if set, `CUSTOMER_PHONE_NUMBER_2`).

- **URL:** `/api/send-sms`
- **Method:** `POST`
- **Auth Required:** Yes — custom header

**Headers Required:**

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `x-api-key` | Must match `API_SECRET_KEY` |

**Request Body:**

```json
{
  "message": "Hello! This is a system alert sent to the admins."
}
```

**Success Response — `200 OK`**

```json
{
  "success": true,
  "message": "SMS processing completed.",
  "details": [
    {
      "number": "+947XXXXXXXX",
      "status": "Success",
      "sid": "SM1234567890abcdef..."
    },
    {
      "number": "+947YYYYYYYY",
      "status": "Failed",
      "error": "The 'To' number is not a valid phone number."
    }
  ]
}
```

Messages are sent to all configured numbers **in parallel**; the `details` array reports the outcome for each number independently, so a failure on one number does not block delivery to the other.

**Error Responses:**

| Status | Condition | Body |
|---|---|---|
| `401 Unauthorized` | `x-api-key` header missing or incorrect | `{ "success": false, "error": "Unauthorized: Invalid or missing API Key." }` |
| `400 Bad Request` | `message` field missing from request body | `{ "success": false, "error": "Message body is required." }` |

**Example cURL:**

```bash
curl -X POST https://your-domain.com/api/send-sms \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_super_secret_api_key" \
  -d '{"message": "Server deployment completed successfully."}'
```

---

## 🔒 Security Notes

- Never commit your `.env` file — add it to `.gitignore`.
- Treat `API_SECRET_KEY` like a password: rotate it if it's ever exposed, and only share it with trusted systems calling `/api/send-sms`.
- The `/notify` endpoint intentionally has no API key check — PayHere authenticates via the MD5 signature instead. Do not add IP allow-listing here unless you've confirmed PayHere's current outbound IP ranges, as they may change.
- Consider adding rate limiting (e.g. `express-rate-limit`) to `/api/send-sms` and `/api/create-payment` in production to prevent abuse.
- All phone numbers must include the full international country code (e.g. `+94...` for Sri Lanka) or Twilio will reject the request.

---

## 🚀 Deployment (Railway.com)

1. Push this project to a GitHub repository.
2. Log into [Railway.app](https://railway.app/) → **New Project** → **Deploy from GitHub repo**.
3. Open the **Variables** tab in your Railway project and add every variable from your `.env` file (you don't need to add `PORT` — Railway sets it automatically).
4. Once deployed, copy your Railway public domain (e.g. `https://my-app-production.up.railway.app`) and set it as `NGROK_URL` in your Railway variables.
5. Update your PayHere merchant dashboard with the new domain for your notify/return/cancel URLs, if PayHere requires you to allow-list callback domains.
6. Redeploy so the updated `NGROK_URL` takes effect.

---

## 🧪 Testing Checklist

- [ ] `GET /api/create-payment` returns a valid payload and hash
- [ ] PayHere sandbox checkout completes and hits `/notify`
- [ ] Webhook signature verification passes for a genuine PayHere request
- [ ] Payment confirmation SMS arrives at the customer's number
- [ ] `POST /api/send-sms` with a valid `x-api-key` delivers to all configured numbers
- [ ] `POST /api/send-sms` without/with an invalid `x-api-key` returns `401`
- [ ] `POST /api/send-sms` without a `message` field returns `400`

---

## 📄 License

Add your preferred license here (e.g. MIT).

---

_Built for PayHere and Twilio API integration._