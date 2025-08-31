// routes/payment.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// router.get('/early-bird-status', paymentController.getEarlyBirdStatus);
router.post('/create-order', paymentController.createOrder);
router.post('/verify-payment', paymentController.verifyPayment);
router.get('/user-tickets/:email', paymentController.getUserTickets); // New route
// NEW ROUTE: Add this line
router.post('/create-offline-order', paymentController.createOfflineOrder);
router.post('/confirm-offline/:orderId', paymentController.confirmOfflineOrder);
router.post('/resend-email/:orderId', paymentController.resendConfirmationEmail);
router.post('/send-bulk-reminders', paymentController.sendBulkOfflineReminders);
// Add this line in routes/paymentRoutes.js
// It can go after your other routes, before module.exports

router.get('/total-sold', paymentController.getTotalSoldTickets);
module.exports = router;