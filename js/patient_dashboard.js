document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('qrModal');
    const qrContainer = document.getElementById('qrcode');
    const modalTitle = document.getElementById('modalTitle');
    const closeBtn = document.getElementById('closeModalBtn');
    const qrButtons = document.querySelectorAll('.qr-btn');
    const nameEl = document.getElementById('patient-name');
    const initialEl = document.getElementById('initial-text');
    const circleEl = document.getElementById('avatar-initial');

    qrButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tokenString = btn.dataset.qr;
            const title = btn.dataset.name;

            showQR(tokenString, title);
        });
    });

    //Set patient name and initial
    if (nameEl && initialEl) {
        const fullName = nameEl.textContent.trim();
        const firstLetter = fullName.charAt(0).toUpperCase();
        initialEl.textContent = firstLetter;

        const colors = ['#FF5722', '#673AB7', '#2196F3', '#009688', '#E91E63', '#FFC107'];
        const colorIndex = firstLetter.charCodeAt(0) % colors.length;
        circleEl.style.backgroundColor = colors[colorIndex];
        circleEl.style.color = 'white';
    }

    //Function to generate and display QR code
    function showQR(tokenString, title) {
        // Clear previous QR code if any
        qrContainer.innerHTML = '';
        modalTitle.textContent = title;

        new QRCode(qrContainer, {
            text: tokenString,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });

        modal.style.display = 'flex';
    }

    //Close modal on clicking close button
    function closeQR() {
        modal.style.display = 'none';
        setTimeout(() => { qrContainer.innerHTML = ''; }, 200);
    }

    closeBtn.addEventListener('click', closeQR);
    
    //Close modal on clicking outside the modal content
    window.onclick = function(event) {
        if (event.target == modal) {
            closeQR();
        }
    }
});

// Polling logic
setInterval(async () => {
    const pendingCards = document.querySelectorAll('.pending-card');
    if (pendingCards.length === 0) return;

    location.reload();
}, 5000);