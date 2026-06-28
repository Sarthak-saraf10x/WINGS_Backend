const nodemailer = require('nodemailer');

const isEmailConfigured = 
  process.env.EMAIL_USER && 
  process.env.EMAIL_USER !== 'your_email@gmail.com' &&
  process.env.EMAIL_PASS && 
  process.env.EMAIL_PASS !== 'mock_pass';

let transporter;

if (isEmailConfigured) {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('Email service configured.');
} else {
  console.log('Email SMTP settings missing or set to defaults. Operating in log-only mode.');
}

/**
 * Sends a notification email to the owner about a new booking lead.
 */
const sendBookingNotification = async (bookingData) => {
  const mailOptions = {
    from: `"Wings Booking Alerts" <${process.env.EMAIL_USER || 'no-reply@gmail.com'}>`,
    to: process.env.OWNER_EMAIL || process.env.EMAIL_USER,
    subject: `🚨 New Ride Booking Request: ${bookingData.name}`,
    html: `
      <h2>New Booking Reservation Logged</h2>
      <p>A new customer booking query was submitted via the website form.</p>
      <table style="border: 1px solid #ddd; border-collapse: collapse; width: 100%; font-family: sans-serif;">
        <tr style="background-color: #f2f2f2;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Field</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Details</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Customer Name</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingData.name}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Phone Number</td>
          <td style="border: 1px solid #ddd; padding: 8px;"><a href="tel:${bookingData.phone}">${bookingData.phone}</a></td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Service</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingData.service}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Pickup Location</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingData.pickup}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Destination</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingData.destination}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Travel Date</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${new Date(bookingData.travelDate).toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Number of People</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingData.people}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Special Request</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingData.message || 'None'}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">
        <a href="https://wa.me/91${bookingData.phone.replace(/[^0-9]/g, '')}" 
           style="background-color: #25D366; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
           Chat on WhatsApp
        </a>
      </p>
    `
  };

  if (isEmailConfigured) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Booking notification email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`Failed to send booking notification email: ${error.message}`);
    }
  } else {
    console.log('--- MOCK EMAIL OUTBOX: NEW BOOKING ---');
    console.log(`To: ${mailOptions.to}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Customer details:`, bookingData);
    console.log('---------------------------------------');
  }
};

/**
 * Sends a notification email to the owner about a new contact enquiry.
 */
const sendEnquiryNotification = async (enquiryData) => {
  const mailOptions = {
    from: `"Wings Enquiry Alerts" <${process.env.EMAIL_USER || 'no-reply@gmail.com'}>`,
    to: process.env.OWNER_EMAIL || process.env.EMAIL_USER,
    subject: `✉️ New Contact Inquiry: ${enquiryData.name}`,
    html: `
      <h2>New Contact Inquiry Submitted</h2>
      <p>A customer filled out the "Get In Touch With Wings" section.</p>
      <table style="border: 1px solid #ddd; border-collapse: collapse; width: 100%; font-family: sans-serif;">
        <tr style="background-color: #f2f2f2;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Field</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Details</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Sender Name</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${enquiryData.name}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Phone Number</td>
          <td style="border: 1px solid #ddd; padding: 8px;"><a href="tel:${enquiryData.phone}">${enquiryData.phone}</a></td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Email Address</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${enquiryData.email || 'Not Provided'}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Message</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${enquiryData.message}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">
        <a href="https://wa.me/91${enquiryData.phone.replace(/[^0-9]/g, '')}" 
           style="background-color: #25D366; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
           Chat on WhatsApp
        </a>
      </p>
    `
  };

  if (isEmailConfigured) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Enquiry notification email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`Failed to send enquiry notification email: ${error.message}`);
    }
  } else {
    console.log('--- MOCK EMAIL OUTBOX: NEW CONTACT ENQUIRY ---');
    console.log(`To: ${mailOptions.to}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Enquiry details:`, enquiryData);
    console.log('----------------------------------------------');
  }
};

module.exports = {
  sendBookingNotification,
  sendEnquiryNotification
};
