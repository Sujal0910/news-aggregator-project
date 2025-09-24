// The live URL of your backend is now hardcoded here.
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
            feedback.textContent = 'Registration successful! You can now log in.';
            feedback.className = 'alert alert-success mt-3';
            document.getElementById('register-form').reset();
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

