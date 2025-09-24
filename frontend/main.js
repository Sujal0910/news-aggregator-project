import { checkLoginStatus, logout } from './user.js';

// The live URL of your backend is now hardcoded here.
const API_BASE_URL = 'https://news-backend-qgjq.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    fetchNews();
    populateCategories();

    const searchForm = document.getElementById('search-form');
    if(searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = document.getElementById('search-input').value;
            fetchNews(query);
        });
    }

    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    // Use event delegation for category links
    const navMenu = document.querySelector('.navbar-nav.me-auto');
    if(navMenu) {
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

    // Use event delegation for article links for interaction tracking
    const newsContainer = document.getElementById('news-container');
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
});


function fetchNews(query = '', category = '') {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = `
        <div class="d-flex justify-content-center mt-5">
            <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>`;

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
                <div class="card h-100 article-card">
                    <img src="${article.image_url || 'https://placehold.co/600x400/EEE/31343C?text=No+Image'}" class="card-img-top" alt="${article.title}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${article.title}</h5>
                        <p class="card-text">${article.description || 'No description available.'}</p>
                        <div class="mt-auto">
                            <a href="${article.url}" target="_blank" class="btn btn-primary article-link" data-article-id="${article.id}">Read more</a>
                        </div>
                    </div>
                    <div class="card-footer text-muted">
                        Source: ${article.source || 'N/A'} | Published: ${new Date(article.published_at).toLocaleDateString()}
                    </div>
                </div>
            </div>`;
        container.innerHTML += articleCard;
    });
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
        navMenu.appendChild(li);
    });
}

function recordInteraction(articleId) {
    if (document.getElementById('logout-button-container').classList.contains('d-none')) {
        return; 
    }
    
    fetch(`${API_BASE_URL}/api/interactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ article_id: articleId })
    }).catch(error => {
        console.error('Error recording interaction:', error);
    });
}

export { fetchRecommendations };

