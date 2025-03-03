// pages/index.js
import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button, Container, Typography, Box, Alert, CircularProgress } from "@mui/material";
import Link from "next/link";

export default function Home() {
  const { data: session } = useSession();
  const [needsReauth, setNeedsReauth] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState(null);
  
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
  
  const handleRevokeAndReconnect = async () => {
    try {
      setIsRevoking(true);
      setRevokeError(null);
      
      // Call the API to revoke the Google connection
      const response = await fetch('/api/auth/revoke-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke Google connection');
      }
      
      // Sign the user out, which will redirect them to sign in again
      await signOut({ redirect: true, callbackUrl: '/auth/signin?reason=reconnect' });
    } catch (error) {
      console.error('Error revoking Google connection:', error);
      setRevokeError(error.message || 'Failed to revoke Google connection');
      setIsRevoking(false);
    }
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
            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
              <Button 
                variant="contained" 
                color="warning" 
                onClick={handleReauth}
                disabled={isRevoking}
              >
                Re-authenticate with Google
              </Button>
              
              <Button 
                variant="outlined" 
                color="error" 
                onClick={handleRevokeAndReconnect}
                disabled={isRevoking}
                startIcon={isRevoking ? <CircularProgress size={20} /> : null}
              >
                {isRevoking ? 'Processing...' : 'Revoke & Reconnect Google'}
              </Button>
            </Box>
            
            {revokeError && (
              <Typography color="error" sx={{ mt: 1 }}>
                {revokeError}
              </Typography>
            )}
            
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              If re-authentication doesn't work, try the "Revoke & Reconnect" option to completely reset your Google connection.
            </Typography>
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
