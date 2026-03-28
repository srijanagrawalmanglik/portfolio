const http = require('http');
const querystring = require('querystring');

// Helper to make requests
function request(options, postData = null, cookie = null) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: 'localhost',
            port: 3000,
            ...options,
            headers: {
                ...options.headers,
                'Cookie': cookie || ''
            }
        };

        if (postData) {
            reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
        });

        req.on('error', (e) => reject(e));

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// JSON Helper
function requestJson(options, jsonData, cookie = null) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(jsonData);
        const reqOptions = {
            hostname: 'localhost',
            port: 3000,
            ...options,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': cookie || ''
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log("Starting Verification...");
    let cookie = null;

    // 1. Login
    try {
        const postData = querystring.stringify({ username: 'admin', password: 'admin123' });
        const res = await request({ path: '/login', method: 'POST' }, postData);

        if (res.statusCode === 302 && res.headers['set-cookie']) {
            cookie = res.headers['set-cookie'][0].split(';')[0];
            console.log("[PASS] Login successful. Cookie obtained.");
        } else {
            console.error("[FAIL] Login failed.", res.statusCode);
            process.exit(1);
        }
    } catch (e) { console.error("[FAIL] Login Error", e); }

    // 2. Add Project
    const projTitle = "PerfTest_" + Date.now();
    try {
        const postData = querystring.stringify({ title: projTitle, desc: "Auto Test", tags: "perf,test" });
        const res = await request({ path: '/admin/projects/add', method: 'POST' }, postData, cookie);

        if (res.statusCode === 302) {
            console.log("[PASS] Add Project request successful (Redirected).");
        } else {
            console.error("[FAIL] Add Project failed.", res.statusCode);
        }
    } catch (e) { console.error("[FAIL] Add Project Error", e); }

    // 3. Verify Project in Dashboard
    try {
        const res = await request({ path: '/dashboard?tab=projects', method: 'GET' }, null, cookie);
        if (res.data.includes(projTitle)) {
            console.log("[PASS] Project found in dashboard HTML.");
        } else {
            console.error("[FAIL] Project NOT found in dashboard HTML.");
        }
    } catch (e) { console.error("[FAIL] Verify Project Error", e); }

    // 4. Tracker API Save
    const today = new Date().toISOString().split('T')[0];
    try {
        const payload = {
            date: today,
            log: { score: 100, tasks: [{ name: "TestHabit", status: "executed" }] }
        };
        const res = await requestJson({ path: '/api/tracker/save', method: 'POST' }, payload, cookie);
        const json = JSON.parse(res.data);
        if (json.success) {
            console.log("[PASS] Tracker Save API successful.");
        } else {
            console.error("[FAIL] Tracker Save API failed.");
        }
    } catch (e) { console.error("[FAIL] Tracker Save Error", e); }

    console.log("Verification Complete.");
}

runTests();
