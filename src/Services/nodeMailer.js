import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email } = req.body;

    // Generate a unique verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Set token expiry time (for example 1 hour)
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Store the token in the database (you can choose to save or not)
    await prisma.user.update({
      where: { email },
      data: {
        verificationToken,
        verificationTokenExpiry: tokenExpiry,
      },
    });

    // Create a verification link
    const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;

    // Configure email sending (using Nodemailer)
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, 
      auth: {
        user: process.env.EMAIL_USERNAME, // Your email
        pass: process.env.EMAIL_PASSWORD, // Your email password
      },
    });

    // Send the email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USERNAME, // Sender address
      to: email, // Recipient address
      subject: 'Email Verification',
      text: `Click the following link to verify your email: ${verificationLink}`,
      html: `<p>Click the following link to verify your email:</p><a href="${verificationLink}">${verificationLink}</a>`,
    });

    return res.status(200).json({ message: 'Verification email sent' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
