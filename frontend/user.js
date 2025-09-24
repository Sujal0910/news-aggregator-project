// The live URL of your backend.
const API_BASE_URL = 'https://news-backend-qgjq.onrender.com';
import { fetchRecommendations } from './main.js';

async function checkLoginStatus() {
    console.log("USER.JS: Checking login status...");
    try {
        const response = await fetch(`${API_BASE_URL}/api/is_logged_in`, {
            credentials: 'include'
        });
        console.log("USER.JS: Response from /is_logged_in:", response.status, response.statusText);
        const data = await response.json();
        console.log("USER.JS: Data from /is_logged_in:", data);
        updateNavbar(data.logged_in, data.username);
        if (data.logged_in) {
            fetchRecommendations();
        }
        return data.logged_in;
    } catch (error) {
        console.error('USER.JS: Error checking login status:', error);
        updateNavbar(false);
        return false;
    }
}

function updateNavbar(isLoggedIn, username) {
    const loginLinkContainer = document.getElementById('login-link-container');
    const registerLinkContainer = document.getElementById('register-link-container');
    const logoutButtonContainer = document.getElementById('logout-button-container');
    const welcomeMessage = document.getElementById('welcome-message');

    if (isLoggedIn) {
        // Hide these when logged in
        loginLinkContainer.classList.add('d-none');
        registerLinkContainer.classList.add('d-none');
        // Show these when logged in
        logoutButtonContainer.classList.remove('d-none');
        welcomeMessage.textContent = `Welcome, ${username}`;
    } else {
        // Show these when logged out
        loginLinkContainer.classList.remove('d-none');
        registerLinkContainer.classList.remove('d-none');
        // Hide these when logged out
        logoutButtonContainer.classList.add('d-none');
        welcomeMessage.textContent = '';
    }
}

function logout() {
    console.log("USER.JS: Attempting to log out...");
    fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include'
    })
    .then(response => {
        console.log("USER.JS: Response from /logout:", response.status, response.statusText);
        // This is the crucial step: reload the page to reflect the logged-out state.
        window.location.reload();
    })
    .catch(error => {
        console.error('USER.JS: Logout error:', error);
        // Still reload the page to attempt to fix the UI state
        window.location.reload();
    });
}

export { checkLoginStatus, logout };
