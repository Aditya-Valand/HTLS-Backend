const Razorpay = require('razorpay');
const shortid = require('shortid');
const crypto = require('crypto');
// const DjTicket = require('../models/DjTicket');
const Ticket = require('../models/Ticket'); // This is our Mongoose Model
const { sendConfirmationEmail,sendOfflineReservationEmail  } = require('../utils/mailer');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// const EARLY_BIRD_LIMIT = 102;
// const TICKET_PRICE_EARLY = 494;
const TICKET_PRICE_REGULAR = 549;
const MAX_TICKETS_PER_ORDER = 5;


// Add this to controllers/paymentController.js

// Add this new function to controllers/paymentController.js
// Add this to controllers/paymentController.js

// In controllers/paymentController.js
// Add this new function in controllers/paymentController.js

const DjTicket = require('../models/DjTicket'); // 1. Import the new model at the top

const DJ_TICKET_PRICE = 499; // Set the price for the DJ party ticket

exports.createDjOrder = async (req, res) => {
    const { name, email, phone, ticketCount } = req.body;

    if (!name || !email || !phone || !ticketCount) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const quantity = parseInt(ticketCount);
    const totalAmount = quantity * DJ_TICKET_PRICE;

    try {
        const options = {
            amount: totalAmount * 100, // to paise
            currency: 'INR',
            receipt: `receipt_dj_${shortid.generate()}`,
            notes: {
                order_type: 'dj_party', // <-- This is key for verification
                ticketQuantity: quantity.toString(),
                customerEmail: email
            }
        };

        const order = await razorpay.orders.create(options);

        // Create a single booking record
        await DjTicket.create({
            name,
            email,
            phone,
            ticketCount: quantity,
            ticketId: `DJHTLS-${shortid.generate()}`,
            razorpayOrderId: order.id,
            status: 'pending',
            ticketPrice: DJ_TICKET_PRICE
        });

        res.json(order);

    } catch (error) {
        console.error('Error creating DJ party order:', error);
        res.status(500).json({ message: 'Server error while creating DJ order.' });
    }
};

exports.sendBulkOfflineReminders = async (req, res) => {
    const { secret } = req.body;

    if (secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }

    try {
        // Define emails to EXCLUDE (your test/admin accounts)
        const adminEmails = [
            'bhatiyaditya4555@gmail.com', // Add your email here
            'test@example.com'
        ];

        // Find all tickets with pending status, excluding admin emails
        const ticketsToNotify = await Ticket.find({
            status: 'offline_pending',
            email: { $nin: adminEmails },
        });

        if (ticketsToNotify.length === 0) {
            return res.json({ message: 'No pending orders found to notify.' });
        }

        // Group tickets by order to send one email per order
        const orders = new Map();
        ticketsToNotify.forEach(ticket => {
            if (!orders.has(ticket.razorpayOrderId)) {
                orders.set(ticket.razorpayOrderId, []);
            }
            orders.get(ticket.razorpayOrderId).push(ticket);
        });

        let emailsSentCount = 0;
        for (const [orderId, tickets] of orders.entries()) {
            const firstTicket = tickets[0];
            const totalAmount = tickets.reduce((sum, t) => sum + t.ticketPrice, 0);
            
            await sendOfflineReservationEmail(firstTicket.email, {
                name: firstTicket.studentName,
                orderId: orderId,
                totalAmount: totalAmount,
                ticketQuantity: tickets.length
            });
            emailsSentCount++;
        }

        res.json({
            status: 'success',
            message: `${emailsSentCount} reminder email(s) sent successfully.`
        });

    } catch (error) {
        console.error('Error sending bulk offline reminders:', error);
        res.status(500).json({ message: 'Server error during bulk reminder process.' });
    }
};

exports.resendOfflineReservationEmail = async (req, res) => {
    const { orderId } = req.params;
    const { secret } = req.body;

    // 1. Secure the route with your admin secret key
    if (secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }

    try {
        // 2. Find the tickets for the given order ID that are still pending
        const pendingTickets = await Ticket.find({ 
            razorpayOrderId: orderId,
            status: 'offline_pending' 
        });

        if (!pendingTickets || pendingTickets.length === 0) {
            return res.status(404).json({ message: 'No pending offline order found with that ID.' });
        }

        // 3. Gather details for the email
        const firstTicket = pendingTickets[0];
        const totalAmount = pendingTickets.reduce((sum, ticket) => sum + ticket.ticketPrice, 0);

        // 4. Re-use the existing email function to send the reminder
        await sendOfflineReservationEmail(firstTicket.email, {
            name: firstTicket.studentName,
            orderId: firstTicket.razorpayOrderId,
            totalAmount: totalAmount,
            ticketQuantity: pendingTickets.length
        });

        res.json({ 
            status: 'success', 
            message: `Offline reservation reminder resent to ${firstTicket.email}.` 
        });

    } catch (error) {
        console.error('Error resending offline reservation email:', error);
        res.status(500).json({ message: 'Server error while resending email.' });
    }
};

exports.getTotalSoldTickets = async (req, res) => {
    try {
        // Count only tickets that are confirmed (paid for)
        const soldCount = await Ticket.countDocuments({ status: 'confirmed' });
        
        res.status(200).json({
            totalSold: soldCount
        });
    } catch (error) {
        console.error('Error fetching total sold tickets:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
// REPLACE your old createOrder function with this one
exports.createOrder = async (req, res) => {
    const { name, email, department, semester, ticketQuantity = 1, stayTiming } = req.body;

    if (!name || !email || !department || !semester || !stayTiming) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }
    const quantity = parseInt(ticketQuantity);
    if (!quantity || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
        return res.status(400).json({ message: `Ticket quantity must be between 1 and ${MAX_TICKETS_PER_ORDER}.` });
    }

    // --- New Group Discount Price Calculation Logic ---
    let totalAmount = 0;
    let priceBreakdown = [];

    if (quantity === 4) {
        // Buy 3, Get 4th at 20% OFF
        const fullPriceTickets = 3;
        const discountedPrice = TICKET_PRICE_REGULAR * 0.80; // 20% off
        totalAmount = (fullPriceTickets * TICKET_PRICE_REGULAR) + discountedPrice;
        priceBreakdown.push({ tickets: 3, price: TICKET_PRICE_REGULAR });
        priceBreakdown.push({ tickets: 1, price: discountedPrice });
    } else if (quantity === 5) {
        // Buy 4, Get 5th at 30% OFF
        const fullPriceTickets = 4;
        const discountedPrice = TICKET_PRICE_REGULAR * 0.70; // 30% off
        totalAmount = (fullPriceTickets * TICKET_PRICE_REGULAR) + discountedPrice;
        priceBreakdown.push({ tickets: 4, price: TICKET_PRICE_REGULAR });
        priceBreakdown.push({ tickets: 1, price: discountedPrice });
    } else {
        // Standard pricing for 1, 2, or 3 tickets
        totalAmount = quantity * TICKET_PRICE_REGULAR;
        priceBreakdown.push({ tickets: quantity, price: TICKET_PRICE_REGULAR });
    }
    // --- End of New Logic ---

    try {
        const options = {
            amount: Math.round(totalAmount * 100), // Convert to paise and round it
            currency: 'INR',
            receipt: `receipt_ticket_${shortid.generate()}`,
            notes: {
                ticketQuantity: quantity.toString(),
                customerEmail: email,
                customerName: name
            }
        };

        const order = await razorpay.orders.create(options);
        
        const ticketPromises = [];
        for (let i = 0; i < quantity; i++) {
            let ticketPrice = TICKET_PRICE_REGULAR;
            if (quantity === 4 && i === 3) { // 4th ticket is discounted
                ticketPrice = TICKET_PRICE_REGULAR * 0.80;
            } else if (quantity === 5 && i === 4) { // 5th ticket is discounted
                ticketPrice = TICKET_PRICE_REGULAR * 0.70;
            }

            ticketPromises.push(
                Ticket.create({
                    studentName: name,
                    email: email,
                    department: department,
                    semester: semester,
                    ticketId: `HTLS-${shortid.generate()}`,
                    razorpayOrderId: order.id,
                    status: 'pending',
                    stayTiming: stayTiming,
                    orderQuantity: quantity,
                    ticketNumber: i + 1,
                    ticketPrice: Math.round(ticketPrice)
                })
            );
        }

        await Promise.all(ticketPromises);

        res.json({
            ...order,
            ticketBreakdown: {
                totalTickets: quantity,
                breakdown: priceBreakdown,
                totalAmount: totalAmount
            }
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Server error while creating order.' });
    }
};

// REPLACE your old createOfflineOrder function with this one
exports.createOfflineOrder = async (req, res) => {
    const { name, email, department, semester, ticketQuantity = 1, stayTiming } = req.body;

    if (!name || !email || !department || !semester || !stayTiming) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }
    const quantity = parseInt(ticketQuantity);
    if (!quantity || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
        return res.status(400).json({ message: `Ticket quantity must be between 1 and ${MAX_TICKETS_PER_ORDER}.` });
    }

    // --- New Group Discount Price Calculation Logic ---
    let totalAmount = 0;
    if (quantity === 4) {
        const fullPriceTickets = 3;
        const discountedPrice = TICKET_PRICE_REGULAR * 0.80;
        totalAmount = (fullPriceTickets * TICKET_PRICE_REGULAR) + discountedPrice;
    } else if (quantity === 5) {
        const fullPriceTickets = 4;
        const discountedPrice = TICKET_PRICE_REGULAR * 0.70;
        totalAmount = (fullPriceTickets * TICKET_PRICE_REGULAR) + discountedPrice;
    } else {
        totalAmount = quantity * TICKET_PRICE_REGULAR;
    }
    // --- End of New Logic ---

    try {
        const offlineOrderId = `offline-${shortid.generate()}`;
        const ticketPromises = [];
        for (let i = 0; i < quantity; i++) {
             let ticketPrice = TICKET_PRICE_REGULAR;
            if (quantity === 4 && i === 3) {
                ticketPrice = TICKET_PRICE_REGULAR * 0.80;
            } else if (quantity === 5 && i === 4) {
                ticketPrice = TICKET_PRICE_REGULAR * 0.70;
            }
            
            ticketPromises.push(
                Ticket.create({
                    studentName: name,
                    email: email,
                    department: department,
                    semester: semester,
                    ticketId: `HTLS-${shortid.generate()}`,
                    razorpayOrderId: offlineOrderId,
                    status: 'offline_pending',
                    orderQuantity: quantity,
                    stayTiming: stayTiming,
                    ticketNumber: i + 1,
                    ticketPrice: Math.round(ticketPrice)
                })
            );
        }
        await Promise.all(ticketPromises);
        await sendOfflineReservationEmail(email, { 
    name, 
    orderId: offlineOrderId, 
    totalAmount: Math.round(totalAmount), 
    ticketQuantity: quantity 
});
        
        res.status(201).json({ 
            message: 'Offline ticket reservation successful!',
            orderId: offlineOrderId,
            totalAmount: Math.round(totalAmount),
            ticketQuantity: quantity,
        });

    } catch (error) {
        console.error('Error creating offline order:', error);
        res.status(500).json({ message: 'Server error while creating offline order.' });
    }
};
// At the top of controllers/paymentController.js, make sure you import both models:
// const Ticket = require('../models/Ticket');
// const DjTicket = require('../models/DjTicket');


// REPLACE your old verifyPayment function with this new one:
exports.verifyPayment = async (req, res) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
        return res.status(400).json({ message: 'Invalid signature.' });
    }

    const event = req.body.event;
    
    if (event === 'payment.captured') {
        const paymentEntity = req.body.payload.payment.entity;
        const { order_id, id: payment_id, notes } = paymentEntity;

        try {
            // --- SMART LOGIC ---
            // Check the order_type note to determine which ticket model to update
            if (notes.order_type === 'dj_party') {
                // It's a DJ Party Ticket
                const djTicket = await DjTicket.findOne({ razorpayOrderId: order_id });

                if (djTicket) {
                    djTicket.status = 'confirmed';
                    djTicket.razorpayPaymentId = payment_id;
                    await djTicket.save();
                    // Optional: You could create and send a specific DJ party confirmation email here
                    // await sendDjPartyConfirmationEmail(djTicket.email, djTicket);
                } else {
                    console.error(`DJ ticket with order_id ${order_id} not found.`);
                }
            } else {
                // It's a Main Event Ticket (your original logic)
                await Ticket.updateMany(
                    { razorpayOrderId: order_id },
                    { 
                        razorpayPaymentId: payment_id,
                        status: 'confirmed' 
                    }
                );
                
                const confirmedTickets = await Ticket.find({ razorpayOrderId: order_id });
                if (confirmedTickets.length > 0) {
                    await sendConfirmationEmail(confirmedTickets[0].email, confirmedTickets);
                } else {
                     console.error(`Main event ticket with order_id ${order_id} not found.`);
                }
            }
            // --- END OF SMART LOGIC ---
            
            res.json({ status: 'ok' });

        } catch (error) {
            console.error('Error verifying payment:', error);
            res.status(500).json({ message: 'Server error during verification.' });
        }
    } else {
        res.json({ status: 'ok' });
    }
};

// New endpoint to get user's ticket orders
exports.getUserTickets = async (req, res) => {
    const { email } = req.params;
    
    try {
        const tickets = await Ticket.find({ 
            email: email,
            status: 'confirmed' 
        }).sort({ createdAt: -1 });
        
        // Group tickets by order
        const groupedTickets = tickets.reduce((acc, ticket) => {
            const orderId = ticket.razorpayOrderId;
            if (!acc[orderId]) {
                acc[orderId] = [];
            }
            acc[orderId].push(ticket);
            return acc;
        }, {});
        
        res.json({
            totalTickets: tickets.length,
            orders: groupedTickets
        });
        
    } catch (error) {
        console.error('Error fetching user tickets:', error);
        res.status(500).json({ message: 'Server error fetching tickets.' });
    }
};

exports.confirmOfflineOrder = async (req, res) => {
    const { orderId } = req.params;
    const { secret } = req.body;

    if (secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }

    try {
        const ticketsToConfirm = await Ticket.find({ 
            razorpayOrderId: orderId,
            status: 'offline_pending' 
        });

        if (!ticketsToConfirm || ticketsToConfirm.length === 0) {
            return res.status(404).json({ message: 'No pending offline order found with that ID.' });
        }

        await Ticket.updateMany(
            { razorpayOrderId: orderId },
            { status: 'confirmed' }
        );

        const confirmedTickets = await Ticket.find({ razorpayOrderId: orderId });

        if (confirmedTickets.length > 0) {
            await sendConfirmationEmail(confirmedTickets[0].email, confirmedTickets);
        }

        res.json({ 
            status: 'success', 
            message: `${confirmedTickets.length} ticket(s) confirmed for ${confirmedTickets[0].email}. Email sent.` 
        });

    } catch (error) {
        console.error('Error confirming offline order:', error);
        res.status(500).json({ message: 'Server error during offline confirmation.' });
    }
};
// controllers/paymentController.js
// ... (add this entire function at the end of the file)

exports.resendConfirmationEmail = async (req, res) => {
    const { orderId } = req.params;
    const { secret } = req.body;

    // Use the same admin secret key for security
    if (secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }

    try {
        // Find the tickets that are already confirmed with this order ID
        const confirmedTickets = await Ticket.find({ 
            razorpayOrderId: orderId,
            status: 'confirmed' 
        });

        if (!confirmedTickets || confirmedTickets.length === 0) {
            return res.status(404).json({ message: 'No confirmed order found with that ID.' });
        }

        // Trigger the existing email function
        await sendConfirmationEmail(confirmedTickets[0].email, confirmedTickets);

        res.json({ 
            status: 'success', 
            message: `Email resent for ${confirmedTickets.length} ticket(s) to ${confirmedTickets[0].email}.` 
        });

    } catch (error) {
        console.error('Error resending email:', error);
        res.status(500).json({ message: 'Server error while resending email.' });
    }
};