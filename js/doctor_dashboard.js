let prescriptionItems = [];

// 1. Search Patient
async function searchPatient() {
    const ic = document.getElementById('patientIC').value.trim();
    const status = document.getElementById('searchStatus');
    const fieldset = document.getElementById('prescFieldset');

    if (!ic) {
        status.textContent = "Please enter an IC number.";
        status.className = "status-text error";
        return;
    }

    status.textContent = "Searching...";
    status.className = "status-text";

    // Reset form state
    fieldset.disabled = true;
    resetPatientHeader();

    try {
        const response = await fetch(`/search_patient?ic=${ic}`);
        const result = await response.json();

        if (response.ok) {
            status.textContent = "Patient Found";
            status.className = "status-text";
            enableForm(result);
        } else {
            status.textContent = "Patient not found. Kindly ask the patient to register first.";
            status.className = "status-text error";
        }
    } catch (err) {
        status.textContent = "System Error";
        console.error("Error searching patient:", err);
    }
}

function enableForm(patient) {
    const fieldset = document.getElementById('prescFieldset');

    // Fill patient details
    document.getElementById('pName').textContent = patient.name;
    document.getElementById('pIC').textContent = `IC: ${patient.ICnumber}`;
    document.getElementById('pID').value = patient.patientID;

    // Avatar Initial & Color
    const initial = patient.name.charAt(0).toUpperCase();
    const avatar = document.getElementById('pAvatar');
    avatar.textContent = initial;

    // Generate color based on initial
    const colors = ['#FF5722', '#673AB7', '#2196F3', '#009688', '#E91E63', '#FFC107'];
    const colorIndex = initial.charCodeAt(0) % colors.length;
    avatar.style.backgroundColor = colors[colorIndex];

    // Unlock form
    fieldset.disabled = false;
}

function resetPatientHeader() {
    document.getElementById('pName').textContent = "No Patient Selected";
    document.getElementById('pIC').textContent = "Please search for a patient to proceed.";
    document.getElementById('pID').value = "";
    document.getElementById('pAvatar').textContent = "?";
    document.getElementById('pAvatar').style.backgroundColor = "#CCC";
}

// 2. Add Medicine to List
function addMedicineToList() {
    const medSelect = document.getElementById('medID');
    const medId = medSelect.value;
    const medName = medSelect.options[medSelect.selectedIndex].text;
    const indication = document.getElementById('indication').value;
    const quantity = document.getElementById('quantity').value;
    const supplyDays = document.getElementById('supplyDays').value;
    const direction = document.getElementById('direction').value;
    const refills = document.getElementById('refills').value;

    // Validation
    if (!medId || !direction) {
        showFeedback("Please fill in all required fields.");
        return;
    }

    // Add to array
    prescriptionItems.push({
        medicine_id: medId,
        medicine_name: medName,
        indication: indication,
        quantity: quantity,
        supply_days: supplyDays,
        direction: direction,
        refills: refills
    });

    renderList();

    document.getElementById('indication').value = "";
    document.getElementById('direction').value = "";
    document.getElementById('quantity').value = "";
    document.getElementById('supplyDays').value = "";
    document.getElementById('refills').value = "0";
    medSelect.value = "";
    document.getElementById('submitStatus').style.display = 'none';
}

function removeItem(index) {
    prescriptionItems.splice(index, 1);
    renderList();
}

function renderList() {
    const listContainer = document.getElementById('medList');
    const emptyMsg = document.getElementById('emptyListMsg');

    // Clear existing list
    listContainer.innerHTML = '';
    listContainer.appendChild(emptyMsg);

    if (prescriptionItems.length === 0) {
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';

    // Build rows
    prescriptionItems.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'med-item-row';
        row.style.borderBottom = '1px solid #eee';
        row.style.padding = '10px';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        row.innerHTML = `
            <div>
                <strong style="color: var(--primary-color);">${item.medicine_name}</strong>
                <div style="font-size: 12px; color: #666;">
                    ${item.direction} | Qty: ${item.quantity} | Refills: ${item.refills}
                </div>
            </div>
            <button onclick="removeItem(${index})" style="background: none; border: none; color: #dc3545; font-weight: bold; font-size: 16px; cursor: pointer;">×</button>
        `;
        listContainer.appendChild(row);
    });
}

// 3. Form Submission
async function submitPrescription() {
    const btn = document.querySelector('.submit-btn');
    const originalText = btn.textContent;

    // Validation
    if (prescriptionItems.length === 0) {
        showFeedback("Please add at least one medicine to the prescription.");
        return;
    }

    btn.textContent = "Submitting...";
    btn.disabled = true;

    // Generate placeholder QR
    const tempQR = "PENDING_VERIFICATION_" + Date.now();

    const data = {
        patient_id: document.getElementById('pID').value,
        doctor_id: CURRENT_DOCTOR_ID,
        items: prescriptionItems,
        qr_string: tempQR
    };

    try {
        const response = await fetch('/add_prescription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showFeedback("Prescription submitted successfully.");
            setTimeout(() => {
                window.location.href = '/doctor/dashboard';
            }, 2000);
        } else {
            const res = await response.json();
            showFeedback("Error: " + res.error, "error");
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        showFeedback("Network Error", "error");
        console.error("Error submitting prescription:", err);
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Feedback display
function showFeedback(message, type) {
    const statusDiv = document.getElementById('submitStatus');
    statusDiv.textContent = message;
    statusDiv.className = `submission-feedback ${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
        statusDiv.style.opacity = '1';
    }, 10);
}

// Tab switching functionality
function switchTab(tabName) {
    console.log('switchTab called with:', tabName);

    // Hide all tabs
    document.getElementById('createTab').classList.remove('active');
    document.getElementById('historyTab').classList.remove('active');

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected tab and activate button
    if (tabName === 'create') {
        document.getElementById('createTab').classList.add('active');
        document.querySelector('.tabs button:first-child').classList.add('active');
        console.log('Create tab activated');
    } else if (tabName === 'history') {
        document.getElementById('historyTab').classList.add('active');
        document.querySelector('.tabs button:last-child').classList.add('active');
        console.log('History tab activated');
        loadHistory();
    }
}

// History functionality
let allPrescriptions = [];
let currentFilter = 'all';

async function loadHistory() {
    console.log('loadHistory called');
    const tableBody = document.getElementById('historyTableBody');
    console.log('tableBody element:', tableBody);

    tableBody.innerHTML = '<tr><td colspan="6" class="loading">Loading prescription history...</td></tr>';

    try {
        console.log('Fetching /doctor_prescriptions...');
        const response = await fetch('/doctor_prescriptions');
        console.log('Response status:', response.status);
        const prescriptions = await response.json();
        console.log('Prescriptions received:', prescriptions);

        if (response.ok) {
            allPrescriptions = prescriptions;
            renderHistoryTable();
            console.log('History table rendered');
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" class="no-data">Failed to load prescription history.</td></tr>';
        }
    } catch (error) {
        console.error('Error loading history:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading prescription history.</td></tr>';
    }
}



function filterPrescriptions(status, event) {
    currentFilter = status;

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    renderHistoryTable();
}

function searchHistory() {
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    renderHistoryTable(searchTerm);
}

function renderHistoryTable(searchTerm = '') {
    const tableBody = document.getElementById('historyTableBody');
    let filteredPrescriptions = allPrescriptions;

    // Apply status filter
    if (currentFilter !== 'all') {
        filteredPrescriptions = filteredPrescriptions.filter(p => p.status.toLowerCase() === currentFilter);
    }

    // Apply search filter
    if (searchTerm) {
        filteredPrescriptions = filteredPrescriptions.filter(p =>
            p.prescCode.toLowerCase().includes(searchTerm) ||
            p.patientIC.toLowerCase().includes(searchTerm) ||
            p.patientName.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredPrescriptions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="no-data">No prescriptions found.</td></tr>';
        return;
    }

    const rows = filteredPrescriptions.map(prescription => {
        const statusClass = `status-${prescription.status.toLowerCase()}`;
        const rowClass = prescription.status === 'Rejected' ? 'rejected-row' : '';

        const medicinesHtml = prescription.items.map(item =>
            `<div class="medicine-item">${item.medicineName} (${item.strengthForm}, ${item.packSize}) - Qty: ${item.quantity}</div>`
        ).join('');

        const pharmacistInfo = prescription.pharmacistName ?
            (prescription.status === 'Rejected' ? `${prescription.pharmacistName}` : `${prescription.pharmacistName}`) :
            'Not processed';

        return `
            <tr class="${rowClass}">
                <td>${prescription.prescCode}</td>
                <td>${prescription.patientName}<br><small style="color: #666;">IC: ${prescription.patientIC}</small></td>
                <td><span class="status-badge ${statusClass}">${prescription.status}</span></td>
                <td>${prescription.createdAt}</td>
                <td><small style="color: #666;">${pharmacistInfo}</small></td>
                <td><div class="medicine-list">${medicinesHtml}</div></td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set default tab to create
    switchTab('create');
});
