require("dotenv").config();

const express = require("express");
const crypto = require("crypto");

const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Payment Initialization
app.get("/api/payment/init", (req, res) => {

    const merchantId = process.env.MERCHANT_ID;
    const merchantSecret = process.env.MERCHANT_SECRET;

    const orderId = "ORD-" + Date.now();
    const amount = "2500.00";
    const currency = "LKR";

    const hashedSecret = crypto
        .createHash("md5")
        .update(merchantSecret)
        .digest("hex")
        .toUpperCase();

    const hash = crypto
        .createHash("md5")
        .update(
            merchantId +
            orderId +
            amount +
            currency +
            hashedSecret
        )
        .digest("hex")
        .toUpperCase();

    res.json({
        sandbox: true,

        merchant_id: merchantId,

        return_url: process.env.NGROK_URL + "/success",

        cancel_url: process.env.NGROK_URL + "/cancel",

        notify_url: process.env.NGROK_URL + "/api/payment/notify",

        order_id: orderId,

        items: "Premium UI UX Course",

        amount,

        currency,

        hash,

        first_name: "John",

        last_name: "Doe",

        email: "john@gmail.com",

        phone: "0771234567",

        address: "No 1",

        city: "Colombo",

        country: "Sri Lanka"
    });

});

// PayHere Notification
app.post("/api/payment/notify", (req, res) => {

    const {

        merchant_id,

        order_id,

        payhere_amount,

        payhere_currency,

        status_code,

        md5sig,

        payment_id

    } = req.body;

    const hashedSecret = crypto
        .createHash("md5")
        .update(process.env.MERCHANT_SECRET)
        .digest("hex")
        .toUpperCase();

    const localSignature = crypto
        .createHash("md5")
        .update(
            merchant_id +
            order_id +
            payhere_amount +
            payhere_currency +
            status_code +
            hashedSecret
        )
        .digest("hex")
        .toUpperCase();

    if (localSignature !== md5sig) {

        console.log("Hash Mismatch");

        return res.sendStatus(200);

    }

    if (status_code === "2") {

        console.log("Payment Successful");

        console.log(payment_id);

        // Update Database Here

    } else {

        console.log("Payment Not Completed");

    }

    res.sendStatus(200);

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server running on ${PORT}`);

});
