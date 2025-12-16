import nodemailer from 'nodemailer';
import dotenv from "dotenv";

dotenv.config();

// Configure transporter once
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: import.meta.env.COMPANY_EMAIL,
    pass: import.meta.env.EMAIL_PASSWORD
  }
});

export async function sendWelcomeEmail(first_name, email, app_name = "PC Builder") {
  try {
    const mailOptions = {
      from: `"Karam Singh" <${import.meta.env.COMPANY_EMAIL}>`,
      to: email,
      subject: `Getting started with ${app_name}`,
      text: `Hi ${first_name},\n\nThank you for installing ${app_name}.\n\nWe're here to help you make the most of the app.\nIf you have any questions or need assistance, feel free to reply to this email.\n\nBest regards,\nKaram Singh\nFounder, Miracle Websoft`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, sans-serif; background: #f7f7f7; padding: 20px; }
    .email-container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .header { background: #568d44; color: #fff; padding: 25px; text-align: center; }
    .content { padding: 20px; color: #333; }
    .footer { padding: 15px; background: #f0f0f0; text-align: center; font-size: 13px; color: #666; }
    a { color: #568d44; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h2 style="margin: 0;">Welcome to ${app_name}</h2>
    </div>
    <div class="content">
      <p>Hi ${first_name},</p>
      <p>Thank you for installing <strong>${app_name}</strong>.</p>
      <p>If you have any questions while setting things up or run into issues, you can simply reply to this email and we'll be happy to assist.</p>
      <p>We hope ${app_name} helps improve your store experience.</p>
    </div>
    <div class="footer">
      <p>Karam Singh<br>Founder, <a href="https://miraclewebsoft.com">Miracle Websoft</a></p>
      <p>&copy; ${new Date().getFullYear()} Miracle Websoft</p>
    </div>
  </div>
</body>
</html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}


export async function sendGoodbyeEmail(first_name, email, app_name = "PC Builder") {
  try {
    const mailOptions = {
      from: `"Karam Singh" <${import.meta.env.COMPANY_EMAIL}>`,
      to: email,
      subject: `You’ve uninstalled ${app_name}`,
      text: `Hi ${first_name},\n\nWe noticed that ${app_name} was uninstalled from your store.\n\nIf you have a moment, we’d appreciate your feedback on your experience. It helps us improve.\n\nIf you uninstalled by mistake, you can reinstall the app anytime from the Shopify App Store.\n\nThank you for giving it a try.\n\nBest,\nKaram Singh\nFounder, Miracle Websoft`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, sans-serif; background: #f7f7f7; padding: 20px; }
    .email-container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .header { background: #568d44; color: #fff; padding: 25px; text-align: center; }
    .content { padding: 20px; color: #333; }
    .footer { padding: 15px; background: #f0f0f0; text-align: center; font-size: 13px; color: #666; }
    a { color: #568d44; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h2 style="margin: 0;">${app_name} has been removed</h2>
    </div>
    <div class="content">
      <p>Hi ${first_name},</p>
      <p>We noticed that <strong>${app_name}</strong> has been uninstalled from your store.</p>
      <p>If there's anything we could have done better, we’d love your feedback. Just reply to this email with your thoughts.</p>
      <p>You can always reinstall ${app_name} from the <a href="https://apps.shopify.com/sections-warehouse-by-mw">Shopify App Store</a> if needed in the future.</p>
      <p>Thank you for trying the app.</p>
    </div>
    <div class="footer">
      <p>Karam Singh<br>Founder, <a href="https://miraclewebsoft.com">Miracle Websoft</a></p>
      <p>&copy; ${new Date().getFullYear()} Miracle Websoft</p>
    </div>
  </div>
</body>
</html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Goodbye email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending goodbye email:', error);
    throw error;
  }
}