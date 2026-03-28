require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

// Mock DB Load
function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return null;
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading DB:", err);
        return null;
    }
}

const db = loadDB();

if (!db || !db.admin || !db.admin.googleTokens) {
    console.error("No tokens found in DB.");
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials(db.admin.googleTokens);

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

async function listEvents() {
    try {
        console.log("Attempting to fetch events...");
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = response.data.items;
        if (events.length) {
            console.log(`Upcoming events (${events.length}):`);
            events.map((event, i) => {
                const start = event.start.dateTime || event.start.date;
                console.log(`${start} - ${event.summary}`);
            });
        } else {
            console.log('No upcoming events found.');
        }
    } catch (error) {
        console.error('The API returned an error: ' + error);
        if (error.response) {
            console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

listEvents();
