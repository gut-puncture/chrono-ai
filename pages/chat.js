import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Container,
  Grid,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Select,
  MenuItem
} from "@mui/material";
import axios from "axios";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";

export default function Chat() {
  const { data: session, status } = useSession();

  // Chat state
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef(null);

  // Task state
  const [tasks, setTasks] = useState([]);

  // Fetch chat history and tasks on mount (if authenticated)
  useEffect(() => {
    const fetchInitialData = async () => {
      if (status === "authenticated") {
        try {
          // 1) Fetch chat history from DB
          const chatResponse = await axios.get("/api/chat/history");
          const dbMessages = chatResponse.data.messages;

          // 2) Map DB messages into a format for chatHistory
          const mapped = dbMessages.map((msg) => ({
            role: msg.role,
            text:
              msg.role === "user"
                ? msg.messageText
                : msg.llmResponse || msg.messageText
          }));
          setChatHistory(mapped);

          // 3) Fetch tasks
          const taskResponse = await axios.get("/api/tasks");
          setTasks(taskResponse.data.tasks);
        } catch (error) {
          console.error("Error fetching initial data:", error);
        }
      }
    };

    fetchInitialData();
    setIsMounted(true);
  }, [status]);

  // Scroll to bottom whenever chat history updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Save a message (user or llm) to the DB
  const saveMessageToDB = async (messageData) => {
    try {
      const response = await axios.post("/api/chat/save", messageData);
      return response.data.savedMessage;
    } catch (error) {
      console.error("Error saving message:", error.response?.data || error.message);
      throw error;
    }
  };

  // Convert LLM's priority text to a numeric priority
  const convertPriority = (priorityStr) => {
    switch (priorityStr?.toLowerCase()) {
      case "low":
        return 1;
      case "high":
        return 3;
      default:
        return 2; // medium
    }
  };

  // This function is no longer used as we're creating tasks directly in the sendMessage function
  // Keeping the placeholder for reference
  const createTaskOnServer = async (taskData) => {
    try {
      const response = await axios.post("/api/tasks", taskData);
      return response.data.task;
    } catch (error) {
      console.error("Error creating task on server:", error);
      throw error;
    }
  };

  // Send a message to the LLM
  const sendMessage = async () => {
    if (!input.trim() || !session || status !== "authenticated") return;

    try {
      setIsLoading(true);

      // 1) Add user message to local state
      const userMessage = { role: "user", text: input };
      setChatHistory((prev) => [...prev, userMessage]);

      // 2) Save user message to DB
      await saveMessageToDB({
        messageText: input,
        role: "user"
      });

      // 3) Build context from recent messages (up to 15)
      const context = chatHistory
        .slice(-15)
        .map((msg) => msg.text)
        .filter(Boolean);

      // 4) Call the LLM endpoint
      const response = await axios.post("/api/llm", {
        message: input,
        context
      });

      // 5) Process LLM response
      if (response.data) {
        // Combine acknowledgment + question
        const ack = response.data.acknowledgment || "";
        const question = response.data.question || "";
        let llmCombinedText = ack;
        if (question.trim()) {
          llmCombinedText += "\n\n" + question;
        }

        // Create an llm message object
        const llmMessage = {
          role: "llm",
          text: llmCombinedText,
          details: response.data
        };

        // 6) Update chat history in the UI
        setChatHistory((prev) => [...prev, llmMessage]);

        // 7) Save LLM message to DB
        await saveMessageToDB({
          messageText: llmCombinedText,
          role: "llm",
          llmResponse: llmCombinedText,
          tags: response.data.tags
        });

        // 8) If the LLM returned tasks, create them immediately on the server
        if (response.data.tasks?.length > 0) {
          console.log("LLM returned tasks:", response.data.tasks);
          
          try {
            // First add temporary tasks to the UI for immediate feedback
            const tempTasks = response.data.tasks.map((task, idx) => ({
              id: `temp-${idx}-${Date.now()}`,
              title: task.title || "New Task",
              description: task.description || "",
              dueDate: task.inferred_due_date || task.due_date || null,
              status: "YET_TO_BEGIN",
              priority: convertPriority(task.priority),
              isTemp: true
            }));
            
            // Immediately add temp tasks to state for responsive UI
            setTasks(prev => [...prev, ...tempTasks]);
            
            // Create an array to hold the promises for server creation
            for (let i = 0; i < response.data.tasks.length; i++) {
              const task = response.data.tasks[i];
              const tempTask = tempTasks[i];
              
              try {
                // Create the task on the server
                const taskData = {
                  title: task.title || "New Task",
                  description: task.description || "",
                  dueDate: task.inferred_due_date || task.due_date || null,
                  status: "YET_TO_BEGIN",
                  priority: convertPriority(task.priority),
                  sourceMessageId: null
                };
                
                console.log("Creating task on server:", taskData);
                const serverResponse = await axios.post("/api/tasks", taskData);
                const savedTask = serverResponse.data.task;
                
                // Replace the temp task with the saved task that has a real ID
                setTasks(prev => 
                  prev.map(t => t.id === tempTask.id ? savedTask : t)
                );
              } catch (err) {
                console.error(`Error creating task ${i}:`, err);
              }
            }
            
            // Smooth scroll to make the new tasks visible
            setTimeout(() => {
              const taskContainer = document.querySelector('.MuiPaper-root[elevation="2"]');
              if (taskContainer) {
                taskContainer.scrollTo({
                  top: taskContainer.scrollHeight,
                  behavior: 'smooth'
                });
              }
            }, 300);
          } catch (error) {
            console.error("Error processing tasks:", error);
          }
        } else {
          console.log("No tasks in LLM response");
        }
      }
    } catch (error) {
      console.error("Error in sendMessage:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "llm",
          text: "Sorry, there was an error processing your message."
        }
      ]);
    } finally {
      setInput("");
      setIsLoading(false);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // -- TASK EDITING LOGIC --

  // Directly update a task field and save to server
  const handleUpdateTaskField = async (taskId, field, value) => {
    try {
      // First update in local state immediately for responsive UI
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, [field]: value } : task
        )
      );
      
      // Prepare data for API call
      const taskToUpdate = tasks.find(t => t.id === taskId);
      if (!taskToUpdate) {
        console.error("Task not found in state:", taskId);
        return;
      }
      
      const updatedData = {
        title: taskToUpdate.title || "New Task",
        description: taskToUpdate.description || "",
        dueDate: taskToUpdate.dueDate,
        status: taskToUpdate.status || "YET_TO_BEGIN",
        priority: taskToUpdate.priority || 2,
        [field]: value // Override the specific field
      };
      
      console.log(`Updating task field ${field} for task ${taskId}:`, updatedData);
      
      // If it's a temporary task (from LLM), create it on server
      if (typeof taskId === "string" && taskId.startsWith("temp-")) {
        console.log("Creating temporary task on server:", updatedData);
        try {
          const response = await axios.post("/api/tasks", {
            ...updatedData,
            dueDate: updatedData.dueDate || null,
            sourceMessageId: null
          });
          
          const savedTask = response.data.task;
          console.log("Task created on server:", savedTask);
          
          // Replace temp task with server task in local state
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === taskId ? savedTask : task
            )
          );
        } catch (err) {
          console.error("Error creating task from temp:", err);
        }
      } else {
        // Update existing task on server
        console.log(`Updating existing task ${taskId} on server:`, updatedData);
        try {
          await axios.put(`/api/tasks/${taskId}`, updatedData);
        } catch (err) {
          console.error(`Error updating task ${taskId}:`, err);
        }
      }
    } catch (error) {
      console.error("Error in handleUpdateTaskField:", error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      console.log(`Deleting task ${taskId}`);
      
      // Immediately remove from UI for responsive feel
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      
      // If it's a temporary (not in DB) task, we're done
      if (typeof taskId === "string" && taskId.startsWith("temp-")) {
        console.log("Removed temporary task from state");
        return;
      }
      
      // Otherwise, delete from DB
      try {
        console.log(`Deleting task ${taskId} from database`);
        await axios.delete(`/api/tasks/${taskId}`);
        console.log(`Task ${taskId} deleted successfully`);
      } catch (err) {
        console.error(`Error deleting task ${taskId} from database:`, err);
        // If deletion fails, we don't restore the task to the UI to avoid confusion
        // But in a production app, you might want to show an error and restore it
      }
    } catch (error) {
      console.error("Error in deleteTask:", error);
    }
  };

  const statusOptions = ["YET_TO_BEGIN", "IN_PROGRESS", "DONE"];
  const priorityLabels = {
    1: "Low",
    2: "Medium",
    3: "High"
  };

  // Handle loading or unauthenticated states
  if (status === "loading") {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Please sign in to access the chat.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Grid container spacing={2}>
        {/* CHAT PANEL */}
        <Grid item xs={8}>
          <Typography variant="h4" gutterBottom>
            Chat Interface
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              height: "60vh",
              overflowY: "auto",
              p: 2,
              bgcolor: "background.paper"
            }}
          >
            {chatHistory.map((msg, index) => (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                  mb: 1
                }}
              >
                <Paper
                  sx={{
                    p: 1,
                    maxWidth: "80%",
                    backgroundColor:
                      msg.role === "user" ? "#DCF8C6" : "#FFFFFF",
                    boxShadow: 1
                  }}
                >
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={isLoading}
              multiline
              maxRows={4}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={sendMessage}
              disabled={isLoading}
              sx={{ ml: 2 }}
            >
              Send
            </Button>
          </Box>
        </Grid>

        {/* TASK LIST PANEL */}
        {isMounted && (
          <Grid item xs={4}>
            <Typography 
              variant="h5" 
              gutterBottom
              sx={{ 
                fontWeight: 600, 
                color: '#2c3e50', 
                display: 'flex', 
                alignItems: 'center' 
              }}
            >
              Task List
            </Typography>
            <Paper
              elevation={2}
              sx={{
                height: "60vh",
                overflowY: "auto",
                p: 2,
                bgcolor: "#ffffff",
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease'
              }}
            >
              {tasks.length === 0 ? (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%', 
                    p: 4,
                    color: 'text.secondary',
                    opacity: 0.7
                  }}
                >
                  <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
                    No tasks available
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'center' }}>
                    Chat with the AI to create tasks automatically
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ overflowX: "auto" }}>
                  <Table sx={{ 
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 8px",
                    "& .MuiTableCell-root": {
                      py: 1.5,
                      px: 2,
                      transition: "all 0.2s ease"
                    }
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width="35%">Title</TableCell>
                        <TableCell width="40%">Description</TableCell>
                        <TableCell width="15%">Due Date</TableCell>
                        <TableCell width="15%">Status</TableCell>
                        <TableCell width="15%">Priority</TableCell>
                        <TableCell width="5%"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tasks.map((task, index) => (
                        <TableRow 
                          key={task.id}
                          sx={{
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            borderRadius: 2,
                            backgroundColor: '#ffffff',
                            animation: typeof task.id === 'string' && task.id.startsWith('temp-') 
                              ? 'fadeIn 0.5s ease-in' 
                              : 'none',
                            '& > .MuiTableCell-root:first-of-type': {
                              borderTopLeftRadius: 8,
                              borderBottomLeftRadius: 8
                            },
                            '& > .MuiTableCell-root:last-of-type': {
                              borderTopRightRadius: 8,
                              borderBottomRightRadius: 8
                            },
                            '&:hover': {
                              boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                              transform: 'translateY(-2px)',
                              transition: 'all 0.3s ease'
                            },
                            // Add animation delay based on index for a staggered effect
                            animationDelay: `${index * 0.1}s`,
                            opacity: 1,
                            transform: 'translateY(0)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '@keyframes fadeIn': {
                              from: { 
                                opacity: 0,
                                transform: 'translateY(20px)'
                              },
                              to: { 
                                opacity: 1,
                                transform: 'translateY(0)'
                              }
                            }
                          }}
                        >
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              variant="standard"
                              value={task.title || ""}
                              onChange={(e) => handleUpdateTaskField(task.id, "title", e.target.value)}
                              InputProps={{
                                disableUnderline: true,
                                style: { fontSize: '0.95rem', fontWeight: 500 }
                              }}
                              sx={{ 
                                '& .MuiInputBase-root': {
                                  padding: 0,
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.03)'
                                  }
                                }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              maxRows={2}
                              variant="standard"
                              value={task.description || ""}
                              onChange={(e) => handleUpdateTaskField(task.id, "description", e.target.value)}
                              placeholder="Add description..."
                              InputProps={{
                                disableUnderline: true,
                                style: { fontSize: '0.9rem' }
                              }}
                              sx={{ 
                                '& .MuiInputBase-root': {
                                  padding: 0,
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.03)'
                                  }
                                }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              type="date"
                              size="small"
                              fullWidth
                              variant="standard"
                              value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
                              onChange={(e) => handleUpdateTaskField(task.id, "dueDate", e.target.value)}
                              InputProps={{
                                disableUnderline: true,
                                style: { fontSize: '0.9rem' }
                              }}
                              sx={{ 
                                '& .MuiInputBase-root': {
                                  padding: 0,
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.03)'
                                  }
                                }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <Select
                              fullWidth
                              size="small"
                              variant="standard"
                              disableUnderline
                              value={task.status}
                              onChange={(e) => handleUpdateTaskField(task.id, "status", e.target.value)}
                              sx={{
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                padding: 0.5,
                                borderRadius: 1,
                                backgroundColor: 
                                  task.status === "DONE" 
                                    ? "rgba(76, 175, 80, 0.12)" 
                                    : task.status === "IN_PROGRESS" 
                                      ? "rgba(255, 152, 0, 0.12)" 
                                      : "rgba(33, 150, 243, 0.12)",
                                color: 
                                  task.status === "DONE" 
                                    ? "rgb(46, 125, 50)" 
                                    : task.status === "IN_PROGRESS" 
                                      ? "rgb(230, 81, 0)" 
                                      : "rgb(21, 101, 192)",
                                '&:hover': {
                                  backgroundColor: 
                                    task.status === "DONE" 
                                      ? "rgba(76, 175, 80, 0.2)" 
                                      : task.status === "IN_PROGRESS" 
                                        ? "rgba(255, 152, 0, 0.2)" 
                                        : "rgba(33, 150, 243, 0.2)",
                                },
                                '& .MuiSelect-select': {
                                  padding: '4px 8px',
                                  paddingRight: '24px !important'
                                }
                              }}
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    borderRadius: 8,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                  }
                                }
                              }}
                            >
                              {statusOptions.map((statusVal) => (
                                <MenuItem key={statusVal} value={statusVal}>
                                  {statusVal.replace(/_/g, " ")}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>

                          <TableCell>
                            <Select
                              fullWidth
                              size="small"
                              variant="standard"
                              disableUnderline
                              value={task.priority}
                              onChange={(e) => handleUpdateTaskField(task.id, "priority", parseInt(e.target.value, 10))}
                              sx={{
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                padding: 0.5,
                                borderRadius: 1,
                                backgroundColor: 
                                  task.priority === 3 
                                    ? "rgba(244, 67, 54, 0.12)" 
                                    : task.priority === 2 
                                      ? "rgba(255, 152, 0, 0.12)" 
                                      : "rgba(76, 175, 80, 0.12)",
                                color: 
                                  task.priority === 3 
                                    ? "rgb(198, 40, 40)" 
                                    : task.priority === 2 
                                      ? "rgb(230, 81, 0)" 
                                      : "rgb(46, 125, 50)",
                                '&:hover': {
                                  backgroundColor: 
                                    task.priority === 3 
                                      ? "rgba(244, 67, 54, 0.2)" 
                                      : task.priority === 2 
                                        ? "rgba(255, 152, 0, 0.2)" 
                                        : "rgba(76, 175, 80, 0.2)",
                                },
                                '& .MuiSelect-select': {
                                  padding: '4px 8px',
                                  paddingRight: '24px !important'
                                }
                              }}
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    borderRadius: 8,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                  }
                                }
                              }}
                            >
                              {[1, 2, 3].map((val) => (
                                <MenuItem key={val} value={val}>
                                  {priorityLabels[val]}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>

                          <TableCell>
                            <IconButton 
                              onClick={() => deleteTask(task.id)}
                              color="error"
                              size="small"
                              sx={{
                                opacity: 0.7,
                                '&:hover': {
                                  opacity: 1,
                                  backgroundColor: 'rgba(244, 67, 54, 0.1)'
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
