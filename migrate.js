require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Import Schemas
const { Message, Project, Habit, Content, Admin, Tracker, Subject, AttendanceRecord } = require('./models');
const DB_FILE = path.join(__dirname, 'database.json');

async function migrate() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            console.error("Migration Aborted: database.json not found.");
            return;
        }

        console.log(`Connecting to MongoDB Atlas...`);
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Connected successfully.`);

        console.log(`Parsing database.json...`);
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        // 1. Migrate Messages
        if (data.messages && data.messages.length > 0) {
            const count = await Message.countDocuments();
            if (count === 0) {
                await Message.insertMany(data.messages);
                console.log(`✔ Messages Migrated: ${data.messages.length}`);
            } else {
                console.log(`⚠ Messages skipped (already seeded).`);
            }
        }

        // 2. Migrate Content (Singleton Document)
        if (data.content) {
            const count = await Content.countDocuments();
            if (count === 0) {
                await Content.create(data.content);
                console.log(`✔ Content Migrated.`);
            } else {
                console.log(`⚠ Content skipped (already seeded).`);
            }
        }

        // 3. Migrate Projects securely mapped out
        if (data.content && data.content.resume && data.content.resume.projects) {
            const projects = data.content.resume.projects;
            const count = await Project.countDocuments();
            if (count === 0 && projects.length > 0) {
                await Project.insertMany(projects);
                console.log(`✔ Projects Extracted & Migrated: ${projects.length}`);
            } else {
                console.log(`⚠ Projects skipped.`);
            }
        }

        // 4. Migrate Admin
        if (data.admin) {
            const count = await Admin.countDocuments();
            if (count === 0) {
                await Admin.create(data.admin);
                console.log(`✔ Admin config Migrated.`);
            } else {
                console.log(`⚠ Admin skipped.`);
            }
        }

        // 5. Migrate Tracker Log Data (fallback to Habit)
        if (data.tracker) {
            const count = await Tracker.countDocuments();
            if (count === 0) {
                await Tracker.create(data.tracker);
                console.log(`✔ Comprehensive Tracker Config Migrated.`);
            } else {
                console.log(`⚠ Tracker Config skipped.`);
            }

            // Syncing specifically with "Habits" model requested by prompt?
            if (data.tracker.logs) {
                const habitCount = await Habit.countDocuments();
                if (habitCount === 0) {
                    const mappedHabits = Object.entries(data.tracker.logs).map(([date, log]) => ({
                        date,
                        tasks: log.tasks,
                        score: log.score
                    }));
                    if (mappedHabits.length > 0) {
                        await Habit.insertMany(mappedHabits);
                        console.log(`✔ Individual Habits Extracted & Migrated: ${mappedHabits.length}`);
                    }
                } else {
                    console.log(`⚠ Habits skipped.`);
                }
            }
        }

        // 6. Migrate Attendance
        if (data.attendance && data.attendance.length > 0) {
            const count = await Subject.countDocuments();
            if (count === 0) {
                await Subject.insertMany(data.attendance);
                console.log(`✔ Attendance Subjects Migrated: ${data.attendance.length}`);
            }
        }

        if (data.attendanceRecords && data.attendanceRecords.length > 0) {
            const count = await AttendanceRecord.countDocuments();
            if (count === 0) {
                await AttendanceRecord.insertMany(data.attendanceRecords);
                console.log(`✔ Attendance Records Migrated: ${data.attendanceRecords.length}`);
            }
        }

        console.log(`\n🎉 Migration to Mongoose Complete!`);
        process.exit(0);

    } catch (error) {
        console.error("Fatal Migration Error:", error);
        process.exit(1);
    }
}

migrate();
