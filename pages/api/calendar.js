// pages/api/calendar.js
import { getSession } from "next-auth/react";
import axios from "axios";
import prisma from '../../lib/prisma';

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const accessToken = session.accessToken;
  
  try {
    const now = new Date();
    const threeWeeksLater = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    
    const calendarResponse = await axios.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        timeMin: now.toISOString(),
        timeMax: threeWeeksLater.toISOString(),
        singleEvents: true,
        orderBy: "startTime"
      }
    });
    
    const events = calendarResponse.data.items || [];
    const eventRecords = events.map(event => ({
      eventId: event.id,
      userId: session.user.id,
      title: event.summary,
      description: event.description,
      location: event.location,
      startTime: new Date(event.start.dateTime || event.start.date),
      endTime: new Date(event.end.dateTime || event.end.date),
      isRecurring: !!event.recurringEventId,
      recurringEventId: event.recurringEventId,
      meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      attendees: event.attendees ? JSON.stringify(event.attendees) : null,
      status: event.status,
      createdAt: new Date(event.created),
      updatedAt: new Date(event.updated)
    }));

    // Batch create/update calendar events
    await prisma.$transaction(
      eventRecords.map(event =>
        prisma.calendarEvent.upsert({
          where: { eventId: event.eventId },
          update: event,
          create: event
        })
      )
    );

    res.status(200).json({ processed: eventRecords.length });
  } catch (error) {
    console.error("Error processing Calendar events:", error);
    res.status(500).json({ error: "Failed to process calendar events" });
  }
}
