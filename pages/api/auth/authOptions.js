// pages/api/auth/authOptions.js
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  debug: process.env.NODE_ENV === 'development',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
          include_granted_scopes: true
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        console.log("JWT callback - initial sign in");
        console.log("Account provider:", account.provider);
        console.log("Has access token:", !!account.access_token);
        console.log("Has refresh token:", !!account.refresh_token);
        console.log("Has token expiry:", !!account.expires_at);
        
        // If we don't have a refresh token, mark the token as expired to force re-auth
        if (!account.refresh_token) {
          console.log("No refresh token found, marking token as expired");
          
          // Try to update the account to force re-auth on next login
          try {
            await prisma.account.update({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId
                }
              },
              data: {
                expires_at: Math.floor(Date.now() / 1000) - 3600 // Set to 1 hour ago
              }
            });
          } catch (error) {
            console.error("Error updating account expiry:", error);
          }
        }
        
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : null,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        };
      }
      
      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        console.log("JWT callback - using existing token");
        return token;
      }
      
      // Access token has expired, try to update it
      console.log("JWT callback - token expired, needs refresh");
      
      // If we don't have a refresh token, we can't refresh the access token
      if (!token.refreshToken) {
        console.log("No refresh token available, user needs to re-authenticate");
        // Clear the token to force re-auth
        return {
          ...token,
          accessToken: null,
          accessTokenExpires: null
        };
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken;
        session.user.id = token.user?.id;
        
        // Add a flag to indicate if the token is valid
        session.tokenValid = !!token.accessToken;
        
        // Add a flag to indicate if we have a refresh token
        session.hasRefreshToken = !!token.refreshToken;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log(`User signed in: ${user.email}`);
      console.log(`Account provider: ${account.provider}`);
      console.log(`Has access token: ${!!account.access_token}`);
      console.log(`Has refresh token: ${!!account.refresh_token}`);
      console.log(`Token expires at: ${account.expires_at ? new Date(account.expires_at * 1000).toISOString() : 'unknown'}`);
      
      // Ensure we store the token expiry time
      if (account.expires_in && !account.expires_at) {
        const expiresAt = Math.floor(Date.now() / 1000) + parseInt(account.expires_in);
        console.log(`Calculated token expiry: ${new Date(expiresAt * 1000).toISOString()}`);
        
        try {
          await prisma.account.update({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId
              }
            },
            data: {
              expires_at: expiresAt
            }
          });
          console.log("Updated account with token expiry time");
        } catch (error) {
          console.error("Error updating account with token expiry:", error);
        }
      }
      
      // If we don't have a refresh token, log a warning
      if (!account.refresh_token) {
        console.warn("No refresh token received during sign in. User will need to re-authenticate when token expires.");
      }
    }
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: '/'
      }
    }
  }
};
