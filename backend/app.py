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
from datetime import timedelta

# --- App Configuration ---
app = Flask(__name__)
# Set a secret key for session management
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'a-default-secret-key-for-local-dev')
# Configure session cookie for production
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='None',
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)


# --- VERY IMPORTANT: CORS Configuration ---
FRONTEND_URL = os.getenv('FRONTEND_URL')
if FRONTEND_URL:
    CORS(app, resources={r"/api/*": {"origins": [FRONTEND_URL]}}, supports_credentials=True)
    print(f"--- SERVER STARTING ---")
    print(f"Backend configured to allow requests from: {FRONTEND_URL}")
else:
    CORS(app, supports_credentials=True, origins=['http://localhost:8000', 'http://127.0.0.1:8000'])
    print("--- SERVER STARTING (LOCAL) ---")


DATABASE_URL = os.getenv('DATABASE_URL')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')


def get_db_connection():
    # ... (function is unchanged)
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
    # ... (function is unchanged)
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
    final_recommendations_ids = []
    if not interactions_df.empty and interactions_df['user_id'].nunique() > 1:
        user_item_matrix = pd.crosstab(interactions_df['user_id'], interactions_df['article_id'])
        if user_id in user_item_matrix.index:
            user_similarity = cosine_similarity(user_item_matrix)
            user_similarity_df = pd.DataFrame(user_similarity, index=user_item_matrix.index, columns=user_item_matrix.index)
            similar_users = user_similarity_df[user_id].sort_values(ascending=False)[1:6]
            recommended_articles = set()
            for similar_user_id, score in similar_users.items():
                if score > 0:
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
            query = "SELECT DISTINCT category FROM articles WHERE id IN %s"
            cur_fallback = conn.cursor(cursor_factory=RealDictCursor)
            cur_fallback.execute(query, (clicked_article_ids,))
            categories_result = cur_fallback.fetchall()
            cur_fallback.close()
            if categories_result:
                favorite_categories = tuple([row['category'] for row in categories_result])
                fallback_query = """
                    SELECT id FROM articles WHERE category IN %s AND id NOT IN %s 
                    AND image_url IS NOT NULL AND image_url != ''
                    ORDER BY RANDOM() LIMIT 5
                """
                cur_fallback_2 = conn.cursor(cursor_factory=RealDictCursor)
                cur_fallback_2.execute(fallback_query, (favorite_categories, clicked_article_ids))
                fallback_result = cur_fallback_2.fetchall()
                cur_fallback_2.close()
                final_recommendations_ids = [row['id'] for row in fallback_result]
    if not final_recommendations_ids:
        conn.close()
        return []
    placeholders = ','.join(['%s'] * len(final_recommendations_ids))
    query = f"""
        SELECT id, title, description, url, image_url, published_at, source, category 
        FROM articles 
        WHERE id IN ({placeholders}) AND image_url IS NOT NULL AND image_url != ''
    """
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(query, final_recommendations_ids)
    recommended_articles_details = cur.fetchall()
    cur.close()
    conn.close()
    return recommended_articles_details


@app.route('/api/register', methods=['POST'])
def register():
    # ... (function is unchanged)
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
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": f"Database error: {e}"}), 500
    finally:
        cur.close()
        conn.close()
    return jsonify({"message": "User created successfully"}), 201


@app.route('/api/login', methods=['POST'])
def login():
    # --- LOGGING ADDED ---
    print(f"--- LOGIN ATTEMPT ---")
    print(f"Session before login: {session}")
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    conn = get_db_connection()
    user = None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cur.fetchone()
        cur.close()
    except Exception as e:
        return jsonify({"error": f"Database error: {e}"}), 500
    finally:
        conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        session.permanent = True
        # --- LOGGING ADDED ---
        print(f"Login successful for user: {username}")
        print(f"Session after login: {session}")
        return jsonify({"message": "Logged in successfully", "username": user['username']})
    
    print(f"Login failed for username: {username}")
    return jsonify({"error": "Invalid username or password"}), 401


@app.route('/api/logout', methods=['POST'])
def logout():
    # --- LOGGING ADDED ---
    print(f"--- LOGOUT ATTEMPT ---")
    print(f"Session before logout: {session}")
    session.clear()
    print(f"Session after logout: {session}")
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/is_logged_in', methods=['GET'])
def is_logged_in():
    # --- LOGGING ADDED ---
    print(f"--- CHECKING LOGIN STATUS ---")
    print(f"Incoming session: {session}")
    if 'user_id' in session:
        print(f"User IS logged in. User: {session.get('username')}")
        return jsonify({"logged_in": True, "username": session.get('username')})
    
    print(f"User is NOT logged in.")
    return jsonify({"logged_in": False})

@app.route('/api/news', methods=['GET'])
def get_news():
    query = request.args.get('q', '')
    category = request.args.get('category', '')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    sql_query = "SELECT id, title, description, url, image_url, published_at, source, category FROM articles WHERE image_url IS NOT NULL AND image_url != ''"
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
    # ... (function is unchanged)
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

