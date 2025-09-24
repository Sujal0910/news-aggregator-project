const API_URL = 'http://127.0.0.1:5001';

// This function now returns the user's status, which is a key change.
export async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_URL}/api/is_logged_in`, { credentials: 'include' });
        const data = await response.json();

        const loginLinkContainer = document.getElementById('login-link-container');
        const logoutButtonContainer = document.getElementById('logout-button-container');
        const welcomeMessage = document.getElementById('welcome-message');

        if (data.logged_in) {
            loginLinkContainer.classList.add('d-none');
            document.querySelector('a.btn-secondary.ms-2').classList.add('d-none'); // Hides Register button
            logoutButtonContainer.classList.remove('d-none');
            welcomeMessage.textContent = `Welcome, ${data.username}`;
            return { logged_in: true, username: data.username }; // Return status
        } else {
            loginLinkContainer.classList.remove('d-none');
            document.querySelector('a.btn-secondary.ms-2').classList.remove('d-none'); // Shows Register button
            logoutButtonContainer.classList.add('d-none');
            return { logged_in: false }; // Return status
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        return { logged_in: false }; // Return status on error
    }
}

export async function logout() {
    try {
        await fetch(`${API_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

