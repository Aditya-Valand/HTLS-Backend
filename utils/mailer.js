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
        console.log(`✅ Confirmation email sent successfully to ${recipientEmail}`);

    } catch (error) {
        console.error(`❌ Error sending confirmation email:`, error);
    }
};