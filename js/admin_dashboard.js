function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedContent = document.getElementById(`tab-${tabName}`);
    if (selectedContent) {
        selectedContent.style.display = 'block';
    }

    // Find and activate the corresponding tab button
    const activeTabBtn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if (activeTabBtn) {
        activeTabBtn.classList.add('active');
    }
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-card').forEach(card => card.style.display = 'none');

    // Show the selected section
    const selectedSection = document.getElementById(`${sectionName}-section`);
    if (selectedSection) {
        selectedSection.style.display = 'block';

        // Auto-refresh logs when logs section is shown
        if (sectionName === 'logs') {
            refreshLogs();
            // Set up auto-refresh every 30 seconds
            if (!window.logsRefreshInterval) {
                window.logsRefreshInterval = setInterval(refreshLogs, 30000);
            }
        }
    } else if (sectionName === 'staff') {
        // Staff section is the first one, no id
        document.querySelector('.content-card').style.display = 'block';
        // Clear logs auto-refresh when switching away
        if (window.logsRefreshInterval) {
            clearInterval(window.logsRefreshInterval);
            window.logsRefreshInterval = null;
        }
    } else {
        // Clear logs auto-refresh when switching to other sections
        if (window.logsRefreshInterval) {
            clearInterval(window.logsRefreshInterval);
            window.logsRefreshInterval = null;
        }
    }
}

function openAddModal() {
    document.getElementById('addModal').style.display = 'flex';
}

function closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
    document.getElementById('addStaffForm').reset();
}

function toggleDept() {
    const isDoc = document.getElementById('role-doc').checked;
    document.getElementById('deptContainer').style.display = isDoc ? 'block' : 'none';
}

// --- Form Submission ---
document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.querySelector('.modal-submit');
    submitBtn.textContent = "Adding...";
    submitBtn.disabled = true;

    const role = document.getElementById('role-doc').checked ? 'Doctor' : 'Pharmacist';

    const data = {
        role: role,
        name: document.getElementById('newName').value,
        phone: document.getElementById('newPhone').value,
        email: document.getElementById('newEmail').value,
        department: role === 'Doctor' ? document.getElementById('newDept').value : null
    };

    try {
        const res = await fetch('/admin/add_staff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (res.ok) {
            closeAddModal();
            document.getElementById('resUser').textContent = result.details.username;
            document.getElementById('resPass').textContent = result.details.password;
            document.getElementById('successModal').style.display = 'flex';
        } else {
            alert("Error: " + result.error);
        }
    } catch (err) {
        alert("Network error. Please try again.");
    } finally {
        submitBtn.textContent = "Create Account";
        submitBtn.disabled = false;
    }
});

// --- Logs Refresh Functionality ---
async function refreshLogs() {
    const refreshBtn = document.getElementById('refreshLogsBtn');
    const originalText = refreshBtn.innerHTML;

    // Show loading state
    refreshBtn.disabled = true;

    try {
        const response = await fetch('/admin/logs');
        if (!response.ok) {
            throw new Error('Failed to fetch logs');
        }

        const logs = await response.json();
        updateLogsTable(logs);
    } catch (error) {
        console.error('Error refreshing logs:', error);
        alert('Failed to refresh logs. Please try again.');
    } finally {
        // Restore original button state
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

function updateLogsTable(logs) {
    const tbody = document.querySelector('#logs-section tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    logs.forEach(log => {
        const row = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.className = 'text-secondary';
        timeCell.textContent = log.timestamp;
        row.appendChild(timeCell);

        const userCell = document.createElement('td');
        userCell.className = 'font-medium';
        userCell.textContent = log.display_user;
        row.appendChild(userCell);

        const actionCell = document.createElement('td');
        let actionIcon = '';
        if (log.actionType === 'Face Scan') actionIcon = '📷 Face Scan';
        else if (log.actionType === 'QR Scan') actionIcon = '📱 QR Scan';
        else if (log.actionType === 'Web Login') actionIcon = '💻 Web Login';
        else actionIcon = log.actionType;
        actionCell.innerHTML = actionIcon;
        row.appendChild(actionCell);

        const statusCell = document.createElement('td');
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status-active';
        if (log.status === 'Success') {
            statusSpan.style.background = '#e8f5e9';
            statusSpan.style.color = '#2e7d32';
        } else {
            statusSpan.style.background = '#ffebee';
            statusSpan.style.color = '#c62828';
        }
        statusSpan.textContent = log.status;
        statusCell.appendChild(statusSpan);
        row.appendChild(statusCell);

        const detailsCell = document.createElement('td');
        detailsCell.className = 'text-secondary';
        detailsCell.textContent = log.details;
        row.appendChild(detailsCell);

        tbody.appendChild(row);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    switchTab('doctors');
});
