import os
import requests
import psycopg2
from psycopg2.extras import execute_values
import time

NEWS_API_KEY = os.environ.get('NEWS_API_KEY')
DATABASE_URL = os.environ.get('DATABASE_URL')
NEWS_API_URL = 'https://newsapi.org/v2/top-headlines'
CATEGORIES = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def fetch_news_for_category(category):
    params = {'apiKey': NEWS_API_KEY, 'category': category, 'language': 'en', 'pageSize': 20}
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        return response.json().get('articles', [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching news for category '{category}': {e}")
        return []

def save_articles_to_db(articles):
    if not articles: return
    conn = get_db_connection()
    cur = conn.cursor()
    articles_to_insert = []
    for article in articles:
        if article.get('url'):
            articles_to_insert.append((
                article.get('title'), article.get('description'), article.get('url'),
                article.get('urlToImage'), article.get('publishedAt'),
                article.get('source', {}).get('name'), article.get('category')
            ))
    if not articles_to_insert:
        cur.close()
        conn.close()
        return
    insert_query = """
        INSERT INTO articles (title, description, url, image_url, published_at, source, category)
        VALUES %s ON CONFLICT (url) DO NOTHING;
    """
    try:
        execute_values(cur, insert_query, articles_to_insert)
        conn.commit()
        print(f"Saved or ignored {len(articles_to_insert)} articles.")
    except Exception as e:
        print(f"Database error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def main():
    all_articles = []
    for category in CATEGORIES:
        print(f"Fetching news for category: {category}...")
        articles = fetch_news_for_category(category)
        for article in articles:
            article['category'] = category
        all_articles.extend(articles)
        time.sleep(1)
    if all_articles:
        save_articles_to_db(all_articles)
    print("News fetching complete.")

if __name__ == '__main__':
    if not NEWS_API_KEY:
        print("ERROR: NEWS_API_KEY environment variable not set.")
    elif not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable not set.")
    else:
        main()

