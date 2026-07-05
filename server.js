require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Twilio Client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

//  SMS SERVICE (Reusable Function)

const sendSmsToVerifiedNumbers = async (messageText) => {
    // Load both numbers from .env and filter out empty values
    const targetNumbers = [
        process.env.CUSTOMER_PHONE_NUMBER_1,
        process.env.CUSTOMER_PHONE_NUMBER_2
    ].filter(Boolean); 

    console.log(`\n📢 [SMS SERVICE] Preparing to send message to ${targetNumbers.length} verified number(s)...`);

    // Send SMS to all valid numbers in parallel
    const smsPromises = targetNumbers.map(async (number) => {
        try {
            console.log(`⏳ [SMS SERVICE] Sending to ${number}...`);
            const msg = await twilioClient.messages.create({
                body: messageText,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: number
            });
            console.log(`✅ [SMS SUCCESS] Message sent to ${number} | SID: ${msg.sid}`);
            return { number, status: 'Success', sid: msg.sid };
        } catch (error) {
            console.error(`❌ [SMS ERROR] Failed to send to ${number} | Reason: ${error.message}`);
            return { number, status: 'Failed', error: error.message };
        }
    });

    // Wait for all messages to finish processing
    const results = await Promise.all(smsPromises);
    return results;
};



// SECURITY MIDDLEWARE FOR NEW API

const verifyApiKey = (req, res, next) => {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
        console.warn(`\n⛔ [AUTH FAILED] Unauthorized API request from IP: ${req.ip}`);
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing API Key.' });
    }
    
    console.log(`\n🔓 [AUTH SUCCESS] API Key verified for IP: ${req.ip}`);
    next();
};



//  NEW API: Send SMS to Both Numbers

app.post('/api/send-sms', verifyApiKey, async (req, res) => {
    console.log(`📥 [API REQUEST] POST /api/send-sms triggered`);
    
    const { message } = req.body;

    if (!message) {
        console.warn(`⚠️ [API ERROR] Missing 'message' in request body`);
        return res.status(400).json({ success: false, error: 'Message body is required.' });
    }

    // Call the SMS service
    const results = await sendSmsToVerifiedNumbers(message);

    console.log(`📤 [API RESPONSE] SMS processing finished. Sending response back to client.`);
    res.json({
        success: true,
        message: 'SMS processing completed.',
        details: results
    });
});



// PREVIOUS FUNCTIONALITY: PayHere Payment


// 1. Endpoint to generate payment hash
app.get('/api/create-payment', (req, res) => {
    console.log(`\n📥 [PAYHERE] GET /api/create-payment requested`);
    
    const merchantId = process.env.MERCHANT_ID;
    const merchantSecret = process.env.MERCHANT_SECRET;
    
    const orderId = 'ORD-' + Date.now();
    const amount = "2500.00"; 
    const currency = "LKR";

    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashString = merchantId + orderId + amount + currency + hashedSecret;
    const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

    console.log(`⚙️ [PAYHERE] Hash generated for Order: ${orderId}`);

    res.json({
        sandbox: true,
        merchant_id: merchantId,
        return_url: `${process.env.NGROK_URL}/`,
        cancel_url: `${process.env.NGROK_URL}/`,
        notify_url: `${process.env.NGROK_URL}/notify`,
        order_id: orderId,
        items: "Premium UI/UX Course",
        amount: amount,
        currency: currency,
        hash: hash,
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "0771234567",
        address: "No.1, Galle Road",
        city: "Colombo",
        country: "Sri Lanka",
        // Keeping previous functionality: Passing the primary number to custom_1
        custom_1: process.env.CUSTOMER_PHONE_NUMBER_1 
    });
});

// 2. Webhook Endpoint
app.post('/notify', async (req, res) => {
    console.log(`\n📥 [WEBHOOK REQUEST] POST /notify received from PayHere`);
    
    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig, custom_1 } = req.body;
    const merchantSecret = process.env.MERCHANT_SECRET;

    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const localString = merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret;
    const localSig = crypto.createHash('md5').update(localString).digest('hex').toUpperCase();

    if (localSig === md5sig) {
        console.log(`✅ [WEBHOOK] Signature Verified for Order: ${order_id}`);
        
        if (status_code === '2') {
            console.log(`💰 [WEBHOOK] SUCCESS: Payment fully captured for Order: ${order_id}`);
            
            // Send standard webhook SMS to the customer who paid (Preserving old functionality)
            try {
                console.log(`⏳ [WEBHOOK] Sending payment confirmation SMS to custom_1 (${custom_1})...`);
                const message = await twilioClient.messages.create({
                    body: `Success! Your payment of ${payhere_currency} ${payhere_amount} for Order ${order_id} has been received.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: custom_1 
                });
                console.log(`✅ [WEBHOOK SMS SUCCESS] Message SID: ${message.sid}`);
            } catch (smsError) {
                console.error(`❌ [WEBHOOK SMS ERROR] Failed to send: ${smsError.message}`);
            }

        } else {
            console.log(`⚠️ [WEBHOOK] Payment Status changed to: ${status_code} for Order: ${order_id}`);
        }
    } else {
        console.warn(`🚫 [WEBHOOK] HASH MISMATCH: Potential fraud attempt for Order: ${order_id}`);
    }

    // Always return 200 OK to PayHere to acknowledge receipt
    res.status(200).send();
});


// SERVER INITIALIZATION

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🛡️  SMS API Security requires header: x-api-key`);
    console.log(`=============================================`);
});