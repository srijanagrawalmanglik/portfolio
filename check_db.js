const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

try {
    if (!fs.existsSync(DB_FILE)) {
        console.log("Database file not found.");
        process.exit(1);
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(data);

    if (db.admin && db.admin.googleTokens) {
        console.log("Google Tokens: PRESENT");
        // Optional: Check if empty object
        if (Object.keys(db.admin.googleTokens).length === 0) {
            console.log("Warning: googleTokens object is empty.");
        }
    } else {
        console.log("Google Tokens: MISSING");
    }

    if (db.admin && db.admin.googleTokens && db.admin.googleTokens.access_token) {
        console.log("Access Token: PRESENT");
    } else {
        console.log("Access Token: MISSING");
    }


} catch (err) {
    console.error("Error reading DB:", err);
}
