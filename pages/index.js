// pages/index.js
import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button, Container, Typography, Box, Alert } from "@mui/material";
import Link from "next/link";

export default function Home() {
  const { data: session } = useSession();
  const [needsReauth, setNeedsReauth] = useState(false);
  
  useEffect(() => {
    // Check if the user needs to re-authenticate
    if (session && (!session.tokenValid || !session.hasRefreshToken)) {
      setNeedsReauth(true);
    } else {
      setNeedsReauth(false);
    }
  }, [session]);
  
  const handleReauth = async () => {
    // Sign the user out, which will redirect them to sign in again
    await signOut({ redirect: true, callbackUrl: '/auth/signin?reason=reauth' });
  };
  
  if (session) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {session.user.name}
        </Typography>
        
        {needsReauth && (
          <Alert severity="warning" sx={{ my: 2 }}>
            <Typography variant="body1" gutterBottom>
              Your Google account access has expired or is missing required permissions. 
              Please re-authenticate to continue using all features.
            </Typography>
            <Button 
              variant="contained" 
              color="warning" 
              onClick={handleReauth}
              sx={{ mt: 1 }}
            >
              Re-authenticate with Google
            </Button>
          </Alert>
        )}
        
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => signOut()}
          sx={{ mr: 2 }}
        >
          Sign Out
        </Button>
        
        <Button 
          variant="contained" 
          color="secondary" 
          component={Link} 
          href="/chat"
        >
          Go to Chat
        </Button>
      </Container>
    );
  }
  
  return (
    <Container sx={{ mt: 4, textAlign: "center" }}>
      <Typography variant="h4" gutterBottom>
        Welcome to Chrono AI
      </Typography>
      <Typography variant="body1" paragraph>
        Please sign in to continue
      </Typography>
      <Button 
        variant="contained" 
        color="primary" 
        onClick={() => signIn("google")}
      >
        Sign in with Google
      </Button>
    </Container>
  );
}
