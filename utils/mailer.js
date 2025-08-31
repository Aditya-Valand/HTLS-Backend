const nodemailer = require('nodemailer');
const qrcode = require('qrcode');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD 
    }
});

// --- CHANGE #1: Use a 'cid' to reference the attached image ---
const generateEmailHtml = (ticketsWithCIDs) => {
    const ticketHtml = ticketsWithCIDs.map((ticket, index) => `
        <div style="border-top: 1px solid #dddddd; padding: 20px 0; text-align: left;">
            <h3 style="font-size: 20px; color: #333333; margin-top: 0;">Ticket ${index + 1} of ${ticketsWithCIDs.length}</h3>
            <p><strong>Name:</strong> ${ticket.studentName}</p>
            <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
            <p><strong>Stay Duration:</strong> ${ticket.stayTiming === 'full_day' ? 'Full Day (10am - 10pm)' : 'Half Day (10am - 6pm)'}</p>
            <div style="text-align: center; margin-top: 15px;">
                <img src="cid:${ticket.cid}" alt="Ticket QR Code" style="width: 150px; height: 150px;"/>
                <p style="font-size: 12px; color: #666;">Scan this at the entry gate.</p>
            </div>
        </div>
    `).join('');

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #f59e0b; color: #ffffff; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">HTLS 2K25 Ticket Confirmation</h1>
            </div>
            <div style="padding: 20px;">
                <h2 style="color: #333333;">Hey ${ticketsWithCIDs[0].studentName}, you're all set!</h2>
                <p style="color: #555555; line-height: 1.6;">
                    Thank you for your purchase! We are thrilled to have you at Hungama x The Last Submission 2K25. Below are your unique QR code tickets for entry.
                </p>
                ${ticketHtml}
            </div>
            <div style="background-color: #f4f4f4; color: #666666; padding: 15px; text-align: center; font-size: 12px;">
                <p>If you have any questions, feel free to reach out to our support team.</p>
                <p>&copy; 2025 HTLS Team. All Rights Reserved.</p>
            </div>
        </div>
    `;
};


exports.sendConfirmationEmail = async (recipientEmail, tickets) => {
    try {
        // Generate QR codes and prepare attachments
        const attachments = await Promise.all(tickets.map(async (ticket, index) => {
            const qrCodeBuffer = await qrcode.toBuffer(ticket.ticketId);
            const cid = `qrcode_${index}@htls.xyz`; // Unique CID for each QR code
            return {
                filename: `qrcode-${index}.png`,
                content: qrCodeBuffer,
                encoding: 'base64',
                cid: cid, // This CID links the attachment to the <img> tag
                ticketData: ticket.toObject() // Pass along ticket data
            };
        }));

        // Map ticket data with their CIDs for the HTML generator
        const ticketsWithCIDs = attachments.map(att => ({ ...att.ticketData, cid: att.cid }));

        // --- CHANGE #2: Add the 'attachments' array to mailOptions ---
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
            to: recipientEmail,
            subject: 'Your HTLS 2K25 Ticket Confirmation & QR Codes',
            html: generateEmailHtml(ticketsWithCIDs),
            attachments: attachments.map(({ ticketData, ...att }) => att) // Remove extra ticketData before sending
        };

        await transporter.sendMail(mailOptions);
        

    } catch (error) {
        console.error(`❌ Error sending confirmation email:`, error);
    }
};

exports.sendOfflineReservationEmail = async (email, details) => {
    const { name, orderId, totalAmount, ticketQuantity } = details;

    // --- The WhatsApp link for payment coordination ---
    const organizerPhoneNumber = "918469434555"; // Make sure this is correct
    const message = `Hello HTLS Team,\n\nI'm ready to complete my payment for my offline reservation.\n\n- Name: ${name}\n- Order ID: ${orderId}\n- Amount to Pay: ₹${totalAmount}\n\nPlease guide me on the next steps.`;
    const whatsappUrl = `https://wa.me/${organizerPhoneNumber}?text=${encodeURIComponent(message)}`;

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: 'ACTION REQUIRED: Complete Your HTLS 2K25 Ticket Payment!',
        html: `
            <div style="font-family: Arial, sans-serif; color: #e5e7eb; background-color: #111827; padding: 20px; border-radius: 10px; border: 1px solid #eab308;">
                <h1 style="color: #eab308; text-align: center;">You're Almost In!</h1>
                <p style="font-size: 16px;">Hi ${name},</p>
                <p style="font-size: 16px;">Thank you for reserving your ticket(s) for <strong>Hungama x The Last Submission 2K25</strong>! Your spot is held, but not yet confirmed.</p>
                <p style="font-size: 16px;">To lock in your ticket, simply complete your payment. Here’s a glimpse of the unforgettable experience waiting for you:</p>
                
                <ul style="font-size: 16px; list-style-type: none; padding-left: 0;">
                    <li style="margin-bottom: 10px;">🍽️ <strong>All-Day Culinary Experience:</strong> Enjoy complimentary Lunch, Dinner, and Snacks on us!</li>
                    <li style="margin-bottom: 10px;">😂 <strong>Live Stand-up Comedy:</strong> Get ready for some side-splitting laughter.</li>
                    <li style="margin-bottom: 10px;">🎪 <strong>Carnival Games & Activities:</strong> Unleash your inner child with fun and games.</li>
                    <li style="margin-bottom: 10px;">🎁 <strong>Exciting Sponsor Gifts:</strong> Take home some amazing goodies from our partners.</li>
                    <li style="margin-bottom: 10px;">💸 <strong>100% Cashback Chance:</strong> You could win your entire ticket price back!</li>
                    <li style="margin-bottom: 10px;">🎧 <strong>Epic DJ Night:</strong> Dance the night away with the incredible DJ Boy Jockey!</li>
                </ul>

                <h3 style="color: #e5e7eb; border-top: 1px solid #374151; padding-top: 15px;">Your Reservation Details:</h3>
                <p style="font-size: 16px;"><strong>Order ID:</strong> ${orderId}</p>
                <p style="font-size: 16px;"><strong>Tickets:</strong> ${ticketQuantity}</p>
                <p style="font-size: 18px;"><strong>Amount to Pay:</strong> ₹${totalAmount}</p>

                <p style="text-align: center; margin-top: 30px;">
                    <a href="${whatsappUrl}" target="_blank" style="background-color: #25D366; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">
                        Pay Now & Confirm Ticket
                    </a>
                </p>
                <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 20px;">
                    If you did not make this reservation, please ignore this email.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Offline reservation email sent to ${email}`);
    } catch (error) {
        console.error(`Error sending offline reservation email to ${email}:`, error);
    }
};
// Also make sure to export it along with your other functions
// module.exports = { sendConfirmationEmail, sendOfflineReservationEmail };
