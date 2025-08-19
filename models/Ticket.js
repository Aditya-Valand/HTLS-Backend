const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    studentName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    razorpayOrderId: {
        type: String,
        required: false
    },
    razorpayPaymentId: {
        type: String
    },
    isEarlyBird: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled','offline_pending'],
        default: 'pending'
    },
    orderQuantity: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    ticketNumber: {
        type: Number,
        required: true,
        min: 1
    },
    ticketPrice: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Compound index to ensure unique ticket numbers within an order
ticketSchema.index({ razorpayOrderId: 1, ticketNumber: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', ticketSchema);