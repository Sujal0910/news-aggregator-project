import { checkLoginStatus, logout } from './user.js';

// The live URL of your backend.
const API_BASE_URL = 'https://news-backend-qgjq.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all features
    checkLoginStatus();
    fetchNews();
    populateCategories();
    setupEventListeners();
    initTheme();
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
    
    if(scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.style.display = "block";
            } else {
                scrollToTopBtn.style.display = "none";
            }
        });
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}


function fetchNews(query = '', category = '') {
    const newsContainer = document.getElementById('news-container');
    displaySkeletonLoaders(newsContainer);

    const url = new URL(`${API_BASE_URL}/api/news`);
    if (query) url.searchParams.append('q', query);
    if (category) url.searchParams.append('category', category);

    fetch(url, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
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
    fetch(`${API_BASE_URL}/api/recommendations`, { credentials: 'include' })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            return [];
        })
        .then(articles => {
            if (articles.length > 0) {
                const recommendationsContainer = document.getElementById('recommendations-container');
                const articlesDiv = document.getElementById('recommended-articles');
                displayArticles(articles, articlesDiv);
                recommendationsContainer.classList.remove('d-none');
            }
        })
        .catch(error => {
            console.error('Error fetching recommendations:', error);
        });
}

function displayArticles(articles, container) {
    container.innerHTML = '';
    if (!articles || articles.length === 0) {
        container.innerHTML = '<p class="text-center">No articles found.</p>';
        return;
    }
    articles.forEach(article => {
        const articleCard = `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 article-card shadow-sm">
                    <img src="${article.image_url}" class="card-img-top" alt="${article.title}" onerror="this.onerror=null;this.src='https://placehold.co/600x400/EEE/31343C?text=Image+Not+Found';">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${article.title}</h5>
                        <p class="card-text text-muted">${article.description || ''}</p>
                        <div class="mt-auto pt-3">
                            <a href="${article.url}" target="_blank" class="btn btn-primary article-link" data-article-id="${article.id}">Read more</a>
                        </div>
                    </div>
                    <div class="card-footer">
                        <small class="text-muted">Source: ${article.source || 'N/A'} | ${new Date(article.published_at).toLocaleDateString()}</small>
                    </div>
                </div>
            </div>`;
        container.innerHTML += articleCard;
    });
}

function displaySkeletonLoaders(container) {
    container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        container.innerHTML += `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 article-card shadow-sm skeleton-card">
                    <div class="skeleton skeleton-img"></div>
                    <div class="card-body">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text short"></div>
                    </div>
                    <div class="card-footer">
                         <div class="skeleton skeleton-text short"></div>
                    </div>
                </div>
            </div>
        `;
    }
}

function populateCategories() {
    const categories = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'];
    const navMenu = document.querySelector('.navbar-nav.me-auto');
    categories.forEach(category => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.className = 'nav-link category-filter';
        a.href = '#';
        a.dataset.category = category;
        a.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        li.appendChild(a);
        // Prepend to navMenu after the "All" link
        navMenu.appendChild(li);
    });
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
    }).catch(error => {
        console.error('Error recording interaction:', error);
    });
}

// --- Theme Toggling ---
function initTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if(isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    updateThemeIcon(isDarkMode);
}

function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateThemeIcon(isDarkMode);
}

function updateThemeIcon(isDarkMode) {
     const themeToggle = document.getElementById('theme-toggle');
     if(themeToggle){
        themeToggle.innerHTML = isDarkMode ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
     }
}

export { fetchRecommendations };

