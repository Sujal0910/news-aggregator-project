// The live URL of your backend.
const API_BASE_URL = 'https://news-backend-qgjq.onrender.com';
import { fetchRecommendations } from './main.js';

async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/is_logged_in`, {
            credentials: 'include'
        });
        const data = await response.json();
        updateNavbar(data.logged_in, data.username);
        if (data.logged_in) {
            fetchRecommendations();
        }
        return data.logged_in;
    } catch (error) {
        console.error('Error checking login status:', error);
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
    fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include' // Important for the server to know which session to end
    })
    .then(() => {
        // This is the crucial step: reload the page to reflect the logged-out state.
        window.location.reload();
    })
    .catch(error => {
        console.error('Logout error:', error);
        // Still reload the page to attempt to fix the UI state
        window.location.reload();
    });
}

export { checkLoginStatus, logout };

