import os
import time
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

# --- App Configuration ---
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'a-default-secret-key-for-local-dev')

# --- IMPORTANT: Session Cookie Configuration for Production ---
# These settings are crucial for login to work on a deployed site
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

# --- CORS Configuration ---
FRONTEND_URL = os.getenv('FRONTEND_URL')
CORS(app, resources={r"/api/*": {"origins": [FRONTEND_URL]}}, supports_credentials=True)

DATABASE_URL = os.getenv('DATABASE_URL')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')

print(f"--- SERVER STARTING ---")
print(f"Backend configured to allow requests from: {FRONTEND_URL}")

# (The rest of the file is exactly the same as the last version)

def get_db_connection():
    retries = 5
    while retries > 0:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            return conn
        except psycopg2.OperationalError as e:
            print(f"Database connection failed: {e}. Retrying... ({retries-1} left)")
            retries -= 1
            time.sleep(5)
    raise Exception("Could not connect to the database after several retries.")


def setup_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'users');")
        table_exists = cur.fetchone()[0]
        if not table_exists:
            print("Database is new. Initializing schema...")
            with open('schema.sql', 'r') as f: cur.execute(f.read())
            conn.commit()
            print("Tables created.")
            print("Fetching news...")
            categories = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']
            for category in categories:
                url = f'https://newsapi.org/v2/top-headlines?country=us&category={category}&apiKey={NEWS_API_KEY}'
                response = requests.get(url)
                if response.status_code == 200:
                    articles = response.json().get('articles', [])
                    for article in articles:
                        cur.execute(
                            """
                            INSERT INTO articles (title, description, url, image_url, published_at, source, category)
                            VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (url) DO NOTHING;
                            """,
                            (
                                article.get('title'), article.get('description'), article.get('url'),
                                article.get('urlToImage'), article.get('publishedAt'),
                                article.get('source', {}).get('name', 'N/A'), category
                            )
                        )
                    conn.commit()
            print("News fetching complete.")
        else:
            print("Database already initialized.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"AN ERROR OCCURRED DURING DATABASE SETUP: {e}")


def get_recommendations(user_id):
    conn = get_db_connection()
    interactions_df = pd.read_sql_query("SELECT user_id, article_id FROM user_interactions", conn)
    if interactions_df.empty:
        conn.close()
        return []
    user_item_matrix = pd.crosstab(interactions_df['user_id'], interactions_df['article_id'])
    if user_id not in user_item_matrix.index:
        conn.close()
        return []
    user_similarity = cosine_similarity(user_item_matrix)
    user_similarity_df = pd.DataFrame(user_similarity, index=user_item_matrix.index, columns=user_item_matrix.index)
    similar_users = user_similarity_df[user_id].sort_values(ascending=False)[1:6]
    recommended_articles = set()
    for similar_user_id, score in similar_users.items():
        similar_user_articles = user_item_matrix.loc[similar_user_id]
        articles_to_recommend = similar_user_articles[similar_user_articles > 0].index
        recommended_articles.update(articles_to_recommend)
    current_user_articles = user_item_matrix.loc[user_id]
    seen_articles = set(current_user_articles[current_user_articles > 0].index)
    final_recommendations_ids = list(recommended_articles - seen_articles)
    if not final_recommendations_ids:
        user_clicks_df = interactions_df[interactions_df['user_id'] == user_id]
        if not user_clicks_df.empty:
            clicked_article_ids = tuple(user_clicks_df['article_id'].tolist())
            query = f"SELECT DISTINCT category FROM articles WHERE id IN %s"
            categories_df = pd.read_sql_query(query, conn, params=(clicked_article_ids,))
            if not categories_df.empty:
                favorite_categories = tuple(categories_df['category'].tolist())
                fallback_query = f"""
                    SELECT id FROM articles WHERE category IN %s AND id NOT IN %s 
                    ORDER BY published_at DESC LIMIT 5
                """
                fallback_df = pd.read_sql_query(fallback_query, conn, params=(favorite_categories, clicked_article_ids))
                final_recommendations_ids = fallback_df['id'].tolist()
    if not final_recommendations_ids:
        conn.close()
        return []
    placeholders = ','.join(['%s'] * len(final_recommendations_ids))
    query = f"SELECT id, title, description, url, image_url, published_at, source, category FROM articles WHERE id IN ({placeholders}) ORDER BY published_at DESC LIMIT 5"
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(query, final_recommendations_ids)
    recommended_articles_details = cur.fetchall()
    cur.close()
    conn.close()
    return recommended_articles_details

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password: return jsonify({"error": "Username and password are required"}), 400
    hashed_password = generate_password_hash(password)
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO users (username, password_hash) VALUES (%s, %s)', (username, hashed_password))
        conn.commit()
    except psycopg2.IntegrityError:
        conn.close()
        return jsonify({"error": "Username already exists"}), 409
    finally:
        cur.close()
        conn.close()
    return jsonify({"message": "User created successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM users WHERE username = %s', (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({"message": "Logged in successfully", "username": user['username']})
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/is_logged_in', methods=['GET'])
def is_logged_in():
    if 'user_id' in session:
        return jsonify({"logged_in": True, "username": session.get('username')})
    return jsonify({"logged_in": False})

@app.route('/api/news', methods=['GET'])
def get_news():
    query = request.args.get('q', '')
    category = request.args.get('category', '')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    sql_query = "SELECT id, title, description, url, image_url, published_at, source, category FROM articles WHERE 1=1"
    params = []
    if query:
        sql_query += " AND (title LIKE %s OR description LIKE %s)"
        params.extend([f'%{query}%', f'%{query}%'])
    if category:
        sql_query += " AND category = %s"
        params.append(category)
    sql_query += " ORDER BY published_at DESC LIMIT 50"
    cur.execute(sql_query, params)
    articles = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(articles)

@app.route('/api/interactions', methods=['POST'])
def record_interaction():
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_id = session['user_id']
    data = request.get_json()
    article_id = data.get('article_id')
    if not article_id: return jsonify({"error": "Article ID is required"}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('SELECT 1 FROM user_interactions WHERE user_id = %s AND article_id = %s', (user_id, article_id))
        exists = cur.fetchone()
        if not exists:
            cur.execute('INSERT INTO user_interactions (user_id, article_id, interaction_type) VALUES (%s, %s, %s)', (user_id, article_id, 'click'))
            conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
    return jsonify({"message": "Interaction recorded"}), 201

@app.route('/api/recommendations', methods=['GET'])
def get_user_recommendations():
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_id = session['user_id']
    recommendations = get_recommendations(user_id)
    return jsonify(recommendations)

# Run the setup function when the application starts
if os.environ.get("RENDER"): # Only run setup on Render
    setup_database()

if __name__ == '__main__':
    app.run(port=5001, debug=False)

