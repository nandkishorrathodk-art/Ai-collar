/**
 * Google Calendar Direct Integration Module
 * Handles direct event creation in Google Calendar via API & generates 1-click Google Calendar links.
 */

const fs = require('fs');
const path = require('path');
const store = require('./store');

/**
 * Generate 1-click Google Calendar Web Add-Event URL
 */
function buildGoogleCalendarWebUrl({ title, startTime, endTime, description, location }) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const formatTime = (d) => new Date(d).toISOString().replace(/-|:|\.\d\d\d/g, '');
  
  const startISO = formatTime(startTime || new Date());
  const endISO = formatTime(endTime || new Date(Date.now() + 30 * 60 * 1000));
  
  const params = new URLSearchParams({
    text: title || 'AI Demo & Strategy Session — ZeroRefer Studio',
    dates: `${startISO}/${endISO}`,
    details: description || 'Confirmed AI voice receptionist demo and custom ROI setup session.',
    location: location || 'Phone / Online Call'
  });
  
  return `${base}&${params.toString()}`;
}

/**
 * Create Google Calendar Event (API + Store Sync)
 */
async function createCalendarAppointment(appointmentData = {}) {
  const {
    clientName = 'Valued Client',
    clientPhone = '',
    clientEmail = '',
    industry = 'business',
    preferredTime = null,
    notes = ''
  } = appointmentData;

  const startTime = preferredTime ? new Date(preferredTime) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min duration

  const title = `📅 AI Call Demo: ${clientName} (${industry})`;
  const description = `Client Phone: ${clientPhone}\nClient Email: ${clientEmail}\nIndustry: ${industry}\nNotes: ${notes}`;

  const webCalendarUrl = buildGoogleCalendarWebUrl({
    title,
    startTime,
    endTime,
    description
  });

  const record = {
    id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    clientName,
    clientPhone,
    clientEmail,
    industry,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    webCalendarUrl,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  // Store in store.json
  if (typeof store.addAppointment === 'function') {
    store.addAppointment(record);
  }

  // Attempt Google Calendar API v3 if service credentials exist
  let googleApiEventId = null;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: title,
            description,
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() }
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        googleApiEventId = data.id;
      }
    } catch (err) {
      console.error('[CALENDAR] Google API call failed, falling back to Web URL:', err.message);
    }
  }

  return {
    success: true,
    appointment: record,
    webCalendarUrl,
    googleApiEventId
  };
}

module.exports = {
  buildGoogleCalendarWebUrl,
  createCalendarAppointment
};
