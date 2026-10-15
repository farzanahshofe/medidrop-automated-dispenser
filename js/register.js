document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const snapBtn = document.getElementById('snapBtn');
    const hiddenInput = document.getElementById('face_image_base64');
    const registerForm = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');
    const statusText = document.getElementById('statusText');
    const camStatus = document.getElementById('camStatus');
    const faceGuide = document.getElementById('face-guide');
    const retakeBtn = document.getElementById('retakeBtn');
    const passwordInput = document.getElementById('reg-pass');
    const confirmInput = document.getElementById('confirm_password');
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    const nextBtn = document.getElementById('nextBtn');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const backBtn = document.getElementById('topBackBtn');

    let streamObj = null;
    let livenessInterval = null;
    let isCaptured = false;
    let isPassValid = false;

    backBtn.style.display = 'none';

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

    // Email validation function
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Update password strength visual
    function updatePasswordStrength(password) {
        const requirements = validatePassword(password);
        const metCount = Object.values(requirements).filter(Boolean).length;

        // Update requirement indicators
        document.getElementById('req-len').className = requirements.length ? 'req-item met' : 'req-item';
        document.getElementById('req-cap').className = requirements.uppercase ? 'req-item met' : 'req-item';
        document.getElementById('req-low').className = requirements.lowercase ? 'req-item met' : 'req-item';
        document.getElementById('req-num').className = requirements.number ? 'req-item met' : 'req-item';
        document.getElementById('req-sym').className = requirements.symbol ? 'req-item met' : 'req-item';

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


    // 1. Password Strength Logic
    passwordInput.addEventListener('input', () => {
        updatePasswordStrength(passwordInput.value);
        checkPasswordMatch();
        const requirements = validatePassword(passwordInput.value);
        isPassValid = Object.values(requirements).every(Boolean);
    });

    confirmInput.addEventListener('input', () => {
        checkPasswordMatch();
    });

    // Form validation for all fields
    const formInputs = document.querySelectorAll('#registerForm input[required]');
    formInputs.forEach(input => {
        input.addEventListener('input', checkNextReady);
    });

    // Initial check
    checkNextReady();

    // Next Button Logic
    nextBtn.addEventListener('click', async () => {
        statusMessage.style.display = 'none';

        const name = document.getElementById('reg-name').value.trim();
        const ic = document.getElementById('reg-ic').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-pass').value;
        const confirmPassword = document.getElementById('confirm_password').value;

        const reqs = {
            len: password.length >= 8,
            num: /[0-9]/.test(password),
            cap: /[A-Z]/.test(password),
            sym: /[.@$!%*?&]/.test(password)
        };

        const isPassValid = reqs.len && reqs.num && reqs.cap && reqs.sym;

        // Basic field validation
        if (!name || !ic || !phone || !email) {
            showStatus("Please fill in all fields", "error");
            return;
        }

        // Email validation
        if (!validateEmail(email)) {
            showStatus("Please enter a valid email address (e.g., user@example.com)", "error");
            return;
        }

        // Phone number validation (only numbers)
        if (!/^\d+$/.test(phone)) {
            showStatus("Phone number must contain only numbers", "error");
            return;
        }

        // Password validation - show status message
        if (!isPassValid) {
            showStatus("Password does not meet requirements. Please ensure it has: At least 8 characters, 1 uppercase letter (A-Z), 1 lowercase letter (a-z), 1 number (0-9), 1 symbol (.!@#$%^&*)", "error");
            return;
        }

        // Confirm password validation - show status message
        if (password !== confirmPassword) {
            showStatus("Confirm password does not match the registration password. Please make sure both passwords are identical.", "error");
            return;
        }

        // Check for duplicate IC
        try {
            const icResponse = await fetch('/api/check_ic', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ic: ic})
            });
            const icResult = await icResponse.json();

            if (icResult.exists) {
                showStatus(icResult.message, "error");
                return;
            }
        } catch (error) {
            showStatus("Error checking IC number", "error");
            return;
        }

        // Check for duplicate email
        try {
            const emailResponse = await fetch('/api/check_email', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: email})
            });
            const emailResult = await emailResponse.json();

            if (emailResult.exists) {
                showStatus(emailResult.message, "error");
                return;
            }
        } catch (error) {
            showStatus("Error checking email", "error");
            return;
        }

        // All validations passed, proceed to next step
        step1.style.display = 'none';
        step2.style.display = 'block';
        backBtn.style.display = 'block';
        startCameraSystem();
    });

    // Back Button Logic
    backBtn.addEventListener('click', () => {
        if (step2.style.display !== 'none') {
            step1.style.display = 'block';
            step2.style.display = 'none';
            backBtn.style.display = 'none';
            // Stop camera when going back
            if (streamObj) {
                streamObj.getTracks().forEach(track => track.stop());
                streamObj = null;
            }
        } else {
            window.location.href = "/login";
        }
    });

    function updateReq(id, isValid) {
        const el = document.getElementById(id);
        if (isValid) el.classList.add('valid');
        else el.classList.remove('valid');
    }

    function showStatus(msg, type) {
        statusMessage.style.display = 'flex';
        statusText.textContent = msg;
        if (type === "error") {
            statusMessage.style.color = '#ba1a1a';
            statusMessage.style.backgroundColor = '#ffdad6';

            if (!statusMessage.querySelector('.error-icon')) {
                const errorIcon = document.createElement('span');
                errorIcon.classList.add('error-icon');
                errorIcon.innerHTML = '⚠️';
                statusMessage.insertBefore(errorIcon, statusText);
            }
        } else {
            statusMessage.style.color = '#3c763d';
            statusMessage.style.backgroundColor = '#dff0d8';
        }
    }

    function checkNextReady() {
        // Removed disabled logic to allow click and show message
    }

    // 2. Start camera logic
    async function startCameraSystem() {
        camStatus.textContent = "Loading AI Models...";
        try {
            const modelPath = '/static/public/models';
            await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath);

            camStatus.textContent = "Starting Camera...";
            startVideo();
        } catch (e) {
            camStatus.textContent = "Error loading AI";
            console.error(e);
        }
    }

    async function startVideo() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user'}
            });
            video.srcObject = stream;
            streamObj = stream;
            video.onloadedmetadata = () => {
                camStatus.textContent = "Position face & Blink";
                startLivenessCheck();
            }
        } catch (err) {
            showStatus("Camera Denied");
        }
    }

    // 3. Liveness Check (Blink to Capture)
     function getEyeRatio(eye) {
        const dist1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
        const dist2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
        const distH = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
        return (dist1 + dist2) / (2.0 * distH);
    }

    function isFaceInOval(detection) {
        const box = detection.detection.box;
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Oval is approximately centered, 200px wide, 280px high in 400px height container
        // So roughly 50% width, 70% height
        const ovalLeft = videoWidth * 0.25;
        const ovalRight = videoWidth * 0.75;
        const ovalTop = videoHeight * 0.15;
        const ovalBottom = videoHeight * 0.85;

        return faceCenterX >= ovalLeft && faceCenterX <= ovalRight &&
               faceCenterY >= ovalTop && faceCenterY <= ovalBottom;
    }

    function startLivenessCheck() {
        livenessInterval = setInterval(async () => {
            if (isCaptured || video.paused || video.ended) return;

            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true);

            if (detection) {
                const leftEye = detection.landmarks.getLeftEye();
                const rightEye = detection.landmarks.getRightEye();
                const avgRatio = (getEyeRatio(leftEye) + getEyeRatio(rightEye)) / 2;

                if (avgRatio < 0.30 && isFaceInOval(detection)) {
                    capturePhoto();
                }
            }
        }, 200);
    }

    // 4. Capture Logic
    function capturePhoto() {
        if (isCaptured) return;
        isCaptured = true;
        clearInterval(livenessInterval);

        faceGuide.classList.add('success');
        camStatus.textContent = "Captured!";

        //wait 2.0s, then freeze frame
        setTimeout(() => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            //mirror
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);
            hiddenInput.value = imageBase64;

            video.style.display = 'none';
            canvas.style.display = 'block';
            faceGuide.style.display = 'none';
            retakeBtn.style.display = 'inline-block';

            checkSubmitReady();
        }, 2000)
    }

    // 5. Retake Logic
    retakeBtn.addEventListener('click', () => {
        isCaptured = false;
        hiddenInput.value = "";

        video.style.display = 'block';
        canvas.style.display = 'none';
        faceGuide.style.display = 'flex';
        faceGuide.classList.remove('success');
        retakeBtn.style.display = 'none';
        camStatus.textContent = "Starting Camera...";

        // Restart camera
        startVideo();
    })

    // 6. Final Validation & Submit
    function checkSubmitReady(reqs) {
        if (!reqs) {
            const val = passwordInput.value;
            reqs = {
                len: val.length >= 8,
                num: /[0-9]/.test(val),
                cap: /[A-Z]/.test(val),
                sym: /[.@$!%*?&]/.test(val)
            };
        }

        const isPassValid = reqs.len && reqs.num && reqs.cap && reqs.sym;
        const isPhotoTaken = hiddenInput.value !== "";

        submitBtn.disabled = !(isPassValid && isPhotoTaken);
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.classList.add('loading');

        const formData = {
            name: document.getElementById('reg-name').value,
            ic: document.getElementById('reg-ic').value,
            phone: document.getElementById('reg-phone').value,
            email: document.getElementById('reg-email').value,
            password: document.getElementById('reg-pass').value,
            image: hiddenInput.value
        };

        try {
            const res = await fetch('api/register_patient', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(formData)
            });
            const result = await res.json();

            if (res.ok) {
                window.location.href = "/login";
            } else {
                showStatus(result.error, "error");
                submitBtn.classList.remove('loading');
            }
        } catch (err) {
            showStatus("Network Error", "error");
            submitBtn.classList.remove('loading');
        }
    });
});
