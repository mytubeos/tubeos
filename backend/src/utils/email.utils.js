// src/utils/email.utils.js
// FIXED: Brevo API integration for OTP, welcome email, password reset
const axios = require('axios');
const { config } = require('../config/env');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM_ADDRESS || 'noreply@tubeos.in';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Check if Brevo is configured
const isBrevoConfigured = () => !!BREVO_API_KEY;

// ==================== SEND OTP EMAIL ====================
const sendOTPEmail = async (recipientEmail, recipientName, otp) => {
  if (!isBrevoConfigured()) {
    console.log('[sendOTPEmail] Brevo not configured, skipping email');
    return;
  }

  if (!recipientEmail || !otp) {
    throw new Error('Email and OTP are required');
  }

  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">TubeOS</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 0;">AI-Powered YouTube Creator Management</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px 20px; text-align: center;">
          <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>
          <p style="color: #666; font-size: 16px;">Hi ${recipientName},</p>
          <p style="color: #666; font-size: 14px;">Your OTP for email verification is:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #667eea;">
            <p style="font-size: 36px; font-weight: bold; color: #667eea; margin: 0; letter-spacing: 4px;">${otp}</p>
          </div>
          
          <p style="color: #999; font-size: 12px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
        
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">© 2024 TubeOS. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: {
          email: EMAIL_FROM,
          name: 'TubeOS Team',
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        subject: `Your TubeOS Verification Code: ${otp}`,
        htmlContent: emailContent,
        replyTo: {
          email: EMAIL_FROM,
        },
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[sendOTPEmail] OTP email sent successfully to', recipientEmail);
    return response.data;
  } catch (error) {
    console.error('[sendOTPEmail] Error sending OTP email:', {
      email: recipientEmail,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

// ==================== SEND PASSWORD RESET EMAIL ====================
const sendPasswordResetEmail = async (recipientEmail, recipientName, resetToken) => {
  if (!isBrevoConfigured()) {
    console.log('[sendPasswordResetEmail] Brevo not configured, skipping email');
    return;
  }

  if (!recipientEmail || !resetToken) {
    throw new Error('Email and reset token are required');
  }

  const resetUrl = `${config.cors.clientUrl}/auth/reset-password?token=${resetToken}`;

  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">TubeOS</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 0;">Password Reset Request</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px 20px;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="color: #666; font-size: 14px;">Hi ${recipientName},</p>
          <p style="color: #666; font-size: 14px;">We received a request to reset your TubeOS password. Click the button below to proceed:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">Or copy and paste this link in your browser:</p>
          <p style="color: #667eea; font-size: 11px; word-break: break-all;">${resetUrl}</p>
          
          <div style="border-top: 1px solid #ddd; margin-top: 20px; padding-top: 20px;">
            <p style="color: #999; font-size: 12px; margin: 5px 0;">⚠️ This link will expire in 15 minutes.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">If you didn't request this, please ignore this email.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">Your password will remain unchanged.</p>
          </div>
        </div>
        
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">© 2024 TubeOS. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: {
          email: EMAIL_FROM,
          name: 'TubeOS Security',
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        subject: 'Reset Your TubeOS Password',
        htmlContent: emailContent,
        replyTo: {
          email: EMAIL_FROM,
        },
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[sendPasswordResetEmail] Password reset email sent successfully to', recipientEmail);
    return response.data;
  } catch (error) {
    console.error('[sendPasswordResetEmail] Error sending password reset email:', {
      email: recipientEmail,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

// ==================== SEND WELCOME EMAIL ====================
const sendWelcomeEmail = async (recipientEmail, recipientName) => {
  if (!isBrevoConfigured()) {
    console.log('[sendWelcomeEmail] Brevo not configured, skipping email');
    return;
  }

  if (!recipientEmail) {
    throw new Error('Email is required');
  }

  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Welcome to TubeOS!</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 0;">Your AI-Powered YouTube Creator Companion</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px 20px;">
          <h2 style="color: #333;">Welcome, ${recipientName}!</h2>
          <p style="color: #666; font-size: 14px;">Your email has been verified and you're all set to start.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
            <ul style="color: #666; font-size: 14px;">
              <li>🔌 Connect your YouTube channel</li>
              <li>📊 View analytics and insights</li>
              <li>📅 Schedule videos with optimal timing</li>
              <li>🤖 Get AI-powered content recommendations</li>
              <li>💬 Manage comments and engagement</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.clientUrl}/channels" 
               style="background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
        </div>
        
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">Questions? Contact us at ${EMAIL_FROM}</p>
          <p style="color: #999; font-size: 12px; margin: 5px 0;">© 2024 TubeOS. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: {
          email: EMAIL_FROM,
          name: 'TubeOS Team',
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        subject: `Welcome to TubeOS, ${recipientName}! 🎉`,
        htmlContent: emailContent,
        replyTo: {
          email: EMAIL_FROM,
        },
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[sendWelcomeEmail] Welcome email sent successfully to', recipientEmail);
    return response.data;
  } catch (error) {
    console.error('[sendWelcomeEmail] Error sending welcome email:', {
      email: recipientEmail,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    // Don't throw for welcome email - not critical
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  isBrevoConfigured,
};
