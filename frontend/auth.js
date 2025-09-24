// The live URL of your backend.
const API_BASE_URL = 'https://news-backend-qgjq.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin();
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleRegister();
        });
    }
});

function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const feedback = document.getElementById('feedback');
    feedback.textContent = 'Logging in...';
    feedback.className = 'alert alert-info mt-3';

    fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // This is the line that redirects to the homepage.
            window.location.href = 'index.html'; 
        } else {
            feedback.textContent = data.error || 'Login failed!';
            feedback.className = 'alert alert-danger mt-3';
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        feedback.textContent = 'An error occurred. Please try again.';
        feedback.className = 'alert alert-danger mt-3';
    });
}

function handleRegister() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const feedback = document.getElementById('feedback');
    feedback.textContent = 'Registering...';
    feedback.className = 'alert alert-info mt-3';

    fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            feedback.textContent = 'Registration successful! Redirecting to login...';
            feedback.className = 'alert alert-success mt-3';
            // Redirect to login page after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            feedback.textContent = data.error || 'Registration failed!';
            feedback.className = 'alert alert-danger mt-3';
        }
    })
    .catch(error => {
        console.error('Registration error:', error);
        feedback.textContent = 'An error occurred. Please try again.';
        feedback.className = 'alert alert-danger mt-3';
    });
}

