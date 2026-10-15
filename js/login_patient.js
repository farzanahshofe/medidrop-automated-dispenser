document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const btn = document.getElementById('loginBtn');

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