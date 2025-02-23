// pages/chat.js
import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Container, Grid, Box, TextField, Button, Typography, Paper, List, ListItem, ListItemText, Divider } from "@mui/material";
import axios from "axios";

export default function Chat() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]); // Each item: { role, text, id (from DB), details }
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

  // Function to persist a message via the backend
  const saveMessageToDB = async (messageData) => {
    try {
      await axios.post("/api/chat/save", messageData);
    } catch (error) {
      console.error("Error saving message:", error.response?.data || error.message);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Create user message object and persist to DB
    const userMessage = { role: "user", text: input };
    setChatHistory(prev => [...prev, userMessage]);
    await saveMessageToDB({ messageText: input, role: "user" });
    setIsLoading(true);

    // Build context: include up to the last 15 messages
    const context = chatHistory.slice(-15).map(msg => msg.text);
    
    try {
      // Call LLM API with message and context
      const response = await axios.post("/api/llm", { message: input, context });
      const llmData = response.data;
      
      // Create LLM message object (only show acknowledgment to the user)
      const llmMessage = { role: "llm", text: llmData.acknowledgment, details: llmData };
      setChatHistory(prev => [...prev, llmMessage]);
      
      // Persist LLM response to DB (store full details in DB but display only acknowledgment)
      await saveMessageToDB({ messageText: input, role: "llm", llmResponse: llmData.acknowledgment, tags: llmData.tags });
    } catch (error) {
      console.error("LLM API error:", error.response?.data || error.message);
      const errorMessage = { role: "llm", text: "Error processing message" };
      setChatHistory(prev => [...prev, errorMessage]);
      await saveMessageToDB({ messageText: input, role: "llm", llmResponse: "Error processing message" });
    } finally {
      setInput("");
      setIsLoading(false);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Grid container spacing={2}>
        {/* Chat and Task List Panel */}
        <Grid item xs={8}>
          <Typography variant="h4" gutterBottom>Chat Interface</Typography>
          <Paper variant="outlined" sx={{ height: "60vh", overflowY: "auto", p: 2 }}>
            {chatHistory.map((msg, index) => (
              <Box key={index} sx={{ 
                display: "flex", 
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start", 
                mb: 1 
              }}>
                <Paper sx={{ p: 1, maxWidth: "80%", backgroundColor: msg.role === "user" ? "#DCF8C6" : "#FFFFFF" }}>
                  <Typography variant="body1">{msg.text}</Typography>
                  {/* Optionally, internal details like tags can be logged to console */}
                </Paper>
              </Box>
            ))}
            <div ref={messagesEndRef} />
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
        </Grid>
        {/* Persistent Task List Panel (Placeholder) */}
        <Grid item xs={4}>
          <Typography variant="h5" gutterBottom>Task List</Typography>
          <Paper variant="outlined" sx={{ height: "60vh", overflowY: "auto", p: 2 }}>
            <Typography variant="body2" color="textSecondary">
              (Task list will appear here once tasks are auto-created and integrated.)
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
