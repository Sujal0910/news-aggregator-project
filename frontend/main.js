import { checkLoginStatus, logout } from './user.js';

// This will be replaced by Render's environment variable. Defaults to local server.
const API_BASE_URL = window.VITE_API_BASE_URL || 'http://127.0.0.1:5001';

const newsContainer = document.getElementById('news-container');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const navLinks = document.querySelector('.navbar-nav.me-auto');
const recommendationsContainer = document.getElementById('recommendations-container');
const recommendationsGrid = document.getElementById('recommendations-grid');

const createArticleCard = (article) => {
    const imageUrl = article.image_url || 'https://placehold.co/600x400?text=No+Image';
    return `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100 article-card">
                <img src="${imageUrl}" class="card-img-top" alt="${article.title}" onerror="this.onerror=null;this.src='https://placehold.co/600x400?text=No+Image';">
                <div class="card-body">
                    <h5 class="card-title">${article.title}</h5>
                    <p class="card-text">${article.description || 'No description available.'}</p>
                    <a href="${article.url}" target="_blank" class="btn btn-primary article-link" data-article-id="${article.id}">Read more</a>
                </div>
                <div class="card-footer text-muted">
                    Source: ${article.source || 'N/A'} | Published: ${new Date(article.published_at).toLocaleDateString()}
                </div>
            </div>
        </div>
    `;
};

const displayNews = (articles, container) => {
    container.innerHTML = articles.length ? articles.map(createArticleCard).join('') : '<p class="text-center">No articles found.</p>';
};

const fetchNews = async (query = '', category = '') => {
    try {
        newsContainer.innerHTML = `
            <div class="d-flex justify-content-center mt-5">
                <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>`;
        const response = await fetch(`${API_BASE_URL}/api/news?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const articles = await response.json();
        displayNews(articles, newsContainer);
    } catch (error) {
        newsContainer.innerHTML = '<p class="text-center text-danger">Failed to load news. Please try again later.</p>';
    }
};

const fetchRecommendations = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/recommendations`, { credentials: 'include' });
        if (response.ok) {
            const articles = await response.json();
            if (articles.length > 0) {
                recommendationsContainer.classList.remove('d-none');
                displayNews(articles, recommendationsGrid);
            }
        }
    } catch (error) {
        // Fail silently, as recommendations are not critical
    }
};

const setupCategoryFilters = () => {
    const categories = ['Business', 'Entertainment', 'General', 'Health', 'Science', 'Sports', 'Technology'];
    categories.forEach(category => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = `<a class="nav-link category-filter" href="#" data-category="${category.toLowerCase()}">${category}</a>`;
        navLinks.appendChild(li);
    });
};

const recordInteraction = async (articleId) => {
    try {
        await fetch(`${API_BASE_URL}/api/interactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: articleId }),
            credentials: 'include'
        });
    } catch (error) {
        // Fail silently
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    setupCategoryFilters();
    fetchNews();

    const isLoggedIn = await checkLoginStatus();
    if (isLoggedIn) {
        fetchRecommendations();
    }

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        fetchNews(searchInput.value, '');
        document.querySelector('.category-filter.active')?.classList.remove('active');
        document.querySelector('.category-filter[data-category=""]').classList.add('active');
    });

    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-filter')) {
            e.preventDefault();
            const category = e.target.dataset.category;
            searchInput.value = '';
            fetchNews('', category);
            document.querySelector('.category-filter.active')?.classList.remove('active');
            e.target.classList.add('active');
        }

        if (e.target.id === 'logout-button') {
            logout();
        }

        if (e.target.classList.contains('article-link')) {
            if (isLoggedIn) {
                const articleId = e.target.dataset.articleId;
                recordInteraction(articleId);
            }
        }
    });
});

