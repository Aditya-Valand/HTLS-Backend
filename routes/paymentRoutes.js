// routes/payment.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/early-bird-status', paymentController.getEarlyBirdStatus);
router.post('/create-order', paymentController.createOrder);
router.post('/verify-payment', paymentController.verifyPayment);
router.get('/user-tickets/:email', paymentController.getUserTickets); // New route

module.exports = router;