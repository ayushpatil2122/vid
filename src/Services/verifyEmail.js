import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method === 'GET') {
      const { token } = req.query;
  
      // Find the user by verification token
      const user = await prisma.user.findFirst({
        where: { verificationToken: token },
      });
  
      if (!user) {
        return res.status(400).json({ error: 'Invalid token' });
      }
  
      const currentTime = new Date();
      if (user.verificationTokenExpiry < currentTime) {
        return res.status(400).json({ error: 'Token expired' });
      }
  
      // Proceed with finalizing the registration
      try {
        // Update the user to mark them as verified and active
        await prisma.user.update({
          where: { email: user.email },
          data: {
            emailVerified: true,   // Mark email as verified
            pendingVerification: false,  // Remove pending flag
            verificationToken: null,   // Remove the verification token
            verificationTokenExpiry: null, // Remove expiry date
          },
        });
  
        return res.status(200).json({ message: 'Email verified successfully' });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Something went wrong' });
      }
    }
  
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  