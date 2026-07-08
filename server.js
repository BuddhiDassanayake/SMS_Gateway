require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML
app.use(express.static(path.join(__dirname, "public")));

console.log("=======================================");
console.log("🚀 Starting PayHere Server...");
console.log("Merchant ID :", process.env.MERCHANT_ID);
console.log("Public URL  :", process.env.PUBLIC_URL);
console.log("=======================================");

/*
==========================================
HOME
==========================================
*/

app.get("/", (req, res) => {

    console.log("\n🌍 GET /");

    res.sendFile(path.join(__dirname, "public", "index.html"));

});

/*
==========================================
PAYMENT INITIALIZATION
==========================================
*/

app.get("/api/payment/init", (req, res) => {

    console.log("\n=======================================");
    console.log("💳 PAYMENT INITIALIZATION");
    console.log("=======================================");

    const merchantId = process.env.MERCHANT_ID;
    const merchantSecret = process.env.MERCHANT_SECRET;

    const orderId = "ORD-" + Date.now();

    const amount = "2500.00";
    const currency = "LKR";

    console.log("Order ID :", orderId);
    console.log("Amount   :", amount);
    console.log("Currency :", currency);

    const hashedSecret = crypto
        .createHash("md5")
        .update(merchantSecret)
        .digest("hex")
        .toUpperCase();

    console.log("\nHashed Merchant Secret");
    console.log(hashedSecret);

    const hashString =
        merchantId +
        orderId +
        amount +
        currency +
        hashedSecret;

    console.log("\nHash String");
    console.log(hashString);

    const hash = crypto
        .createHash("md5")
        .update(hashString)
        .digest("hex")
        .toUpperCase();

    console.log("\nGenerated Payment Hash");
    console.log(hash);

    const payment = {

        sandbox: true,

        merchant_id: merchantId,

        return_url: process.env.PUBLIC_URL + "/success",

        cancel_url: process.env.PUBLIC_URL + "/cancel",

        notify_url: process.env.PUBLIC_URL + "/api/payment/notify",

        order_id: orderId,

        items: "Premium UI UX Course",

        amount: amount,

        currency: currency,

        first_name: "John",

        last_name: "Doe",

        email: "john@example.com",

        phone: "0771234567",

        address: "No 1",

        city: "Colombo",

        country: "Sri Lanka",

        hash: hash

    };

    console.log("\nPayment JSON");
    console.log(payment);

    console.log("=======================================\n");

    res.json(payment);

});

/*
==========================================
PAYHERE NOTIFY
==========================================
*/

app.post("/api/payment/notify", (req, res) => {

    console.log("\n");
    console.log("#######################################");
    console.log("📩 PAYHERE NOTIFICATION RECEIVED");
    console.log("#######################################");

    console.log("\nRaw Request");

    console.log(req.body);

    const {

        merchant_id,

        order_id,

        payment_id,

        payhere_amount,

        payhere_currency,

        status_code,

        md5sig

    } = req.body;

    console.log("\nExtracted Data");

    console.log("Merchant ID :", merchant_id);
    console.log("Order ID    :", order_id);
    console.log("Payment ID  :", payment_id);
    console.log("Amount      :", payhere_amount);
    console.log("Currency    :", payhere_currency);
    console.log("Status      :", status_code);

    const hashedSecret = crypto
        .createHash("md5")
        .update(process.env.MERCHANT_SECRET)
        .digest("hex")
        .toUpperCase();

    console.log("\nHashed Secret");
    console.log(hashedSecret);

    const verifyString =
        merchant_id +
        order_id +
        payhere_amount +
        payhere_currency +
        status_code +
        hashedSecret;

    console.log("\nVerification String");

    console.log(verifyString);

    const localSignature = crypto
        .createHash("md5")
        .update(verifyString)
        .digest("hex")
        .toUpperCase();

    console.log("\nReceived Signature");

    console.log(md5sig);

    console.log("\nGenerated Signature");

    console.log(localSignature);

    if (localSignature !== md5sig) {

        console.log("\n❌ HASH VERIFICATION FAILED");

        return res.sendStatus(200);

    }

    console.log("\n✅ HASH VERIFIED");

    if (status_code === "2") {

        console.log("\n🎉 PAYMENT SUCCESSFUL");

        console.log("Transaction :", payment_id);

        console.log("Update Database Here");

    }

    else {

        console.log("\n⚠ Payment Not Completed");

    }

    console.log("\nAcknowledging PayHere");

    res.sendStatus(200);

});

/*
==========================================
RETURN
==========================================
*/

app.get("/success", (req, res) => {

    console.log("\nUser Returned After Successful Payment");

    res.send("<h1>Payment Successful</h1>");

});

app.get("/cancel", (req, res) => {

    console.log("\nUser Cancelled Payment");

    res.send("<h1>Payment Cancelled</h1>");

});

/*
==========================================
START SERVER
==========================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("");
    console.log("=======================================");
    console.log("🚀 SERVER STARTED");
    console.log("=======================================");
    console.log(`Listening : http://localhost:${PORT}`);
    console.log("=======================================");

});
