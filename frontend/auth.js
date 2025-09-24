// This line will be replaced by Render's environment variable at build time.
// For local development, it defaults to your local server.
const API_BASE_URL = window.VITE_API_BASE_URL || 'http://127.0.0.1:5001';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const messageContainer = document.getElementById('message-container');

    const showMessage = (message, isError = false) => {
        if (messageContainer) {
            messageContainer.textContent = message;
            messageContainer.className = `alert ${isError ? 'alert-danger' : 'alert-success'}`;
            messageContainer.classList.remove('d-none');
        }
    };

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.username.value;
            const password = loginForm.password.value;

            try {
                const response = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                    credentials: 'include' // Important for sending/receiving session cookies
                });
                const data = await response.json();
                if (response.ok) {
                    window.location.href = 'index.html'; // Redirect to main page on successful login
                } else {
                    showMessage(data.error || 'Login failed.', true);
                }
            } catch (error) {
                showMessage('An error occurred. Please try again.', true);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = registerForm.username.value;
            const password = registerForm.password.value;
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    showMessage('Registration successful! You can now log in.');
                    registerForm.reset();
                } else {
                    showMessage(data.error || 'Registration failed.', true);
                }
            } catch (error) {
                showMessage('An error occurred. Please try again.', true);
            }
        });
    }
});

