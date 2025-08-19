const nodemailer = require('nodemailer');
const qrcode = require('qrcode');

// Configure the email transporter using your Gmail account
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD 
    }
});

// This function generates the HTML for the email (no changes needed here)
const generateEmailHtml = (ticketsWithQRs) => {
    const ticketHtml = ticketsWithQRs.map((ticket, index) => `
        <div style="border-top: 1px solid #dddddd; padding: 20px 0; text-align: left;">
            <h3 style="font-size: 20px; color: #333333; margin-top: 0;">Ticket ${index + 1} of ${ticketsWithQRs.length}</h3>
            <p><strong>Name:</strong> ${ticket.studentName}</p>
            <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
            <p><strong>Stay Duration:</strong> ${ticket.stayTiming === 'full_day' ? 'Full Day (10am - 10pm)' : 'Half Day (10am - 6pm)'}</p>
            <div style="text-align: center; margin-top: 15px;">
                <img src="${ticket.qrCodeUrl}" alt="Ticket QR Code" style="width: 150px; height: 150px;"/>
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
                <h2 style="color: #333333;">Hey ${ticketsWithQRs[0].studentName}, you're all set!</h2>
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

// Main function to send the confirmation email (no changes needed here)
exports.sendConfirmationEmail = async (recipientEmail, tickets) => {
    try {
        const ticketsWithQRs = await Promise.all(tickets.map(async (ticket) => {
            const qrCodeUrl = await qrcode.toDataURL(ticket.ticketId);
            return { ...ticket.toObject(), qrCodeUrl };
        }));

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
            to: recipientEmail,
            subject: 'Your HTLS 2K25 Ticket Confirmation & QR Codes',
            html: generateEmailHtml(ticketsWithQRs)
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Confirmation email sent successfully to ${recipientEmail}`);

    } catch (error) {
        console.error(`❌ Error sending confirmation email:`, error);
    }
};