// pages/chat.js
import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Container, Box, TextField, Button, Typography, Paper, List, ListItem, ListItemText } from "@mui/material";
import axios from "axios";

export default function Chat() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  if (!session) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Please sign in to access the chat.</Typography>
      </Container>
    );
  }

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessage = { role: "user", text: input };
    setChatHistory((prev) => [...prev, newMessage]);
    setIsLoading(true);

    // Prepare context: last 10 messages
    const context = chatHistory.slice(-10).map((msg) => msg.text);
    
    try {
      const response = await axios.post("/api/llm", { message: input, context });
      const llmData = response.data;
      const llmMessage = { role: "llm", text: llmData.acknowledgment, details: llmData };
      setChatHistory((prev) => [...prev, llmMessage]);
    } catch (error) {
      console.error("LLM API error:", error.response?.data || error.message);
      setChatHistory((prev) => [...prev, { role: "llm", text: "Error processing message" }]);
    } finally {
      setInput("");
      setIsLoading(false);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Chat Interface</Typography>
      <Paper variant="outlined" sx={{ height: "60vh", overflowY: "scroll", p: 2 }}>
        <List>
          {chatHistory.map((msg, index) => (
            <ListItem key={index}>
              <ListItemText 
                primary={msg.role === "user" ? `You: ${msg.text}` : `LLM: ${msg.text}`}
                secondary={msg.details ? JSON.stringify(msg.details) : null}
              />
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Paper>
      <Box sx={{ mt: 2, display: "flex" }}>
        <TextField 
          fullWidth 
          variant="outlined" 
          placeholder="Type your message..." 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
        />
        <Button variant="contained" color="primary" onClick={sendMessage} disabled={isLoading} sx={{ ml: 2 }}>
          Send
        </Button>
      </Box>
    </Container>
  );
}
