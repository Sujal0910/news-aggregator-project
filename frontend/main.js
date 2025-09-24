import { checkLoginStatus, logout } from './user.js';

// The live URL of your backend.
const API_BASE_URL = 'https://news-backend-qgjq.onrender.com';

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Check login status first
    checkLoginStatus(); 
    
    // Initial fetch for news
    fetchNews(); 
    
    // Set up all event listeners
    setupEventListeners();

    // Set up theme based on user's preference
    setupTheme();
});

function setupEventListeners() {
    const searchForm = document.getElementById('search-form');
    const logoutButton = document.getElementById('logout-button');
    const navMenu = document.querySelector('.navbar-nav.me-auto');
    const newsContainer = document.getElementById('news-container');
    const themeToggle = document.getElementById('theme-toggle');
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = document.getElementById('search-input').value;
            fetchNews(query);
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    if (navMenu) {
        navMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-filter')) {
                e.preventDefault();
                document.querySelectorAll('.category-filter').forEach(link => link.classList.remove('active'));
                e.target.classList.add('active');
                const category = e.target.dataset.category;
                fetchNews('', category);
            }
        });
    }

    if (newsContainer) {
        newsContainer.addEventListener('click', (e) => {
            const link = e.target.closest('.article-link');
            if (link) {
                const articleId = link.dataset.articleId;
                if (articleId) {
                    recordInteraction(articleId);
                }
            }
        });
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollToTopBtn.style.display = 'block';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}


// --- API & DATA HANDLING ---
function fetchNews(query = '', category = '') {
    const newsContainer = document.getElementById('news-container');
    displaySkeletonLoader(newsContainer);

    const url = new URL(`${API_BASE_URL}/api/news`);
    if (query) url.searchParams.append('q', query);
    if (category) url.searchParams.append('category', category);

    fetch(url, { credentials: 'include' })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(articles => {
            displayArticles(articles, newsContainer);
        })
        .catch(error => {
            console.error('Error fetching news:', error);
            newsContainer.innerHTML = '<p class="text-center text-danger">Failed to load news. Please try again later.</p>';
        });
}

function fetchRecommendations() {
    const articlesDiv = document.getElementById('recommended-articles');
    displaySkeletonLoader(articlesDiv, 3); // Show 3 skeleton cards for recommendations

    fetch(`${API_BASE_URL}/api/recommendations`, { credentials: 'include' })
        .then(response => {
            if (response.ok) return response.json();
            return [];
        })
        .then(articles => {
            if (articles.length > 0) {
                const recommendationsContainer = document.getElementById('recommendations-container');
                displayArticles(articles, articlesDiv);
                recommendationsContainer.classList.remove('d-none');
            }
        })
        .catch(error => console.error('Error fetching recommendations:', error));
}

function recordInteraction(articleId) {
    if (document.getElementById('logout-button-container').classList.contains('d-none')) {
        return;
    }
    fetch(`${API_BASE_URL}/api/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ article_id: articleId })
    }).catch(error => console.error('Error recording interaction:', error));
}


// --- UI RENDERING ---
function displayArticles(articles, container) {
    container.innerHTML = '';
    if (!articles || articles.length === 0) {
        container.innerHTML = '<p class="text-center">No articles found.</p>';
        return;
    }
    articles.forEach(article => {
        const articleCard = `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100">
                    <img src="${article.image_url}" class="card-img-top" alt="${article.title}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${article.title}</h5>
                        <p class="card-text text-muted small">${article.description || 'No description available.'}</p>
                        <div class="mt-auto">
                            <a href="${article.url}" target="_blank" class="btn btn-primary article-link" data-article-id="${article.id}">Read more</a>
                        </div>
                    </div>
                    <div class="card-footer text-muted small">
                        Source: ${article.source || 'N/A'} | Published: ${new Date(article.published_at).toLocaleDateString()}
                    </div>
                </div>
            </div>`;
        container.innerHTML += articleCard;
    });
}

function displaySkeletonLoader(container, count = 6) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 skeleton-card">
                    <div class="img-placeholder"></div>
                    <div class="card-body">
                        <div class="text-placeholder w-100"></div>
                        <div class="text-placeholder w-75"></div>
                        <div class="text-placeholder w-50"></div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += skeleton;
    }
}

function populateCategories() {
    const categories = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'];
    const navMenu = document.querySelector('.navbar-nav.me-auto');
    // Start from 1 to skip the "All" category which is already there
    for(let i = 1; i < navMenu.children.length; i++) {
        navMenu.children[i].remove();
    }
    categories.forEach(category => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.className = 'nav-link category-filter';
        a.href = '#';
        a.dataset.category = category;
        a.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        li.appendChild(a);
        navMenu.appendChild(li);
    });
}


// --- THEME HANDLING ---
function setupTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

export { fetchRecommendations };

