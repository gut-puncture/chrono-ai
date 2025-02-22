// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma"; // Correct path to your prisma client

export default NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,  // Make sure this is set in your .env.local
  session: {
    strategy: "jwt", // Use JWT strategy
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          // You might want to add other relevant fields here, like user ID
        };
      }
      // Return previous token if the access token has not expired yet
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken;
       // You could also add user ID here if you added it to the token:
       // session.userId = token.userId;
      return session;
    },
  },
});
