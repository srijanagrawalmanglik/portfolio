// One-off: push content.linkedin.json (LinkedIn-synced site content) into MongoDB.
// The live site renders from MongoDB, so editing database.json alone does not change it.
// Usage: MONGO_URI=... node sync-content.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Content, Project } = require('./models');
const data = require('./content.linkedin.json');
(async () => {
    if (!process.env.MONGO_URI) { console.error('MONGO_URI missing'); process.exit(1); }
    await mongoose.connect(process.env.MONGO_URI);
    const { projects, ...resume } = data.resume;
    await Content.updateOne({}, { $set: { hero: data.hero, about: data.about, 'resume.experience': resume.experience, 'resume.education': resume.education, 'resume.skills': resume.skills, certifications: data.certifications } }, { upsert: true });
    await Project.deleteMany({});
    await Project.insertMany(projects);
    console.log('Content synced to MongoDB.');
    await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
