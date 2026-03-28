const mongoose = require('mongoose');

// --- MESSAGE MODEL ---
const MessageSchema = new mongoose.Schema({
    id: Number,
    name: String,
    email: String,
    message: String,
    date: String,
    read: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', MessageSchema);

// --- PROJECT MODEL ---
const ProjectSchema = new mongoose.Schema({
    id: Number,
    title: String,
    desc: String,
    tags: [String]
});
const Project = mongoose.model('Project', ProjectSchema);

// --- HABIT MODEL --- (For fallback matching prompt)
const HabitSchema = new mongoose.Schema({
    date: String,
    tasks: [{ name: String, status: String }],
    score: Number
});
const Habit = mongoose.model('Habit', HabitSchema);

// --- CONTENT MODEL --- (Singleton)
const ContentSchema = new mongoose.Schema({
    hero: { name: String, subtitle: String, title: String, desc: String },
    about: { subtitle: String, title: String, bio: String },
    resume: {
        experience: [{ role: String, company: String, date: String, desc: String }],
        education: [{ degree: String, institute: String, year: String, score: String }],
        skills: [String],
        projects: [ProjectSchema] // Embedded or referenced? Using embedded matching JSON
    },
    certifications: [{ id: Number, name: String, issuer: String, icon: String, style: String }]
});
const Content = mongoose.model('Content', ContentSchema);

// --- ADMIN MODEL --- (Singleton)
const AdminSchema = new mongoose.Schema({
    passwordHash: String,
    googleTokens: {
        access_token: String,
        refresh_token: String,
        scope: String,
        token_type: String,
        refresh_token_expires_in: Number,
        expiry_date: Number
    }
});
const Admin = mongoose.model('Admin', AdminSchema);

// --- TRACKER MODEL --- (Singleton)
const TrackerSchema = new mongoose.Schema({
    template: [String],
    logs: { type: Map, of: mongoose.Schema.Types.Mixed }, // Dynamic keys for dates (2026-01-15)
    goals: { type: Map, of: mongoose.Schema.Types.Mixed },
    protocols: { type: Map, of: mongoose.Schema.Types.Mixed },
    moods: { type: Map, of: mongoose.Schema.Types.Mixed },
    achievements: [{ id: Number, text: String, date: String }]
}, { minimize: false });
const Tracker = mongoose.model('Tracker', TrackerSchema);

// --- ATTENDANCE MODEL --- (Collections)
const SubjectSchema = new mongoose.Schema({
    id: Number,
    name: String,
    code: String
});
const Subject = mongoose.model('Subject', SubjectSchema);

const AttendanceRecordSchema = new mongoose.Schema({
    eventId: String,
    subjectId: Number,
    status: String
});
const AttendanceRecord = mongoose.model('AttendanceRecord', AttendanceRecordSchema);

module.exports = { Message, Project, Habit, Content, Admin, Tracker, Subject, AttendanceRecord };
