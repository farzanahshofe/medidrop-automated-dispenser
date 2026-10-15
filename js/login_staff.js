function setStaffRole(role) {
    const roleContainer = document.getElementById('roleSelector');
    if (!roleContainer) return;

    const hiddenInput = document.getElementById('staff_role');
    const label = document.getElementById('id-label');
    const input = document.getElementById('username');

    hiddenInput.value = role;

    if (role === 'Doctor') {
        document.getElementById('btn-doctor').classList.add('active');
        document.getElementById('btn-pharmacist').classList.remove('active');
        roleContainer.classList.remove('staff-active');

        label.textContent = 'Doctor ID';
        input.placeholder = 'e.g. DR0001';
    } else {
        document.getElementById('btn-pharmacist').classList.add('active');
        document.getElementById('btn-doctor').classList.remove('active');
        roleContainer.classList.add('staff-active');

        label.textContent = 'Pharmacist ID';
        input.placeholder = 'e.g. PHARM0001';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const btn = document.getElementById('loginBtn');

    // Initialize role toggle based on preselected_role
    const staffRoleElement = document.getElementById('staff_role');
    const preselectedRole = staffRoleElement ? staffRoleElement.value : null;
    if (preselectedRole) {
        setStaffRole(preselectedRole);
    }

    if (loginForm && btn) {
        btn.addEventListener('submit', function(event) {
            btn.classList.add('loading');
            setTimeout(() => { btn.disabled = true; }, 0);
        });
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted && btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    });
});
