// app.js - Automated Pharmacy Dispenser Web App
document.addEventListener('DOMContentLoaded', () => {
  // --- Element References ---
  const screens = {
    landing: document.getElementById('landing-screen'),
    facialRecognition: document.getElementById('facial-recognition-screen'),
    profile: document.getElementById('patient-profile-screen'),
    qrScanner: document.getElementById('qr-code-scanner-screen'),
    prescriptionDetails: document.getElementById('prescription-details-screen'),
    dispensing: document.getElementById('dispensing-screen'),
    collectMedicine: document.getElementById('collect-medicine-screen'),
    medicinePickedUp: document.getElementById('medicine-picked-up-screen'),
  };

  const continueToMedicationBtn = document.getElementById('continue-to-medication-btn');
  const qrInput = document.getElementById('qr-input');
  const qrStatus = document.getElementById('qr-status');
  const dispenseBtn = document.getElementById('dispense-btn');
  const pickedUpBtn = document.getElementById('picked-up-btn');
  const returnHomeBtn = document.getElementById('return-home-btn');
  const facialScanningStatus = document.getElementById('facial-scanning-status');
  const facialStatusText = document.getElementById('facial-status-text');
  const facialStatusSubcaption = document.getElementById('facial-status-subcaption');

  const qrScanningStatus = document.getElementById('qr-scanning-status');
  const qrStatusText = document.getElementById('qr-status-text');
  const qrStatusSubcaption = document.getElementById('qr-status-subcaption');
  const qrPlaceholderBox = document.querySelector('.qr-placeholder-box');

  const resetCountdownSpan = document.getElementById('reset-countdown');

  // --- State Variables ---
  let autoResetTimeout = null;
  let pickupCountdownInterval = null;
  let navHistory = [];
  let currentPatientData = null; // Holds data from facial scan
  let currentPrescriptionData = null; // Holds data from QR scan
  let html5QrScanner = null;

  // --- Core Functions ---

  /**
   * Shows a specific screen and hides all others.
   * @param {HTMLElement} screenToShow - The screen element to display.
   * @param {boolean} [isBack=false] - True if navigating back, to avoid pushing to history.
   */
  function showScreen(screenToShow, isBack = false) {
    if (!isBack) {
      const currentScreen = Object.values(screens).find(screen => screen.classList.contains('active'));
      if (currentScreen && currentScreen !== screenToShow) {
        navHistory.push(currentScreen);
      }
    }
    Object.values(screens).forEach(screen => {
      screen.classList.toggle('active', screen === screenToShow);
    });

    // Clear auto-reset timer whenever screen changes
    if (autoResetTimeout) {
      clearTimeout(autoResetTimeout);
      autoResetTimeout = null;
    }

    // Clear pickup countdown interval whenever screen changes
    if (pickupCountdownInterval) {
      clearInterval(pickupCountdownInterval);
      pickupCountdownInterval = null;
    }

    // Start countdown if showing medicine picked up screen
    if (screenToShow === screens.medicinePickedUp) {
      startPickupCountdown();
    }
  }

  /**
   * Resets the entire application to the landing screen.
   */
  function resetApp() {
    resetQRStatus();
    resetFacialStatus();
    showScreen(screens.landing);
    if (autoResetTimeout) {
      clearTimeout(autoResetTimeout);
      autoResetTimeout = null;
    }
  }

  // Date function
  function formatFriendlyDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return dateString;

    const options = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    };

    let formatted = new Intl.DateTimeFormat('en-GB', options).format(date);

    return formatted.toUpperCase();
  }

  // --- Status & Timer Functions ---

  function showFacialScanningStatus(text, subcaption = '') {
    facialStatusText.textContent = text;
    facialStatusSubcaption.textContent = subcaption;
    facialScanningStatus.style.display = 'block';
  }

  function hideFacialScanningStatus() {
    facialScanningStatus.style.display = 'none';
  }

  function showQRScanningStatus(text, subcaption = '') {
    qrStatusText.textContent = text;
    qrStatusSubcaption.textContent = subcaption;
    qrScanningStatus.style.display = 'block';
  }

  function hideQRScanningStatus() {
    qrScanningStatus.style.display = 'none';
  }

  function resetQRStatus() {
    hideQRScanningStatus();
    const button = document.getElementById('start-qr-scan-btn');
    const cameraPlaceholder = document.querySelector('#qr-code-scanner-screen .camera-placeholder');
    const qrReader = document.getElementById('qr-reader');
    const qrIcon = document.getElementById('qr-icon');
    const buttonText = button.querySelector('#qr-button-icon');
    const scanningOverlay = document.querySelector('#qr-code-scanner-screen .scanning-overlay');

    buttonText.textContent = 'Start Scan';
    button.classList.remove('scanning');
    cameraPlaceholder.classList.remove('scanning');
    if (qrReader) {
      qrReader.style.display = 'none';
    }
    qrIcon.style.display = 'block';
    if (scanningOverlay) {
      scanningOverlay.style.display = 'none';
    }
  }

function stopCameraStream(video) {
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

function resetFacialStatus() {
    hideFacialScanningStatus();
    const button = document.getElementById('start-facial-recognition-btn');
    const cameraPlaceholder = document.querySelector('#facial-recognition-screen .camera-placeholder');
    const cameraVideo = document.getElementById('facial-camera-video');
    const personIcon = document.getElementById('facial-person-icon');
    const buttonText = document.getElementById('facial-button-text');
    const scanningOverlay = document.querySelector('#facial-recognition-screen .scanning-overlay');

    buttonText.textContent = 'Start Scan';
    button.classList.remove('scanning');
    cameraPlaceholder.classList.remove('scanning');
    cameraVideo.style.display = 'none';

    // Stop camera stream on reset
    stopCameraStream(cameraVideo);

    personIcon.style.display = 'block';
    if (scanningOverlay) {
      scanningOverlay.style.display = 'none';
    }
  }

  function startAutoResetTimer() {
    if (autoResetTimeout) {
      clearTimeout(autoResetTimeout);
    }
    autoResetTimeout = setTimeout(resetApp, 30000); // 30-second timeout
  }

  function startPickupCountdown() {
    let countdown = 15;
    resetCountdownSpan.textContent = countdown;
    pickupCountdownInterval = setInterval(() => {
      countdown--;
      resetCountdownSpan.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(pickupCountdownInterval);
        pickupCountdownInterval = null;
        resetApp();
      }
    }, 1000);
  }


  // --- Event Listeners ---
  // **FIXED:** All event listeners are now at the top level, not inside other functions.

  // --- Screen Navigation Listeners ---

  screens.landing.addEventListener('click', async () => {
    // Log the landing page tap
    try {
      await fetch('/log_landing_tap', { method: 'POST' });
    } catch (error) {
      console.error('Failed to log landing tap:', error);
    }

    resetFacialStatus();
    showScreen(screens.facialRecognition);
  });

  // Back button on Facial Recognition screen
  document.getElementById('back-from-facial').addEventListener('click', () => {
    resetApp(); // Reset and go back to landing
  });

  continueToMedicationBtn.addEventListener('click', () => {
    console.log('Navigating to QR code scanner screen');
    showScreen(screens.qrScanner);
    resetQRStatus();
  });

  document.getElementById('back-from-qr').addEventListener('click', () => {
    showScreen(screens.profile, true); // Go back to profile
  });

  document.getElementById('back-from-profile').addEventListener('click', () => {
    showScreen(screens.facialRecognition, true); // Go back to facial recognition
    resetFacialStatus();
  });

  document.getElementById('back-from-prescription').addEventListener('click', () => {
    showScreen(screens.qrScanner, true); // Go back to QR scanner
    resetQRStatus();
  });

  returnHomeBtn.addEventListener('click', () => {
    resetApp();
  });

  // =================================
  // FACIAL RECOGNITION LOGIC
  // =================================

  // 1. Variables & Model Loading
  let livenessInterval = null;
  let isBlinkDetected = false;

  // load face-api models
  async function loadLivenessModels() {
    if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceLandmark68TinyNet.isLoaded) {
      console.log("Models already loaded");
      return;
    }
    const modelPath = '/static/public/models';
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath);
      console.log("Liveness detection models loaded");
    } catch (error) {
      console.error("Error loading liveness detection models:", error);
    }
  }
  loadLivenessModels();

  // Calculate Eye Aspect Ratio (EAR) to detect blinks
  function getEyeRatio(eye) {
    const dist1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const dist2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const distH = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (dist1 + dist2) / (2.0 * distH);
  }

  // 2. Function to populate patient profile screen
  function populateProfileScreen(patient) {
    currentPatientData = patient;
    document.getElementById('patient-name-display').textContent = patient.name;
    document.getElementById('patient-id-display').textContent = `Patient ID: ${patient.patientCode}`;
    document.getElementById('patient-ic-display').textContent = patient.ICnumber;
    document.getElementById('patient-phone-display').textContent = patient.phoneNumber;
    document.getElementById('patient-email-display').textContent = patient.email;

    // Logic for active prescription
    const activeCountEl = document.getElementById('patient-active-presc-display');
    const count = patient.activePrescriptions || 0;

    activeCountEl.textContent = count;

    if (count > 0) {
      // Active: green circle
      activeCountEl.classList.add('active-badge');
      activeCountEl.classList.remove('inactive-badge');
    } else {
      // None: no background
      activeCountEl.classList.add('inactive-badge');
      activeCountEl.classList.remove('active-badge');
    }

    const avatarImg = document.getElementById('kiosk-avatar-img');
    const initialDiv = document.getElementById('kiosk-avatar-initial');
    const initialText = document.getElementById('kiosk-initial-text');

    if (avatarImg && initialDiv && initialText) {
      avatarImg.style.display = 'block';
      initialDiv.style.display = 'none';

      const imageUrl = 'static/patient_images/${patient.patientCode}.JPG?t=${new Date().getTime()}';
      avatarImg.src = imageUrl;

      //Success
      avatarImg.onload = function() {
        avatarImg.style.display = 'block';
        initialDiv.style.display = 'none';
      };

      //Fail - show initial
      avatarImg.onerror = function () {
        console.log("Avatar image not found, showing initial instead.");
        avatarImg.style.display = 'none';
        initialDiv.style.display = 'flex';

        const name = patient.name || "User";
        const letter = name.charAt(0).toUpperCase();
        initialText.textContent = letter;

        const colors = ['#FF5722', '#673AB7', '#2196F3', '#009688', '#E91E63', '#FFC107'];
        const colorIndex = letter.charCodeAt(0) % colors.length;
        initialDiv.style.backgroundColor = colors[colorIndex];  
      };
    }
  }

  // 3. Liveness Logic
  async function startFacialRecognition() {
  const statusBox = screens.facialRecognition.querySelector('.status-box');
  const statusText = screens.facialRecognition.querySelector('.status-text');
  const statusSubcaption = screens.facialRecognition.querySelector('.status-subcaption');
  const scanningStatus = screens.facialRecognition.querySelector('.scanning-status');
  const video = document.getElementById('facial-camera-video');

    // Reset blink detection
    scanningStatus.style.display = 'block';
    statusBox.className = 'status-box scanning';
    statusText.textContent = 'Scanning...';
    statusSubcaption.textContent = 'Please look at the camera and blink';
    isBlinkDetected = false;

    // Start interval to check for blinks
    livenessInterval = setInterval(async () => {
      if (!video || video.paused || video.ended || isBlinkDetected) return;

      console.time("Face_Recog_Latency");
      // Detect faces and landmarks
      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true);
      console.timeEnd("Face_Recog_Latency");
      if (detection) {
        // Get eye landmarks
        const leftEye = detection.landmarks.getLeftEye();
        const rightEye = detection.landmarks.getRightEye();

        // Check if landmarks are present and have at least 6 points to avoid index errors
        if (!leftEye || leftEye.length < 6 || !rightEye || rightEye.length < 6) {
          console.warn("Landmark points missing or incomplete, skipping EAR calculation.");
          return;
        }

        // Calculate EAR for both eyes
        const leftEAR = getEyeRatio(leftEye);
        const rightEAR = getEyeRatio(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2.0;

        // Blink detection threshold
        if (avgEAR < 0.30) {
          console.log("Blink detected!");
          isBlinkDetected = true;
          clearInterval(livenessInterval);

          // Update UI to indicate success
          statusText.textContent = 'Blink Verified!';
          statusSubcaption.textContent = 'Capturing photo...';

          setTimeout(() => {
            captureAndVerify(video);
          }, 1000); // Wait 1s before capturing
        }
      }
    }, 200); // Check every 200ms
  }

  // 4. Capture frame and send to backend
  function captureAndVerify(video) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

    verifyFaceWithBackend(base64Image, video);
  }

  // Function to send captured face to the backend
async function verifyFaceWithBackend(base64Image, video) {
  const statusBox = screens.facialRecognition.querySelector('.status-box');
  const statusText = screens.facialRecognition.querySelector('.status-text');
  const facialStatusSubcaption = screens.facialRecognition.querySelector('.status-subcaption');

  statusText.textContent = 'Verifying Face...';
  facialStatusSubcaption.textContent = 'Please wait while we verify your identity';

  try {
    const response = await fetch(`/verify_face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });

    const result = await response.json();

    if (response.ok) {
      // 3. SUCCESS! -- Face verified
      statusBox.className = 'status-box success';
      statusText.textContent = 'Recognition Successful!';
      facialStatusSubcaption.textContent = `Loading your profile...`;

      //Stop camera stream
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
      
      setTimeout(() => {
        screens.facialRecognition.querySelector('.scanning-status').style.display = 'none';
        populateProfileScreen(result);
        showScreen(screens.profile);
      }, 2000);

    } else {
    // 4. ERROR! -- Face verification failed
    statusBox.className = 'status-box failed';
    statusText.textContent = 'Recognition Failed!';
    facialStatusSubcaption.textContent = 'Face not recognized. Please try again.';
    console.error("Face verification failed:", result.error);
    
    // Keep the scanning UI reset but visible
    const startBtn = document.getElementById('start-facial-recognition-btn');
    startBtn.classList.remove('scanning');
    const facialButtonText = document.getElementById('facial-button-text');
    if (facialButtonText) facialButtonText.textContent = 'Start Scan';
    const cameraVideo = document.getElementById('facial-camera-video');
    if (cameraVideo) {
      cameraVideo.style.display = 'none';
      stopCameraStream(cameraVideo);
    }
    const personIcon = document.getElementById('facial-person-icon');
    if (personIcon) personIcon.style.display = 'block';

    //Stop camera stream
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    }
  } catch (error) {
    // 5. NETWORK ERROR!
    console.error("Error verifying face:", error);
    statusBox.className = 'status-box failed';
    statusText.textContent = 'Error!';
    facialStatusSubcaption.textContent = 'Could not connect to the server.';

    setTimeout(() => {
    const startBtn = document.getElementById('start-facial-recognition-btn');
    const buttonText = document.getElementById('facial-button-text');
    const video = document.getElementById('facial-camera-video');
    const personIcon = document.getElementById('facial-person-icon');
    const scanIcon = screens.facialRecognition.querySelector('.scan-icon');
    

    startBtn.classList.remove('scanning');
    if (buttonText) buttonText.textContent = 'Start Scan';
    video.style.display = 'none';
    if (personIcon) personIcon.style.display = 'block';
    if (scanIcon) scanIcon.style.display = 'block';
    screens.facialRecognition.querySelector('.scanning-status').style.display = 'none';

    // stop camera stream
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    }, 3000);
  }
}

  // Call this function when the "Start Scan" button is clicked
  document.getElementById('start-facial-recognition-btn').addEventListener('click', async function() {
  const button = this;
  const cameraPlaceholder = screens.facialRecognition.querySelector('.camera-placeholder');
  const video = document.getElementById('facial-camera-video');
  const scanIcon = screens.facialRecognition.querySelector('.scan-icon');
  const buttonText = document.getElementById('facial-button-text');
  const personIcon = document.getElementById('facial-person-icon');

  buttonText.textContent = 'Scanning...';
  button.classList.add('scanning');
  cameraPlaceholder.classList.add('scanning');
  if (scanIcon) scanIcon.style.display = 'none';
  personIcon.style.display = 'none';
  video.style.display = 'block';

    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera not supported in this browser or context. Please ensure you're using a secure connection (HTTPS) and a compatible browser.");
      // Reset UI
      buttonText.textContent = 'Start Scan';
      button.classList.remove('scanning');
      cameraPlaceholder.classList.remove('scanning');
      if (scanIcon) scanIcon.style.display = 'block';
      personIcon.style.display = 'block';
      video.style.display = 'none';
      return;
    }

    try {
      // Ensure liveness models are loaded before starting
      await loadLivenessModels();

      // 1. Start the camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      video.srcObject = stream;
      video.play();

      startFacialRecognition();

    } catch (error) {
      alert("Camera error: " + error.message);
      // Reset UI on error
      buttonText.textContent = 'Start Scan';
      button.classList.remove('scanning');
      cameraPlaceholder.classList.remove('scanning');
      if (scanIcon) scanIcon.style.display = 'block';
      personIcon.style.display = 'block';
      video.style.display = 'none';
    }
  });

  // --- QR Code & Prescription ---

  /**
   * Helper function to verify the scanned QR string with the backend.
   * @param {string} qrString - The text decoded from the QR code.
   */
  async function verifyQRWithBackend(qrString) {
    const statusBox = screens.qrScanner.querySelector('.status-box');
    const statusText = screens.qrScanner.querySelector('.status-text');
    const qrStatusSubcaption = screens.qrScanner.querySelector('.status-subcaption');
    const qrScanningStatus = document.getElementById('qr-scanning-status');

    //1. Show "Verifying..." status
    qrScanningStatus.style.display = 'block';
    statusBox.className = 'status-box scanning';
    statusText.textContent = 'Verifying QR Code...';
    qrStatusSubcaption.textContent = 'Please wait while we verify your prescription';

    console.log("Current Patient Data:", currentPatientData);

    // Check if we have patient data from facial recognition
    if (!currentPatientData || !currentPatientData.patientID) {
      console.error("Error: Missing patient data. ID is null.");
      statusBox.className = 'status-box failed';
      statusText.textContent = 'Verification Failed!';
      qrStatusSubcaption.textContent = 'No patient data found. Please re-scan your face.';
      return;
    }

    try {
      console.log("Sending verification request...", {
        qr_string: qrString,
        patient_id: currentPatientData.patientID
      });

      console.time("QR_Code_Verification_Latency");
      // 2. Send QR string and patient ID to backend
      const response = await fetch('/verify_qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_string: qrString,
          patient_id: currentPatientData.patientID || currentPatientData.id,
        }),
      });
      console.timeEnd("QR_Code_Verification_Latency");

      const result = await response.json();

      if (response.ok && result.verified) {
        // 3. SUCCESS! -- QR verified
        statusBox.className = 'status-box success';
        statusText.textContent = 'Verification Successful!';
        qrStatusSubcaption.textContent = 'Loading your prescriptions...';

        currentPrescriptionData = result.prescription; // Save globally
        
        setTimeout(() => {
          qrScanningStatus.style.display = 'none';
          showScreen(screens.prescriptionDetails);
          populatePrescriptionDetails(currentPrescriptionData);
        }, 2000);
      } else {
        // 4. FAIL! -- QR verification failed
        console.error("QR verification failed:", result.error);
        statusBox.className = 'status-box failed';
        statusText.textContent = 'QR Scan Failed!';

        // Display specific error messages based on prescription status
        let errorMessage = 'This prescription is not valid.';
        if (result.error === 'Prescription not yet verified by Pharmacist.') {
          errorMessage = 'This prescription has not been verified by pharmacist.';
        } else if (result.error === 'Prescription has been rejected by Pharmacist.') {
          errorMessage = 'This prescription has been rejected by pharmacist.';
        } else if (result.error === 'Prescription fully collected.') {
          errorMessage = 'This prescription has been completed.';
        } else if (result.error === 'No items available for collection today.') {
          // For Active prescriptions that are not yet due, show next pickup date
          if (result.nextPickupDate) {
            errorMessage = `This prescription is not valid. The next pick up date is ${result.nextPickupDate}.`;
          } else {
            errorMessage = 'This prescription is not valid. No items available for collection today.';
          }
        }

        qrStatusSubcaption.textContent = errorMessage;

        // Reset the button immediately to allow retry
        const startBtn = document.getElementById('start-qr-scan-btn');
        const buttonText = document.getElementById('qr-button-icon');
        buttonText.textContent = 'Start Scan';
        startBtn.classList.remove('scanning');

        // Stop the scanner if still running
        if (html5QrScanner) {
          html5QrScanner.stop().catch(err => console.warn("Scanner stop failed", err));
          html5QrScanner = null;
        }

        // Hide the status after 4 seconds
        setTimeout(() => {
          qrScanningStatus.style.display = 'none';
        }, 4000);
      }
    } catch (error) {
      // 5. NETWORK ERROR!
      console.error("Error verifying QR:", error);
      statusBox.className = 'status-box failed';
      statusText.textContent = 'Error!';
      qrStatusSubcaption.textContent = 'Could not connect to the server.';

      // Reset the button immediately to allow retry
      const startBtn = document.getElementById('start-qr-scan-btn');
      const buttonText = document.getElementById('qr-button-icon');
      buttonText.textContent = 'Start Scan';
      startBtn.classList.remove('scanning');

      // Stop the scanner if still running
      if (html5QrScanner) {
        html5QrScanner.stop().catch(err => console.warn("Scanner stop failed", err));
        html5QrScanner = null;
      }

      // Hide the status after 4 seconds
      setTimeout(() => {
        qrScanningStatus.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Updates the prescription details screen.
   * @param {object} prescription - The prescription data from the backend.
   */
  function populatePrescriptionDetails(prescriptionData) {
    const prescIdEl = document.getElementById('presc-id');
    if (prescIdEl) prescIdEl.textContent = `ID: ${prescriptionData.prescCode}`;

    const dataEl = document.getElementById('presc-prescribed-date');
    if (dataEl) dataEl.textContent = formatFriendlyDate(prescriptionData.prescribedDate);

    const doctorEl = document.getElementById('presc-doctor');
    if (doctorEl) doctorEl.textContent = prescriptionData.doctorName;

    const pharmacistEl = document.getElementById('presc-pharmacist');
    if (pharmacistEl) pharmacistEl.textContent = prescriptionData.pharmacistName || 'Not Verified';

    const container = document.getElementById('medication-container');
    if (container) {
      container.innerHTML = ''; // Clear previous items

      prescriptionData.medications.forEach(med => {
        const card = document.createElement('div');
        card.className = 'medication-card';

        card.innerHTML = `
          <div class="med-header">
            <h3 class="medication-title">${med.medicineName}</h3>
          </div>
          <div class="medication-details">
            <span class="med-detail-label">Indication:</span>
            <span class="med-detail-value">${med.indication}</span>

            <span class="med-detail-label">Quantity:</span>
            <span class="med-detail-value">${med.quantity}</span>

            <span class="med-detail-label">Generic Name:</span>
            <span class="med-detail-value">${med.genericName}</span>

            <span class="med-detail-label">Strength & Form:</span>
            <span class="med-detail-value">${med.strengthForm}, ${med.packSize}</span>

            <span class="med-detail-label">Directions:</span>
            <span class="med-detail-value">${med.direction}</span>

            <span class="med-detail-label">Refills:</span>
            <span class="med-detail-value">${med.refills}</span>
          </div>
        `;
        container.appendChild(card);
      });
    }
  }

  // Function is called when the scanner successfully read a code.
  function onQrScanSuccess(decodedText, decodedResult){
    console.log(`QR Code scanned successfully: ${decodedText}`, decodedResult);

    //Stop the scanner
    if (html5QrScanner) {
      html5QrScanner.stop().catch(err => console.warn("Scanner stop failed", err));
      html5QrScanner = null;
    }

    //Hide the viewfinder
    document.getElementById('qr-reader').style.display = 'none';

    //Send the text to backend
    verifyQRWithBackend(decodedText);
  }

  // Call this function when "Start Scan" button is clicked
  document.getElementById('start-qr-scan-btn').addEventListener('click', () => {
    console.log("Start QR scan button clicked");

    const qrIcon = document.getElementById('qr-icon');
    const buttonText = document.getElementById('qr-button-icon');
    const scanningStatus = screens.qrScanner.querySelector('.scanning-status');
    const qrReader = document.getElementById('qr-reader');
    const overlay = document.getElementById("qr-overlay");
    const placeholder = screens.qrScanner.querySelector('.camera-placeholder');

    const statusBox = screens.qrScanner.querySelector('.status-box');
    const statusText = screens.qrScanner.querySelector('.status-text');
    const statusSubcaption = screens.qrScanner.querySelector('.status-subcaption');

    //Update UI
    qrIcon.style.display = 'none';
    qrReader.style.display = 'block';
    overlay.style.display = 'block';
    placeholder.classList.add('scanning');

    scanningStatus.style.display = 'block';
    statusBox.className = 'status-box scanning';
    statusText.textContent = 'Scanning...';
    statusSubcaption.textContent = 'Position the QR code within the frame';

    buttonText.textContent = 'Scanning...';
    document.getElementById('start-qr-scan-btn').classList.add('scanning');

    console.log("Initializing QR scanner...");

    //Initialize the scanner
    html5QrScanner = new Html5Qrcode("qr-reader");

    const config = { 
      fps:10, 
      qrbox: function(viewfinderWidth, viewfinderHeight) {
        let minEdgePercentage = 0.8;
        let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
        let qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
        return {width: qrboxSize, height: qrboxSize
        };
    }};

    console.log("Starting QR scanner with config:", config);

    //Start the camera
    html5QrScanner.start({facingMode: "user"}, config, onQrScanSuccess)
    .then(() => {
      console.log("QR scanner started successfully");
    })
    .catch(err => {
      console.error("Unable to start QR scanner", err);
      // Handle camera permission errors
      const statusBox = screens.qrScanner.querySelector('.status-box');
      const qrStatusText = screens.qrScanner.querySelector('.status-text');
      const qrStatusSubcaption = screens.qrScanner.querySelector('.status-subcaption');

      if (statusBox) statusBox.className = 'status-box failed';
      if (qrStatusText) qrStatusText.textContent = 'Camera Error';
      if (qrStatusSubcaption) qrStatusSubcaption.textContent = 'Could not access camera.';

      buttonText.textContent = 'Start Scan';
      document.getElementById('start-qr-scan-btn').classList.remove('scanning');
    });
  });

  // reset QR UI elements
  function resetQrUI() {
    const qrIcon = document.getElementById('qr-icon');
    const buttonText = document.getElementById('qr-button-icon');
    const scanningStatus = screens.qrScanner.querySelector('.scanning-status');
    const qrReader = document.getElementById('qr-reader');
    const overlay = document.getElementById('qr-overlay');
    const placeholder = screens.qrScanner.querySelector('.camera-placeholder');
    const startBtn = document.getElementById('start-qr-scan-btn');

    if (html5QrScanner) {
      html5QrScanner.stop().then(() => {
        console.log("Scanner stopped.");
        html5QrScanner.clear();
      }).catch(err => {
        console.warn("Failed to stop scanner: ", err);
      });
    }

    if (qrIcon) qrIcon.style.display = 'block';
    if (qrReader) qrReader.style.display = 'none';
    if (overlay) overlay.style.display = 'none';

    if (placeholder) placeholder.classList.remove('scanning');
    if (buttonText) buttonText.textContent = 'Start Scan';
    if (startBtn) startBtn.classList.remove = 'scanning';
  }

  // --- Dispensing Logic ---
  dispenseBtn.addEventListener('click', async () => {
    // Check if we have prescription data from the QR scan
    if (!currentPrescriptionData || !currentPrescriptionData.medications) {
      alert("Error: No prescription data found. Please re-scan your QR code.");
      showScreen(screens.qrScanner, true);
      return;
    }

    showScreen(screens.dispensing);
    const dispensingMessageEl = document.querySelector('#dispensing-screen p');

    dispensingMessageEl.innerHTML = `Preparing to dispense...<br><strong>Dispensing Medicines...</strong>`;
    console.log("Starting medicine dispensing...");

    try {
      // First dispense the items
      const meds = currentPrescriptionData.medications;

      for (let i = 0; i < meds.length; i++) {
        const item = meds[i];

        dispensingMessageEl.innerHTML = `
          Dispensing Item ${i + 1} of ${meds.length}:<br>
          <strong>${item.medicineName}</strong><br>
          <span style="font-size:0.8em">(${item.strengthForm})</span>
        `;

        console.log(`Processing Item ${item.itemID}...`);

        try {
          const response = await fetch('/dispense_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: item.itemID }),
          });

          if (!response.ok) throw new Error("Database Update Failed")

          await new Promise(r => setTimeout(r, 3000)); // Simulate dispensing delay

        } catch (error) {
          console.error(`Error dispensing item ${item.itemID}:`, error);
          dispensingMessageEl.textContent = `Error dispensing ${item.medicineName}. Please contact staff.`;
          return;
        }
      }

      // Now open the drawer after dispensing
      console.log("Sending Open Drawer command...");

      console.time("Drawer_Actuation_Open_Latency");
      const openResponse = await fetch('/open_drawer', { method: 'POST'});
      const data = await openResponse.json();
      console.timeEnd("Drawer_Actuation_Open_Latency");

      if (!openResponse.ok || !data.success) {
        throw new Error(data.error || "Failed to open drawer");
      }

      console.log("Drawer opened successfully.");

      // await new Promise(r => setTimeout(r, 3000));
      showScreen(screens.collectMedicine);

      console.log('Starting sensor poll...');

      const pollInterval = setInterval(async () => {
        try {
          console.time("User_Retrieval_Physical_Latency");
          const res = await fetch('/check_pickup');
          const data = await res.json();
          console.timeEnd("User_Retrieval_Physical_Latency");

          console.log('Sensor Status:', data);

          if (data.picked_up === true) {
            clearInterval(pollInterval);
            console.log('Sensor detected: Medicine picked up. Closing transaction.');
            console.time("Drawer_Closing_Latency");
            // Assuming drawer closes when transaction completes
            console.timeEnd("Drawer_Closing_Latency");
            showScreen(screens.medicinePickedUp);
            startAutoResetTimer(15);
          }
        } catch (err) {
          console.error('Error polling sensor status:', err);
        }
      }, 1000); // Poll every 1 seconds

    } catch (error) {
      alert("Failed to open drawer. Please contact staff.");
      // Clear prescription data to allow re-scanning
      currentPrescriptionData = null;
      resetApp(); // Reset to landing screen on failure
    }
  });

  // --- Initialize App ---
  resetApp();
});