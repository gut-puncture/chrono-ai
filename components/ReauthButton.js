import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Button, Typography, Box, Alert } from '@mui/material';

export default function ReauthButton({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleReauth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Sign the user out, which will redirect them to sign in again
      await signOut({ redirect: true, callbackUrl: '/auth/signin?reason=reauth' });
      
      // If onSuccess is provided, call it
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error during re-authentication:', err);
      setError('Failed to initiate re-authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Typography variant="body1" gutterBottom>
        Your Google account access has expired. Please re-authenticate to continue using all features.
      </Typography>
      
      <Button
        variant="contained"
        color="primary"
        onClick={handleReauth}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Re-authenticate with Google'}
      </Button>
    </Box>
  );
} 