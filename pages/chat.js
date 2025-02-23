// pages/chat.js
import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Container, Grid, Box, TextField, Button, Typography, Paper } from "@mui/material";
import axios from "axios";

export default function Chat() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  // Initialize chatHistory as an empty array to avoid undefined errors.
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false); 
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await axios.get('/api/chat/history');
        setChatHistory(response.data.messages); 
      } catch (error) {
        console.error('Error fetching chat history:', error);
      }
    };

    if (session) {
      fetchChatHistory(); 
    }

    setIsMounted(true);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session]); 

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

    const userMessage = { role: "user", text: input };
    setChatHistory(prev => [...prev, userMessage]);
    await saveMessageToDB({ messageText: input, role: "user" });
    setIsLoading(true);

    const context = chatHistory.slice(-15).map(msg => msg.text);

    try {
      const response = await axios.post("/api/llm", { message: input, context });
      const llmData = response.data;

      const llmMessage = { role: "llm", text: llmData.acknowledgment, details: llmData };
      setChatHistory(prev => [...prev, llmMessage]);

      await saveMessageToDB({ 
        messageText: input, 
        role: "llm", 
        llmResponse: llmData.acknowledgment, 
        tags: llmData.tags 
      });
    } catch (error) {
      console.error("LLM API error:", error.response?.data || error.message);
      const errorMessage = { role: "llm", text: "Error processing message" };
      setChatHistory(prev => [...prev, errorMessage]);
      await saveMessageToDB({ 
        messageText: input, 
        role: "llm", 
        llmResponse: "Error processing message" 
      });
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

        {/* Conditionally render the Task List Panel */}
        {isMounted && (
          <Grid item xs={4}>
            <Typography variant="h5" gutterBottom>Task List</Typography>
            <Paper variant="outlined" sx={{ height: "60vh", overflowY: "auto", p: 2 }}>
              <Typography variant="body2" color="textSecondary">
                (Task list will appear here once tasks are auto-created and integrated.)
              </Typography>
            </Paper>
          </Grid>
        )}

      </Grid>
    </Container>
  );
}
