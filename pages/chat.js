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
  const [taskRefreshKey, setTaskRefreshKey] = useState(0); // Add refresh key for forcing updates

  // Fetch chat history and tasks on mount (if authenticated)
  useEffect(() => {
    const fetchInitialData = async () => {
      if (status === "authenticated") {
        try {
          // Fetch both chat history and tasks in parallel
          const [chatResponse, taskResponse] = await Promise.all([
            axios.get("/api/chat/history").catch(err => {
              console.error("Error fetching chat history:", err);
              return { data: { messages: [] } }; // Provide fallback
            }),
            axios.get("/api/tasks").catch(err => {
              console.error("Error fetching tasks:", err);
              return { data: { tasks: [] } }; // Provide fallback
            })
          ]);

          // Process chat messages if successful
          if (chatResponse?.data?.messages) {
            const dbMessages = chatResponse.data.messages;
            const mapped = dbMessages.map((msg) => ({
              role: msg.role,
              text:
                msg.role === "user"
                  ? msg.messageText
                  : msg.llmResponse || msg.messageText
            }));
            setChatHistory(mapped);
          }

          // Process tasks if successful
          if (taskResponse?.data?.tasks) {
            console.log("Loaded tasks from server:", taskResponse.data.tasks);
            setTasks(taskResponse.data.tasks);
          }
        } catch (error) {
          console.error("Error in fetchInitialData:", error);
        }
      }
    };

    fetchInitialData();
    setIsMounted(true);
    
    // Set up an interval to refresh tasks periodically to ensure consistency
    const taskRefreshInterval = setInterval(async () => {
      if (status === "authenticated") {
        try {
          const response = await axios.get("/api/tasks");
          if (response?.data?.tasks) {
            setTasks(response.data.tasks);
            setTaskRefreshKey(prev => prev + 1); // Force refresh of task list
          }
        } catch (err) {
          console.error("Error in task refresh interval:", err);
        }
      }
    }, 10000); // Refresh every 10 seconds instead of 30
    
    // Clean up interval on unmount
    return () => clearInterval(taskRefreshInterval);
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
            // Create tasks one by one to ensure proper ordering
            for (const task of response.data.tasks) {
              try {
                const taskData = {
                  title: task.title || "New Task",
                  description: task.description || "",
                  dueDate: task.inferred_due_date || task.due_date || null,
                  status: "YET_TO_BEGIN",
                  priority: convertPriority(task.priority)
                };
                
                console.log("Creating task on server:", taskData);
                
                const response = await axios.post("/api/tasks", taskData);
                const savedTask = response.data.task;
                
                // Update tasks list with the new task
                setTasks(prev => [...prev, savedTask]);
                
              } catch (createErr) {
                console.error("Error creating individual task:", createErr);
              }
            }
            
            // Refresh task list from server to ensure consistency
            try {
              const refreshResponse = await axios.get("/api/tasks");
              if (refreshResponse?.data?.tasks) {
                setTasks(refreshResponse.data.tasks);
                setTaskRefreshKey(prev => prev + 1); // Force refresh
              }
            } catch (refreshErr) {
              console.error("Error refreshing tasks after creation:", refreshErr);
            }
            
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
      // Get task from current state before updating
      const taskToUpdate = tasks.find(t => t.id === taskId);
      if (!taskToUpdate) {
        console.error("Task not found in state:", taskId);
        return;
      }
      
      // Create updated task with new field value
      const updatedTask = { ...taskToUpdate, [field]: value };
      
      // Update local state first for responsive UI
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? updatedTask : task
        )
      );
      
      const updatedData = {
        title: updatedTask.title || "New Task",
        description: updatedTask.description || "",
        dueDate: updatedTask.dueDate,
        status: updatedTask.status || "YET_TO_BEGIN",
        priority: updatedTask.priority || 2
      };
      
      console.log(`Updating task field ${field} for task ${taskId}:`, updatedData);
      
      // If it's a temporary task (from LLM), create it on server
      if (typeof taskId === "string" && taskId.startsWith("temp-")) {
        console.log("Creating temporary task on server:", updatedData);
        try {
          // Use a retry mechanism to ensure the task gets created
          let retries = 3;
          let savedTask = null;
          
          while (retries > 0 && !savedTask) {
            try {
              const response = await axios.post("/api/tasks", {
                ...updatedData,
                dueDate: updatedData.dueDate || null,
                sourceMessageId: null
              });
              
              savedTask = response.data.task;
              console.log("Task created on server:", savedTask);
              
              // Replace temp task with server task in local state
              setTasks(prevTasks => 
                prevTasks.map(task => 
                  task.id === taskId ? savedTask : task
                )
              );
              
              break; // Success, exit the retry loop
            } catch (createErr) {
              retries--;
              console.error(`Error creating task (retries left: ${retries}):`, createErr);
              if (retries > 0) {
                await new Promise(r => setTimeout(r, 1000)); // Wait 1 second before retry
              }
            }
          }
          
          if (!savedTask) {
            console.error("Failed to create task after multiple attempts");
          }
          
        } catch (err) {
          console.error("Error in task creation process:", err);
        }
      } else {
        // Update existing task on server
        console.log(`Updating existing task ${taskId} on server:`, updatedData);
        try {
          await axios.put(`/api/tasks/${taskId}`, updatedData);
          
          // Verify task was updated by re-fetching tasks
          // This ensures we have the latest data from the server
          try {
            const response = await axios.get("/api/tasks");
            const serverTasks = response.data.tasks;
            
            // If our task exists on the server, update our local state to match
            const serverTask = serverTasks.find(t => t.id === taskId);
            if (serverTask) {
              setTasks(prevTasks => 
                prevTasks.map(task => 
                  task.id === taskId ? serverTask : task
                )
              );
            }
          } catch (fetchErr) {
            console.error("Error verifying task update:", fetchErr);
          }
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
      console.log(`Marking task ${taskId} as deleted in UI`);
      
      // Mark the task as visually deleted in UI but keep in state with a flag
      setTasks((prev) => 
        prev.map((t) => 
          t.id === taskId 
            ? { ...t, isDeleted: true, status: "DONE" } 
            : t
        )
      );
      
      // If it's a temporary (not in DB) task, we need to save it first
      if (typeof taskId === "string" && taskId.startsWith("temp-")) {
        const tempTask = tasks.find(t => t.id === taskId);
        if (tempTask) {
          try {
            console.log("Creating task on server before marking as completed:", tempTask);
            const response = await axios.post("/api/tasks", {
              title: tempTask.title || "Task",
              description: tempTask.description || "",
              dueDate: tempTask.dueDate || null,
              status: "DONE", // Mark as done to show completion
              priority: tempTask.priority || 2,
              sourceMessageId: null
            });
            
            // Update the temporary task with the real ID from server
            const savedTask = response.data.task;
            setTasks(prevTasks => 
              prevTasks.map(task => 
                task.id === taskId 
                  ? { ...savedTask, isDeleted: true } 
                  : task
              )
            );
          } catch (err) {
            console.error("Error creating deleted task on server:", err);
          }
        }
        return;
      }
      
      // For existing tasks, just update status to DONE but don't delete from DB
      try {
        console.log(`Updating task ${taskId} status to DONE`);
        await axios.put(`/api/tasks/${taskId}`, {
          status: "DONE",
          // Need to include all required fields for API
          title: tasks.find(t => t.id === taskId)?.title || "Task",
          description: tasks.find(t => t.id === taskId)?.description || "",
          dueDate: tasks.find(t => t.id === taskId)?.dueDate || null,
          priority: tasks.find(t => t.id === taskId)?.priority || 2
        });
        console.log(`Task ${taskId} marked as DONE`);
      } catch (err) {
        console.error(`Error updating task ${taskId} status:`, err);
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
                        <TableCell width="30%">Title</TableCell>
                        <TableCell width="35%">Description</TableCell>
                        <TableCell width="10%">Due Date</TableCell>
                        <TableCell width="10%">Status</TableCell>
                        <TableCell width="10%">Priority</TableCell>
                        <TableCell width="5%"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tasks
                        .filter(task => !task.isDeleted) // Only show non-deleted tasks
                        .map((task, index) => (
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
                                width: '100%',
                                '& .MuiInputBase-root': {
                                  padding: 0,
                                  width: '100%',
                                  minWidth: '150px',
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
                                width: '100%',
                                '& .MuiInputBase-root': {
                                  padding: 0,
                                  width: '100%',
                                  minWidth: '200px',
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
