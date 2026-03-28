require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const fs = require('fs');

const multer = require('multer');

const app = express();
const { google } = require('googleapis');
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// --- FILE UPLOAD CONFIG ---
// Ensure directory exists
const RESUME_DIR = path.join(__dirname, 'public/assets/resume');
if (!fs.existsSync(RESUME_DIR)) {
    fs.mkdirSync(RESUME_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, RESUME_DIR);
    },
    filename: (req, file, cb) => {
        // Force filename to 'resume.pdf' to keep frontend link consistent
        cb(null, 'resume' + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- DATABASE HELPER FUNCTIONS ---
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

async function saveDB(data) {
    try {
        await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error saving DB:", err);
    }
}

// Initialize persistence
let db = loadDB();
if (!db) {
    console.error("CRITICAL: database.json missing or invalid.");
    process.exit(1);
}

// Ensure Admin Password
(async () => {
    if (!db.admin.passwordHash) {
        console.log("Initializing admin password...");
        db.admin.passwordHash = await bcrypt.hash('admin123', 10);
        await saveDB(db);
    }
})();

// Security Middleware
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-dev-only',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true, 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 60 * 1000 
    } 
}));

// --- ROUTES ---

// Home
app.get('/', (req, res) => {
    res.render('index', { content: db.content });
});

// Login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    // Hardcoded username 'admin' for now
    if (username !== 'admin') return res.render('login', { error: 'Invalid Credentials' });

    const match = await bcrypt.compare(password, db.admin.passwordHash);
    if (match) {
        req.session.isAuthenticated = true;
        req.session.user = 'admin';
        return res.redirect('/dashboard');
    } else {
        return res.render('login', { error: 'Invalid Credentials' });
    }
});

// Dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session.isAuthenticated) return res.redirect('/login');
    // Refresh DB from disk just in case (though singleton is fine for single instance)
    // but in-memory 'db' variable is efficient enough.
    res.render('dashboard', {
        user: req.session.user,
        messages: db.messages || [],
        content: db.content,
        googleLinked: !!db.admin.googleTokens,
        attendance: db.attendance || []
    });
});

// Contact Form
app.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;
    if (name && email && message) {
        db.messages.unshift({
            id: Date.now(),
            name,
            email,
            message,
            date: new Date().toLocaleDateString(),
            read: false // New field for "Read" status
        });
        await saveDB(db);
    }
    res.redirect('/');
});

// --- GOOGLE CALENDAR INTEGRATION ---

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// 1. Auth Init
app.get('/auth/google', (req, res) => {
    if (!req.session.isAuthenticated) return res.redirect('/login');

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Request refresh token
        scope: ['https://www.googleapis.com/auth/calendar']
    });
    res.redirect(url);
});

// 2. Auth Callback
app.get('/auth/google/callback', async (req, res) => {
    if (!req.session.isAuthenticated) return res.redirect('/login');
    const { code } = req.query;
    if (code) {
        try {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);

            // Save tokens to DB (in reality, should be per user)
            db.admin.googleTokens = tokens;
            await saveDB(db);

            console.log("Google Auth Successful. Tokens saved.");
            res.redirect('/dashboard?tab=calendar');
        } catch (error) {
            console.error("Error retrieving access token", error);
            res.status(500).send("Error authenticating with Google");
        }
    }
});

// Helper: Get Authorized Client
function getAuthClient() {
    if (db.admin.googleTokens) {
        oauth2Client.setCredentials(db.admin.googleTokens);
        return oauth2Client;
    }
    return null;
}

// 3. API: List Events
app.get('/api/calendar/events', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });

    const auth = getAuthClient();
    if (!auth) return res.json({ needsAuth: true });

    const calendar = google.calendar({ version: 'v3', auth });
    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: req.query.start || (new Date()).toISOString(),
            timeMax: req.query.end || undefined,
            maxResults: 2500, // Increased limit for full month view
            singleEvents: true,
            orderBy: 'startTime',
        });
        res.json({ events: response.data.items });
    } catch (error) {
        console.error('The API returned an error: ' + error);
        // If error is invalid_grant, might need to re-auth
        res.status(500).json({ error: 'API Error', details: error.message });
    }
});

// 4. API: Add Event
app.post('/api/calendar/add', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { summary, startDateTime, endDateTime } = req.body;

    const auth = getAuthClient();
    if (!auth) return res.status(401).json({ error: 'Not Linked' });

    const calendar = google.calendar({ version: 'v3', auth });
    const event = {
        summary: summary,
        start: { dateTime: new Date(startDateTime).toISOString() },
        end: { dateTime: new Date(endDateTime).toISOString() },
    };

    try {
        await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        res.redirect('/dashboard?tab=calendar'); // Persist tab
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).send("Error creating event");
    }
});

// --- ATTENDANCE TRACKER API (GCAL SYNCED) ---

// 1. Get Subjects & Stats
app.get('/api/attendance', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const auth = getAuthClient();
    if (!auth) return res.json({ subjects: db.attendance || [], needsAuth: true });

    // Ensure structure
    if (!db.attendance) db.attendance = []; // Subjects: [{ id, name, code }]
    if (!db.attendanceRecords) db.attendanceRecords = []; // Records: [{ eventId, subjectId, status }]

    const calendar = google.calendar({ version: 'v3', auth });
    const subjects = db.attendance;
    const stats = {};
    const unmarkedEvents = [];

    // Sync Logic: Check GCal for each subject
    // Note: In production, this should be cached or done via client-side async for speed.
    // For now, we'll do a simple check of the last 30 days.
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);

    try {
        const eventsRes = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: new Date().toISOString(), // Only past events
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250
        });
        const events = eventsRes.data.items || [];

        subjects.forEach(sub => {
            // Find matching events
            const matches = events.filter(e =>
                e.summary && e.summary.toLowerCase().includes(sub.code.toLowerCase())
            );

            let attended = 0;
            let total = 0;

            matches.forEach(ev => {
                // Check if marked
                const record = db.attendanceRecords.find(r => r.eventId === ev.id);
                if (record) {
                    total++;
                    if (record.status === 'present') attended++;
                } else {
                    // Unmarked
                    unmarkedEvents.push({
                        subjectId: sub.id,
                        subjectName: sub.name,
                        eventId: ev.id,
                        summary: ev.summary,
                        start: ev.start.dateTime || ev.start.date
                    });
                }
            });

            stats[sub.id] = { attended, total, pct: total > 0 ? Math.round((attended / total) * 100) : 0 };
        });

        res.json({ subjects, stats, unmarkedEvents });

    } catch (err) {
        console.error("GCal Sync Error:", err);
        // Fallback: just return local subjects if API fails
        res.json({ subjects, stats: {}, unmarkedEvents: [], error: "Sync Failed" });
    }
});

// 2. Add Subject (Name + Code)
app.post('/api/attendance/add', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { name, code } = req.body;
    console.log("Adding Subject:", { name, code }); // Debug Log
    if (name && code) {
        if (!db.attendance) db.attendance = [];
        db.attendance.push({
            id: Date.now(),
            name,
            code
        });
        await saveDB(db);
        console.log("Subject Added to DB");
    } else {
        console.error("Failed to add subject: Missing name or code");
    }
    res.redirect('/dashboard?tab=attendance');
});

// 3. Mark specific Event
app.post('/api/attendance/mark-event', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { eventId, subjectId, status } = req.body; // status: 'present' | 'absent'

    if (!db.attendanceRecords) db.attendanceRecords = [];

    // Remove existing if re-marking
    db.attendanceRecords = db.attendanceRecords.filter(r => r.eventId !== eventId);

    db.attendanceRecords.push({ eventId, subjectId, status });
    await saveDB(db);

    res.json({ success: true }); // AJAX response preferred
});

// 4. Delete Subject
app.post('/api/attendance/delete', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { id } = req.body;
    if (db.attendance) {
        db.attendance = db.attendance.filter(s => s.id != id);
        // Also cleanup records? Optional.
        await saveDB(db);
    }
    res.redirect('/dashboard?tab=attendance');
});

// --- TRACKER API ---

// 1. Get Tracker Data
app.get('/api/tracker', (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });

    if (!db.tracker) db.tracker = { template: [], logs: {} };
    // V4 Init
    if (!db.tracker.goals) db.tracker.goals = {};
    if (!db.tracker.protocols) db.tracker.protocols = {};
    if (!db.tracker.moods) db.tracker.moods = {};
    if (!db.tracker.achievements) db.tracker.achievements = [];

    res.json(db.tracker);
});

// 2. Save Daily Log (Tasks)
app.post('/api/tracker/save', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { date, log } = req.body;

    if (!db.tracker) db.tracker = { template: [], logs: {} };
    db.tracker.logs[date] = log;
    await saveDB(db);
    res.json({ success: true });
});

// 3. Update Template
app.post('/api/tracker/template', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { template } = req.body;

    if (!db.tracker) db.tracker = { template: [], logs: {} };
    db.tracker.template = template;
    await saveDB(db);
    res.json({ success: true });
});

// 4. Update Goal (New)
app.post('/api/tracker/goal', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { habit, month, goal } = req.body; // month: 'YYYY-MM'

    if (!db.tracker.goals) db.tracker.goals = {};
    if (!db.tracker.goals[habit]) db.tracker.goals[habit] = {};
    db.tracker.goals[habit][month] = parseInt(goal);

    await saveDB(db);
    res.json({ success: true });
});

// 5. Update Protocol (New)
app.post('/api/tracker/protocol', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { date, protocols } = req.body; // protocols: object { name: bool }

    if (!db.tracker.protocols) db.tracker.protocols = {};
    db.tracker.protocols[date] = protocols;

    await saveDB(db);
    res.json({ success: true });
});

// 6. Update Mood (New)
app.post('/api/tracker/mood', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { date, data } = req.body; // data: { energy, mood, screenTime... }

    if (!db.tracker.moods) db.tracker.moods = {};
    db.tracker.moods[date] = data;

    await saveDB(db);
    res.json({ success: true });
});

// 7. Add Achievement (New)
app.post('/api/tracker/achievement', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { text, date } = req.body;

    if (!db.tracker.achievements) db.tracker.achievements = [];
    db.tracker.achievements.push({ id: Date.now(), text, date });

    await saveDB(db);
    res.json({ success: true });
});

// 8. Delete Achievement (New)
app.post('/api/tracker/achievement/delete', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).json({ error: 'Unauthorized' });
    const { id } = req.body;

    if (db.tracker.achievements) {
        db.tracker.achievements = db.tracker.achievements.filter(a => a.id != id);
        await saveDB(db);
    }
    res.json({ success: true });
});

// --- ADMIN API ---

// Update Content (Bio, Hero, About)
app.post('/admin/update-content', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');

    // Merge updates deep
    if (req.body.hero) db.content.hero = { ...db.content.hero, ...req.body.hero };
    if (req.body.about) db.content.about = { ...db.content.about, ...req.body.about };

    // Legacy Bio Support (if simple bio field is sent)
    if (req.body.bio) db.content.about.bio = req.body.bio;

    await saveDB(db);
    res.redirect('/dashboard?tab=content');
});

// Upload Resume
app.post('/admin/resume', upload.single('resume'), (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    console.log("Resume uploaded successfully.");
    res.redirect('/dashboard?tab=bio');
});

// Add Project
app.post('/admin/projects/add', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    try {
        const { title, desc, tags } = req.body;
        if (title && desc) {
            const tagArray = (tags && typeof tags === 'string') ? tags.split(',').map(t => t.trim()) : [];
            if (!db.content.resume.projects) db.content.resume.projects = [];
            db.content.resume.projects.push({
                id: Date.now(),
                title, desc, tags: tagArray
            });
            await saveDB(db);
        }
    } catch (err) {
        console.error("Error adding project:", err);
    }
    res.redirect('/dashboard?tab=projects');
});

// Edit Project
app.post('/admin/projects/edit', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    try {
        const { id, title, desc, tags } = req.body;
        if (!db.content.resume.projects) db.content.resume.projects = [];
        const project = db.content.resume.projects.find(p => p.id == id);
        if (project) {
            if (title) project.title = title;
            if (desc) project.desc = desc;
            if (tags && typeof tags === 'string') {
                project.tags = tags.split(',').map(t => t.trim());
            } else if (tags === '') {
                project.tags = []; // Allow clearing tags
            }
            await saveDB(db);
        }
    } catch (err) {
        console.error("Error editing project:", err);
    }
    res.redirect('/dashboard?tab=projects');
});

// Delete Project
app.post('/admin/projects/delete', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    const { id } = req.body;
    db.content.resume.projects = db.content.resume.projects.filter(p => p.id != id);
    await saveDB(db);
    res.redirect('/dashboard?tab=projects');
});

// --- CERTIFICATIONS API ---

app.post('/admin/certifications/add', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    const { name, issuer, icon, style } = req.body;
    if (name && issuer) {
        if (!db.content.certifications) db.content.certifications = [];
        db.content.certifications.push({
            id: Date.now(),
            name, issuer, icon, style
        });
        await saveDB(db);
    }
    res.redirect('/dashboard?tab=content'); // OR certs tab
});

app.post('/admin/certifications/delete', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    const { id } = req.body;
    if (db.content.certifications) {
        db.content.certifications = db.content.certifications.filter(c => c.id != id);
        await saveDB(db);
    }
    res.redirect('/dashboard?tab=content');
});

// Delete Message (New)
app.post('/admin/messages/delete', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    const { id } = req.body;
    db.messages = db.messages.filter(m => m.id != id); // Filter out the msg
    await saveDB(db);
    res.redirect('/dashboard?tab=inbox');
});

// Mark Message Read (New)
app.post('/admin/messages/read', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    const { id } = req.body;
    const msg = db.messages.find(m => m.id == id);
    if (msg) {
        msg.read = true;
        await saveDB(db);
    }
    res.redirect('/dashboard?tab=inbox');
});

// Update Password
app.post('/admin/settings/password', async (req, res) => {
    if (!req.session.isAuthenticated) return res.status(403).send('Unauthorized');
    const { newPassword } = req.body;
    if (newPassword) {
        db.admin.passwordHash = await bcrypt.hash(newPassword, 10);
        await saveDB(db);
        console.log("Admin password updated.");
    }
    res.redirect('/dashboard?tab=settings');
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
