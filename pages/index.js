// pages/index.js
import { signIn, signOut, useSession } from "next-auth/react";
import { Button, Container, Typography } from "@mui/material";

export default function Home() {
  const { data: session } = useSession();
  
  if (session) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {session.user.name}
        </Typography>
        <Button variant="contained" color="primary" onClick={() => signOut()}>
          Sign Out
        </Button>
      </Container>
    );
  }
  
  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Unified Workspace MVP
      </Typography>
      <Button variant="contained" color="primary" onClick={() => signIn("google")}>
        Sign In with Google
      </Button>
    </Container>
  );
}
