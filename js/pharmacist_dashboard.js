let currentAction = null; // 'verify' or 'reject'
let currentId = null;
let allPrescriptions = [];
let currentFilter = 'all';

// --- Tab and Search Functionality ---

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // Search functionality
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const searchInput = document.getElementById('searchInput');

    // Check if there's a search query and show/hide clear button accordingly
    const urlParams = new URLSearchParams(window.location.search);
    const hasSearchQuery = urlParams.has('search') && urlParams.get('search').trim() !== '';
    clearSearchBtn.style.display = hasSearchQuery ? 'inline-block' : 'none';

    searchBtn.addEventListener('click', performSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Load all prescriptions for client-side filtering if on 'all' tab
    const activeTab = urlParams.get('tab') || 'pending';
    if (activeTab === 'all' && !hasSearchQuery) {
        loadAllPrescriptions();
    }

    // Auto-refresh functionality for new prescriptions
    setInterval(() => {
        // Only auto-refresh if no modal is open and no search is active
        const modal = document.getElementById('actionModal');
        const hasSearch = urlParams.has('search') && urlParams.get('search').trim() !== '';

        if (modal.style.display !== 'flex' && !hasSearch) {
            window.location.reload();
        }
    }, 30000); // Refresh every 30 seconds
});

function switchTab(tab) {
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    url.searchParams.delete('search'); // Clear search when switching tabs
    window.location.href = url.toString();
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        console.error('Search input element not found');
        return;
    }
    const query = searchInput.value.trim();

    if (query) {
        const url = new URL(window.location);
        url.searchParams.set('search', query);
        url.searchParams.set('tab', 'all'); // Default to 'all' tab when searching
        window.location.href = url.toString();
    }
}

function clearSearch() {
    const url = new URL(window.location);
    url.searchParams.delete('search');
    window.location.href = url.toString();
}

async function loadAllPrescriptions() {
    try {
        const response = await fetch('/api/pharmacist/all_prescriptions');
        const prescriptions = await response.json();

        if (response.ok) {
            allPrescriptions = prescriptions;
            renderFilteredPrescriptions();
        } else {
            console.error('Failed to load prescriptions:', prescriptions);
        }
    } catch (error) {
        console.error('Error loading prescriptions:', error);
    }
}

// --- Modal Functions ---

function openModal(action, id) {
    currentAction = action;
    currentId = id;
    
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDesc');
    const rejectInput = document.getElementById('rejectInputContainer');
    const confirmBtn = document.getElementById('confirmBtn');
    const reasonBox = document.getElementById('rejectReason');

    // Configure Modal for VERIFY
    if (action === 'verify') {
        title.textContent = "Verify & Sign Prescription";
        desc.textContent = "This will generate a digital signature and approve the prescription for dispensing.";
        rejectInput.style.display = "none";
        
        confirmBtn.textContent = "Verify Prescription";
        confirmBtn.className = "btn-confirm"; 
        confirmBtn.onclick = executeVerify;
    } 
    // Configure Modal for REJECT
    else if (action === 'reject') {
        title.textContent = "Reject Prescription";
        desc.textContent = "Please provide a reason for rejecting this prescription.";
        rejectInput.style.display = "block";
        
        reasonBox.value = ""; // Clear previous text
        
        confirmBtn.textContent = "Reject Prescription";
        confirmBtn.className = "btn-confirm danger"; // Add danger class (Red)
        confirmBtn.onclick = executeReject; // Bind click to reject function
        
        // Focus on text box
        setTimeout(() => reasonBox.focus(), 100);
    }

    modal.style.display = "flex"; // Show the modal
}

function closeModal() {
    document.getElementById('actionModal').style.display = "none";
    currentId = null;
    currentAction = null;
}

// Close if clicked outside the white box
window.onclick = function(event) {
    const modal = document.getElementById('actionModal');
    if (event.target == modal) closeModal();
}

// --- Trigger Functions (Attached to Buttons) ---

function verifyOrder(id) {
    openModal('verify', id);
}

function rejectOrder(id) {
    openModal('reject', id);
}

// --- API Execution ---

async function executeVerify() {
    const btn = document.getElementById('confirmBtn');
    const originalText = btn.textContent;

    btn.textContent = "Signing...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/pharmacist/verify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prescription_id: currentId })
        });

        if (res.ok) {
            closeModal();
            showSuccessMessage("Prescription verified successfully!");

            // Reload the page to reflect the updated data from the server
            setTimeout(() => {
                window.location.reload();
            }, 500); // Small delay to show the success message briefly

        } else {
            const data = await res.json();
            alert("Error: " + (data.error || "Verification failed"));
        }
    } catch (e) {
        console.error(e);
        alert("Network Error. Check console.");
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function executeReject() {
    const reasonBox = document.getElementById('rejectReason');
    const reason = reasonBox.value.trim();
    
    if (!reason) {
        alert("Please enter a rejection reason.");
        reasonBox.focus();
        return;
    }

    const btn = document.getElementById('confirmBtn');
    const originalText = btn.textContent;
    btn.textContent = "Rejecting...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/pharmacist/reject', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prescription_id: currentId, reason: reason })
        });

        if (res.ok) {
            closeModal();
            showSuccessMessage("Prescription rejected successfully!");

            // Reload the page to reflect the updated status from the server
            setTimeout(() => {
                window.location.reload();
            }, 500); // Small delay to show the success message briefly
        } else {
            const data = await res.json();
            alert("Error: " + (data.error || "Rejection failed"));
        }
    } catch (e) {
        console.error(e);
        alert("Network Error. Check console.");
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- Helpers ---

function animateRemoval(id) {
    const card = document.getElementById(`card-${id}`);
    if (card) {
        // Add fade out styles via JS directly for simplicity
        card.style.transition = "all 0.5s ease";
        card.style.opacity = "0";
        card.style.transform = "translateX(50px)";

        // Remove from DOM after animation finishes
        setTimeout(() => {
            card.remove();
            checkEmpty();
        }, 500);
    }
}

function checkEmpty() {
    const grid = document.querySelector('.card-grid');
    if (grid && grid.children.length === 0) {
        const container = document.querySelector('.container');
        // Only add empty state if it doesn't exist yet
        if (!document.querySelector('.empty-state')) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = "No pending prescriptions. All caught up!";
            container.appendChild(empty);
        }
    }
}

function filterPrescriptions(status, event) {
    currentFilter = status;

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    renderFilteredPrescriptions();
}

function handleSearch() {
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('tab') || 'pending';
    
    if (activeTab === 'all') {
        searchHistory();
    } else {
        // For pending tab, we could implement real-time filtering if needed
        // For now, users can use the search button for server-side search
    }
}

function searchHistory() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    renderFilteredPrescriptions(searchTerm);
}

function renderFilteredPrescriptions(searchTerm = '') {
    const cardGrid = document.querySelector('.card-grid');
    let filteredPrescriptions = allPrescriptions;

    // Apply status filter
    if (currentFilter !== 'all') {
        filteredPrescriptions = filteredPrescriptions.filter(p => p.status.toLowerCase() === currentFilter);
    }

    // Apply search filter
    if (searchTerm) {
        filteredPrescriptions = filteredPrescriptions.filter(p =>
            p.prescCode.toLowerCase().includes(searchTerm) ||
            p.patientName.toLowerCase().includes(searchTerm) ||
            p.ICnumber.toLowerCase().includes(searchTerm)
        );
    }

    // Clear existing cards
    cardGrid.innerHTML = '';

    if (filteredPrescriptions.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No prescriptions found.';
        cardGrid.appendChild(emptyState);
        return;
    }

    // Render filtered prescriptions
    filteredPrescriptions.forEach(p => {
        const card = createPrescriptionCard(p);
        cardGrid.appendChild(card);
    });
}

function createPrescriptionCard(p) {
    const card = document.createElement('div');
    card.className = `presc-card ${p.status === 'Verified' ? 'verified-card' : p.status === 'Rejected' ? 'rejected-card' : p.status === 'Completed' ? 'completed-card' : ''}`;
    card.id = `card-${p.prescriptionID}`;

    card.innerHTML = `
        <div class="card-header">
            <span class="presc-id">${p.prescCode}</span>
            <span class="presc-status">${p.status}</span>
        </div>
        <div class="card-body">
            <p class="ic-num">IC: ${p.ICnumber}</p>
            <p class="patient-name">Name: ${p.patientName}</p>
            <p class="doctor-sig">Prescribed by: Dr. ${p.doctorName}</p>
            ${p.pharmacistName ? `<p class="pharmacist-sig">${p.status === 'Rejected' ? 'Rejected by:' : 'Verified by:'} ${p.pharmacistName}</p>` : ''}
            <hr>
            <div class="med-list-container">
                ${p.items.map(item => `
                    <div class="med-item">
                        <div class="med-header">
                            <span class="med-name">${item.name}</span>
                            <span class="med-strength">${item.strength} ${item.form}, ${item.packSize}</span>
                        </div>
                        <div class="med-indication">
                            <div>Indication: <strong>${item.indication}</strong></div>
                        </div>
                        <div class="med-details">
                            <div>Qty: <strong>${item.quantity}</strong></div>
                            <div>Supply: <strong>${item.supplyDays} Days</strong></div>
                        </div>
                        <div class="med-sig">
                            Sig: <em>${item.direction}</em>
                        </div>
                        ${!item.last ? '<div class="med-divider"></div>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="card-actions">
            ${p.status === 'Pending' ?
                `<button onclick="rejectOrder('${p.prescriptionID}')" class="btn-reject">Reject</button>
                 <button onclick="verifyOrder('${p.prescriptionID}')" class="btn-verify">Verify & Sign</button>` :
                p.status === 'Rejected' ?
                `<div class="rejected-info">
                    <strong>Rejected:</strong> ${p.rejectionReason || 'No reason provided'}
                </div>` :
                `<button class="btn-verified" disabled>Verified</button>`
            }
        </div>
    `;

    return card;
}

function showSuccessMessage(message) {
    // Remove any existing success messages
    const existingMessages = document.querySelectorAll('.floating-success-message');
    existingMessages.forEach(msg => msg.remove());

    // Create and show new success message in bottom right corner
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'floating-success-message';
    feedbackDiv.textContent = message;

    // Style the floating message
    feedbackDiv.style.position = 'fixed';
    feedbackDiv.style.bottom = '20px';
    feedbackDiv.style.right = '20px';
    feedbackDiv.style.backgroundColor = '#4caf50';
    feedbackDiv.style.color = 'white';
    feedbackDiv.style.padding = '12px 20px';
    feedbackDiv.style.borderRadius = '8px';
    feedbackDiv.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    feedbackDiv.style.zIndex = '9999';
    feedbackDiv.style.fontSize = '14px';
    feedbackDiv.style.fontWeight = '500';
    feedbackDiv.style.maxWidth = '300px';
    feedbackDiv.style.wordWrap = 'break-word';

    document.body.appendChild(feedbackDiv);

    // Auto-hide after 3 seconds with fade out
    setTimeout(() => {
        feedbackDiv.style.opacity = '0';
        feedbackDiv.style.transition = 'opacity 0.3s ease';
        setTimeout(() => feedbackDiv.remove(), 300);
    }, 3000);
}
