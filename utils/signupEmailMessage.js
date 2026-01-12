// utils/email.js
const sendEmail = require('./sendEmail');

class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Luxe Estates <${process.env.EMAIL_FROM || 'noreply@luxe-estates.com'}>`;
  }

  // Welcome email
  async sendWelcome() {
    await sendEmail({
      email: this.to,
      subject: 'Welcome to Luxe Estates! 🏠',
      text: `Welcome to Luxe Estates, ${this.firstName}!\n\nThank you for joining our community. We're excited to help you find your dream property.\n\nStart exploring now: ${this.url}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to Luxe Estates, ${this.firstName}! 🎉</h1>
          <p>Thank you for joining our community of property enthusiasts.</p>
          <p>We're excited to help you find your dream home or investment property.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Get started:</strong></p>
            <ul>
              <li>Browse properties</li>
              <li>Save favorites to your wishlist</li>
              <li>Schedule property tours</li>
              <li>Connect with expert agents</li>
            </ul>
          </div>
          <a href="${this.url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Start Exploring Properties
          </a>
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      `,
    });
  }

  // Password reset email
  async sendPasswordReset() {
    await sendEmail({
      email: this.to,
      subject: 'Reset Your Luxe Estates Password',
      text: `Forgot your password? Submit a PATCH request with your new password to: ${this.url}\n\nIf you didn't forget your password, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Reset Your Password</h1>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <a href="${this.url}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin: 20px 0;">
            Reset Password
          </a>
          <p>This link will expire in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this, please ignore this email and your password will remain unchanged.
          </p>
        </div>
      `,
    });
  }
}

module.exports = Email;
