// pages/api/calendar.js
import { getSession } from "next-auth/react";
import axios from "axios";

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const accessToken = session.accessToken;
  
  try {
    // Define time range: from now to 4 weeks ahead
    const now = new Date().toISOString();
    const fourWeeksLater = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
    
    const calendarResponse = await axios.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        timeMin: now,
        timeMax: fourWeeksLater,
        singleEvents: true,
        orderBy: "startTime"
      }
    });
    
    const events = calendarResponse.data.items || [];
    res.status(200).json({ events });
  } catch (error) {
    console.error("Error fetching Calendar events:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
}
