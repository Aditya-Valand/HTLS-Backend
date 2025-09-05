// models/DjTicket.js

const mongoose = require('mongoose');

const djTicketSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    ticketCount: { type: Number, required: true },

    // --- Fields needed for payment processing ---
    ticketId: { type: String, required: true, unique: true },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'failed'], 
        default: 'pending' 
    },
    ticketPrice: { type: Number, required: true },

}, { timestamps: true });

module.exports = mongoose.model('DjTicket', djTicketSchema);