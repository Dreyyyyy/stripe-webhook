// Load environment variables from .env file
require('dotenv').config();

// Import the Express framework
const express = require('express');
const path = require('path');

// Initialize Stripe with your secret key from .env
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create an Express application instance
const app = express();

// Get the webhook signing secret from .env (used to verify webhook events are from Stripe)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Add these lines after creating the app
app.use(express.static('public'));
app.use(express.json());

// Add these new endpoints before the webhook endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/create-payment', async (req, res) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1000,
            currency: 'usd',
        });
        res.json({clientSecret: paymentIntent.client_secret});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.post('/attach-payment-method', async (req, res) => {
    try {
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                number: '4242424242424242',
                exp_month: 12,
                exp_year: 2024,
                cvc: '123',
            },
        });
        res.json({paymentMethod});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Define a POST endpoint at /webhook
// express.raw() is used because Stripe needs the raw body to verify the signature
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
  // Get the stripe signature from the request headers
  const sig = request.headers['stripe-signature'];

  // Declare event variable that will store the verified Stripe event
  let event;

  try {
    // In development, we can bypass signature verification
    if (process.env.NODE_ENV === 'development') {
      event = request.body;
    } else {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.created':  // Add this case
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('PaymentIntent was successful!');
        break;
      case 'payment_method.attached':
        const paymentMethod = event.data.object;
        console.log('PaymentMethod was attached!');
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 success response
    response.json({received: true});

  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
});

app.get('/config', (req, res) => {
    res.json({ 
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
    });
});

// Start the server on port 4242
app.listen(4242, () => console.log('Webhook handler running on port 4242'));