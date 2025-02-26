// pages/tasks.js
import React, { useState } from "react";
import useSWR from "swr";
import axios from "axios";
import { useSession } from "next-auth/react";
import {
  Container, Typography, Table, TableHead, TableBody, TableRow,
  TableCell, TextField, Select, MenuItem, IconButton, Paper
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';

const fetcher = (url) => axios.get(url).then(res => res.data);
const statusOptions = ["YET_TO_BEGIN", "IN_PROGRESS", "DONE"];

export default function TaskTable() {
  const { data: session } = useSession();
  const { data, mutate } = useSWR(session? "/api/tasks": null, fetcher);
  const [editTaskId, setEditTaskId] = useState(null);
  const [editedTask, setEditedTask] = useState({});

  // Start editing a task by storing its current values
  const handleEdit = (task) => {
    setEditTaskId(task.id);
    setEditedTask({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate? new Date(task.dueDate).toISOString().split("T"): "",
      status: task.status,
      priority: task.priority
    });
  };

  // Update task in the backend; note: dynamic reordering logic to adjust subsequent tasks
  const updateTask = async (taskId) => {
    try {
      await axios.put(`/api/tasks/${taskId}`, editedTask);
      setEditTaskId(null);
      mutate();
      // TODO: Add dynamic reordering logic here to slide priorities accordingly.
    } catch (error) {
      console.error("Error updating task:", error.response?.data || error.message);
    }
  };

  // Delete a task
  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      mutate();
    } catch (error) {
      console.error("Error deleting task:", error.response?.data || error.message);
    }
  };

  const handleChange = (field, value) => {
    setEditedTask((prev) => ({...prev, [field]: value }));
  };

  if (!session) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Please sign in to view tasks.</Typography>
      </Container>
    );
  }

  if (!data) {
    return <div>Loading...</div>; // Or a loading indicator component
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Task Management</Typography>
      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      value={editedTask.title}
                      onChange={(e) => handleChange("title", e.target.value)}
                      fullWidth
                      sx={{ minWidth: '150px' }}
                    />
                  ): (
                    task.title
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      value={editedTask.description || ""}
                      onChange={(e) => handleChange("description", e.target.value)}
                      fullWidth
                      multiline
                      sx={{ minWidth: '200px' }}
                    />
                  ): (
                    task.description
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      type="date"
                      value={editedTask.dueDate}
                      onChange={(e) => handleChange("dueDate", e.target.value)}
                    />
                  ): (
                    task.dueDate? new Date(task.dueDate).toLocaleDateString(): ""
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <Select
                      value={editedTask.status}
                      onChange={(e) => handleChange("status", e.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <MenuItem key={status} value={status}>{status.replace("_", " ")}</MenuItem>
                      ))}
                    </Select>
                  ): (
                    task.status.replace("_", " ")
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      type="number"
                      value={editedTask.priority}
                      onChange={(e) => handleChange("priority", parseInt(e.target.value, 10))}
                    />
                  ): (
                    task.priority
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <IconButton onClick={() => updateTask(task.id)}>
                      <SaveIcon />
                    </IconButton>
                  ): (
                    <>
                      <IconButton onClick={() => handleEdit(task)}>
                        <SaveIcon />
                      </IconButton>
                      <IconButton onClick={() => deleteTask(task.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        * Adjusting the numeric priority will eventually reorder tasks automatically.
      </Typography>
    </Container>
  );
}
