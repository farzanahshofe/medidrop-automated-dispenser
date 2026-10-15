// Password validation and strength checking
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('new_password');
    const confirmInput = document.getElementById('confirm_password');
    const submitBtn = document.getElementById('submitBtn');
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');

    // Password requirements elements
    const reqLen = document.getElementById('req-len');
    const reqCap = document.getElementById('req-cap');
    const reqLow = document.getElementById('req-low');
    const reqNum = document.getElementById('req-num');
    const reqSym = document.getElementById('req-sym');

    const form = document.getElementById('resetForm');

    // Password validation function
    function validatePassword(password) {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            symbol: /[!@#$%^&*().]/.test(password)
        };

        return requirements;
    }

    // Update password strength visual
    function updatePasswordStrength(password) {
        const requirements = validatePassword(password);
        const metCount = Object.values(requirements).filter(Boolean).length;

        // Update requirement indicators
        reqLen.className = requirements.length ? 'req-item met' : 'req-item';
        reqCap.className = requirements.uppercase ? 'req-item met' : 'req-item';
        reqLow.className = requirements.lowercase ? 'req-item met' : 'req-item';
        reqNum.className = requirements.number ? 'req-item met' : 'req-item';
        reqSym.className = requirements.symbol ? 'req-item met' : 'req-item';

        // Update strength bar and text
        let strength = 0;
        let strengthLabel = 'Very Weak';
        let color = '#dc3545'; // red

        if (metCount >= 1) {
            strength = 20;
            strengthLabel = 'Very Weak';
            color = '#dc3545';
        }
        if (metCount >= 2) {
            strength = 40;
            strengthLabel = 'Weak';
            color = '#fd7e14';
        }
        if (metCount >= 3) {
            strength = 60;
            strengthLabel = 'Fair';
            color = '#ffc107';
        }
        if (metCount >= 4) {
            strength = 80;
            strengthLabel = 'Good';
            color = '#20c997';
        }
        if (metCount >= 5) {
            strength = 100;
            strengthLabel = 'Strong';
            color = '#28a745';
        }

        strengthFill.style.width = strength + '%';
        strengthFill.style.backgroundColor = color;
        strengthText.textContent = strengthLabel;
        strengthText.style.color = color;
    }

    // Check password confirmation
    function checkPasswordMatch() {
        const password = passwordInput.value;
        const confirm = confirmInput.value;
        const matchStatus = document.getElementById('match-status');

        if (confirm.length > 0) {
            if (password === confirm) {
                matchStatus.textContent = 'Passwords match';
                matchStatus.style.color = '#28a745';
                matchStatus.style.display = 'block';
                return true;
            } else {
                matchStatus.textContent = 'Passwords do not match';
                matchStatus.style.color = '#dc3545';
                matchStatus.style.display = 'block';
                return false;
            }
        } else {
            matchStatus.style.display = 'none';
            return false;
        }
    }

    // Check if form is valid
    function checkFormValidity() {
        const password = passwordInput.value;
        const confirm = confirmInput.value;
        const requirements = validatePassword(password);

        const allRequirementsMet = Object.values(requirements).every(Boolean);
        const passwordsMatch = password === confirm && confirm.length > 0;

        // Don't disable button, let form submit and show errors
        submitBtn.disabled = false;
    }

    // Event listeners
    passwordInput.addEventListener('input', function() {
        updatePasswordStrength(this.value);
        checkPasswordMatch();
        checkFormValidity();
    });

    confirmInput.addEventListener('input', function() {
        checkPasswordMatch();
        checkFormValidity();
    });

    // Form submission
    console.log('Adding form submit event listener');
    document.getElementById('resetForm').addEventListener('submit', function(e) {
        console.log('Form submission triggered');
        const password = passwordInput.value;
        const confirm = confirmInput.value;
        const requirements = validatePassword(password);

        console.log('Password:', password);
        console.log('Confirm:', confirm);
        console.log('Requirements:', requirements);

        // Check if all requirements are met
        const allRequirementsMet = Object.values(requirements).every(Boolean);
        const passwordsMatch = password === confirm && confirm.length > 0;

        console.log('All requirements met:', allRequirementsMet);
        console.log('Passwords match:', passwordsMatch);

        if (!allRequirementsMet || !passwordsMatch) {
            console.log('Preventing form submission due to validation errors');
            e.preventDefault();

            // Create or update error banner
            let errorBanner = document.querySelector('.error-banner');
            console.log('Existing error banner:', errorBanner);
            if (!errorBanner) {
                console.log('Creating new error banner');
                errorBanner = document.createElement('div');
                errorBanner.className = 'error-banner';
                errorBanner.setAttribute('role', 'alert');
                const headerSection = document.querySelector('.header_section');
                console.log('Header section:', headerSection);
                if (headerSection) {
                    headerSection.insertAdjacentElement('afterend', errorBanner);
                    console.log('Error banner inserted after header section');
                } else {
                    console.log('Header section not found, inserting at top of form');
                    const form = document.getElementById('resetForm');
                    form.insertBefore(errorBanner, form.firstChild);
                }
            }

            let errorMessage = '';
            if (!allRequirementsMet && !passwordsMatch) {
                errorMessage = 'Password does not meet requirements and passwords do not match.';
            } else if (!allRequirementsMet) {
                errorMessage = 'Password does not meet all requirements.';
            } else if (!passwordsMatch) {
                errorMessage = 'Passwords do not match.';
            } errorMessage = 'Please fill in the fields.';


            console.log('Error message:', errorMessage);
            errorBanner.innerHTML = `
                <span class="error_icon">⚠️</span>
                <span class="error_text">${errorMessage}</span>
            `;
            console.log('Error banner HTML set');

            return false;
        }

        console.log('Form validation passed, proceeding with submission');
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Setting Password...';
    });


});

