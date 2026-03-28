// Dashboard Configuration
const SECRET_CODE = 'devmode';
const ADMIN_PASS = 'admin'; // Simple mock password
const STORAGE_Tasks = 'portfolio_tasks';
const STORAGE_Stats = 'portfolio_stats';
const STORAGE_LastLogin = 'portfolio_last_login';

// DOM Elements
const body = document.body;
const dashboardOverlay = document.getElementById('dashboard-overlay');
const loginScreen = document.getElementById('login-screen');
const dashboardContent = document.getElementById('dashboard-content');
const loginBtn = document.getElementById('login-btn');
const passInput = document.getElementById('admin-pass');
const closeBtn = document.getElementById('close-dash');
const taskList = document.getElementById('task-list');
const progressBar = document.getElementById('daily-progress');
const heatmapGrid = document.getElementById('heatmap-grid');
const addTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');

// State
let inputSequence = '';
let tasks = loadTasks();
let stats = JSON.parse(localStorage.getItem(STORAGE_Stats)) || {};

// --- Initialization ---

// Key Sequence Trigger
window.addEventListener('keydown', (e) => {
    inputSequence += e.key.toLowerCase();
    if (inputSequence.length > SECRET_CODE.length) {
        inputSequence = inputSequence.substr(inputSequence.length - SECRET_CODE.length);
    }
    if (inputSequence === SECRET_CODE) {
        openDashboard();
        inputSequence = ''; // Reset
    }
});

// Daily Reset Logic
checkDailyReset();

// --- Functions ---

function openDashboard() {
    dashboardOverlay.classList.remove('hidden-dash');
    // Check if already authenticated in this session could be added here
    // For now, always show login
    loginScreen.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    passInput.value = '';
    passInput.focus();
}

function closeDashboard() {
    dashboardOverlay.classList.add('hidden-dash');
}

function checkDailyReset() {
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem(STORAGE_LastLogin);

    if (lastLogin !== today) {
        // Reset daily completion but keep tasks
        tasks = tasks.map(t => ({ ...t, completed: false }));
        saveTasks();
        localStorage.setItem(STORAGE_LastLogin, today);
    }
}

function loadTasks() {
    const stored = localStorage.getItem(STORAGE_Tasks);
    if (stored) return JSON.parse(stored);

    // Default Tasks
    return [
        { id: 1, text: 'Review Code Changes', completed: false },
        { id: 2, text: 'Update Portfolio', completed: false },
        { id: 3, text: 'Learn New Tech', completed: false },
        { id: 4, text: 'Hydrate 💧', completed: false }
    ];
}

function saveTasks() {
    localStorage.setItem(STORAGE_Tasks, JSON.stringify(tasks));
    updateStats();
    renderTasks();
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    stats[today] = percent;
    localStorage.setItem(STORAGE_Stats, JSON.stringify(stats));

    // Update UI
    progressBar.style.width = `${percent}%`;
    if (percent === 100) {
        progressBar.style.backgroundColor = '#00ff88'; // Green for completion
    } else {
        progressBar.style.backgroundColor = 'var(--secondary)';
    }

    renderHeatmap();
}

// --- Rendering ---

function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <div class="task-left">
                <div class="checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}">
                    ${task.completed ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <span>${task.text}</span>
            </div>
            <button class="delete-task" data-id="${task.id}"><i class="fas fa-trash"></i></button>
        `;
        taskList.appendChild(li);
    });
}

function renderHeatmap() {
    heatmapGrid.innerHTML = '';
    // Show last 30 days
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const percent = stats[dateStr] || 0;

        const dayDiv = document.createElement('div');
        dayDiv.className = 'heatmap-day';
        dayDiv.title = `${dateStr}: ${percent}%`;

        // Color intensity
        if (percent === 0) dayDiv.style.opacity = '0.2';
        else if (percent < 50) dayDiv.style.opacity = '0.5';
        else if (percent < 100) dayDiv.style.opacity = '0.8';
        else dayDiv.style.opacity = '1';

        // Highlight today
        const today = new Date().toISOString().split('T')[0];
        if (dateStr === today) {
            dayDiv.style.border = '1px solid white';
        }

        heatmapGrid.appendChild(dayDiv);
    }
}

// --- Event Listeners ---

loginBtn.addEventListener('click', () => {
    if (passInput.value === ADMIN_PASS) {
        loginScreen.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
        renderTasks();
        updateStats(); // Also renders heatmap
    } else {
        passInput.style.borderColor = 'red';
        setTimeout(() => passInput.style.borderColor = 'rgba(255,255,255,0.1)', 500);
    }
});

closeBtn.addEventListener('click', closeDashboard);

// Task Interactions (Delegation)
taskList.addEventListener('click', (e) => {
    // Checkbox click
    const checkbox = e.target.closest('.checkbox');
    if (checkbox) {
        const id = parseInt(checkbox.dataset.id);
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
        }
    }

    // Delete click
    const delBtn = e.target.closest('.delete-task');
    if (delBtn) {
        const id = parseInt(delBtn.dataset.id);
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
    }
});

// Add Task
addTaskBtn.addEventListener('click', () => {
    const text = addTaskInput.value.trim();
    if (text) {
        const newTask = {
            id: Date.now(),
            text: text,
            completed: false
        };
        tasks.push(newTask);
        addTaskInput.value = '';
        saveTasks();
    }
});
