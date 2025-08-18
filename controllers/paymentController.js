const Razorpay = require('razorpay');
const shortid = require('shortid');
const crypto = require('crypto');
const Ticket = require('../models/Ticket'); // This is our Mongoose Model

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const EARLY_BIRD_LIMIT = 102;
const TICKET_PRICE_EARLY = 494;
const TICKET_PRICE_REGULAR = 549;
const MAX_TICKETS_PER_ORDER = 5;

exports.getEarlyBirdStatus = async (req, res) => {
    try {
        const confirmedTickets = await Ticket.countDocuments({ status: 'confirmed' });
        const ticketsLeft = Math.max(0, EARLY_BIRD_LIMIT - confirmedTickets);
        res.json({
            ticketsSold: confirmedTickets,
            ticketsLeft: ticketsLeft,
            totalEarlyBirdTickets: EARLY_BIRD_LIMIT,
        });
    } catch (error) {
        console.error('Error getting early bird status:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.createOrder = async (req, res) => {
    const { name, email, department, ticketQuantity = 1 } = req.body;

    // Validation
    if (!name || !email || !department) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    if (!ticketQuantity || ticketQuantity < 1 || ticketQuantity > MAX_TICKETS_PER_ORDER) {
        return res.status(400).json({ 
            message: `Ticket quantity must be between 1 and ${MAX_TICKETS_PER_ORDER}.` 
        });
    }

    try {
        const confirmedTicketsCount = await Ticket.countDocuments({ status: 'confirmed' });
        
        // Check if enough early bird tickets are available
        const availableEarlyBird = Math.max(0, EARLY_BIRD_LIMIT - confirmedTicketsCount);
        
        let earlyBirdTickets = 0;
        let regularTickets = 0;
        
        if (availableEarlyBird >= ticketQuantity) {
            // All tickets can be early bird
            earlyBirdTickets = ticketQuantity;
        } else if (availableEarlyBird > 0) {
            // Some tickets are early bird, rest are regular
            earlyBirdTickets = availableEarlyBird;
            regularTickets = ticketQuantity - availableEarlyBird;
        } else {
            // All tickets are regular price
            regularTickets = ticketQuantity;
        }
        
        const totalAmount = (earlyBirdTickets * TICKET_PRICE_EARLY) + (regularTickets * TICKET_PRICE_REGULAR);

        const options = {
            amount: totalAmount * 100, // Convert to paise
            currency: 'INR',
            receipt: `receipt_ticket_${shortid.generate()}`,
            notes: {
                ticketQuantity: ticketQuantity.toString(),
                earlyBirdTickets: earlyBirdTickets.toString(),
                regularTickets: regularTickets.toString(),
                customerEmail: email,
                customerName: name
            }
        };

        const order = await razorpay.orders.create(options);

        // Create individual ticket records for each ticket
        const ticketPromises = [];
        
        for (let i = 0; i < ticketQuantity; i++) {
            const isEarlyBird = i < earlyBirdTickets;
            
            ticketPromises.push(
                Ticket.create({
                    studentName: name,
                    email: email,
                    department: department,
                    ticketId: `HTLS-${shortid.generate()}`,
                    razorpayOrderId: order.id,
                    isEarlyBird: isEarlyBird,
                    status: 'pending',
                    orderQuantity: ticketQuantity,
                    ticketNumber: i + 1, // Track which ticket this is in the order
                    ticketPrice: isEarlyBird ? TICKET_PRICE_EARLY : TICKET_PRICE_REGULAR
                })
            );
        }

        await Promise.all(ticketPromises);

        // Return order details with pricing breakdown
        res.json({
            ...order,
            ticketBreakdown: {
                totalTickets: ticketQuantity,
                earlyBirdTickets: earlyBirdTickets,
                regularTickets: regularTickets,
                earlyBirdPrice: TICKET_PRICE_EARLY,
                regularPrice: TICKET_PRICE_REGULAR,
                totalAmount: totalAmount
            }
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Server error while creating order.' });
    }
};

exports.verifyPayment = async (req, res) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const shasum = crypto.createHmac('sha256', secret); // Fixed typo: sha26 -> sha256
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
        return res.status(400).json({ message: 'Invalid signature.' });
    }

    const event = req.body.event;
    
    if (event === 'payment.captured') {
        const { order_id, id: payment_id } = req.body.payload.payment.entity;

        try {
            // Update all tickets associated with this order
            const tickets = await Ticket.find({ razorpayOrderId: order_id });

            if (!tickets || tickets.length === 0) {
                return res.status(404).json({ message: 'Tickets not found.' });
            }

            // Update all tickets in the order
            await Ticket.updateMany(
                { razorpayOrderId: order_id },
                { 
                    razorpayPaymentId: payment_id,
                    status: 'confirmed' 
                }
            );
            
            console.log(`✅ ${tickets.length} ticket(s) confirmed for ${tickets[0].email}`);
            
            // TODO: Trigger email sending logic here with all ticket details
            
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