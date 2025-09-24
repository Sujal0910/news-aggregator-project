import os
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import psycopg2
from psycopg2.extras import DictCursor

app = Flask(__name__)
# For production, the secret key should be a long, random string
# It's loaded from an environment variable for security
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'a-strong-default-secret-key-for-development')

# CORS is configured to allow requests from the frontend's live URL
CORS(app, supports_credentials=True, origins=os.environ.get('CORS_ORIGIN', 'http://localhost:8000').split(','))

# The database connection URL is also loaded from an environment variable
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    return psycopg2.connect(DATABASE_URL)

def login_required(f):
    """Decorator to protect routes that require a user to be logged in."""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized Access"}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def get_recommendations(user_id):
    """
    Generates personalized article recommendations for a given user.
    Uses a hybrid approach: collaborative filtering first, then content-based fallback.
    """
    conn = get_db_connection()
    
    # Fetch all user interactions to build the model
    query = "SELECT user_id, article_id FROM user_interactions"
    interactions_df = pd.read_sql_query(query, conn)
    
    # --- Collaborative Filtering (Primary Model) ---
    # This model runs if there is more than one user with interaction data
    if interactions_df['user_id'].nunique() > 1 and user_id in interactions_df['user_id'].values:
        user_item_matrix = pd.crosstab(interactions_df['user_id'], interactions_df['article_id'])
        user_similarity = cosine_similarity(user_item_matrix)
        user_similarity_df = pd.DataFrame(user_similarity, index=user_item_matrix.index, columns=user_item_matrix.index)
        
        # Find the top 5 most similar users (excluding the user themselves)
        similar_users = user_similarity_df[user_id].sort_values(ascending=False)[1:6]
        
        recommended_articles = set()
        for similar_user_id, score in similar_users.items():
            # Find articles liked by similar users
            articles_to_recommend = user_item_matrix.loc[similar_user_id][user_item_matrix.loc[similar_user_id] > 0].index
            recommended_articles.update(articles_to_recommend)
            
        # Filter out articles the current user has already seen
        seen_articles = set(user_item_matrix.loc[user_id][user_item_matrix.loc[user_id] > 0].index)
        final_recommendations_ids = list(recommended_articles - seen_articles)
        
        if final_recommendations_ids:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                # Use ANY() for an efficient query with a list of IDs
                cur.execute("SELECT * FROM articles WHERE id = ANY(%s) ORDER BY published_at DESC LIMIT 5", (final_recommendations_ids,))
                recs = cur.fetchall()
            conn.close()
            return recs
    
    # --- Content-Based Filtering (Fallback Model) ---
    # This runs for new users or when there's only one user's data
    with conn.cursor(cursor_factory=DictCursor) as cur:
        # Find the user's favorite category based on their clicks
        cur.execute("""
            SELECT a.category FROM user_interactions ui JOIN articles a ON ui.article_id = a.id
            WHERE ui.user_id = %s GROUP BY a.category ORDER BY COUNT(a.category) DESC LIMIT 1;
        """, (user_id,))
        fav_cat_row = cur.fetchone()
        
        if fav_cat_row:
            fav_cat = fav_cat_row['category']
            # Recommend other articles from their favorite category that they haven't seen
            cur.execute("""
                SELECT * FROM articles WHERE category = %s AND id NOT IN 
                (SELECT article_id FROM user_interactions WHERE user_id = %s)
                ORDER BY published_at DESC LIMIT 5;
            """, (fav_cat, user_id))
            recs = cur.fetchall()
            conn.close()
            return recs
            
    conn.close()
    return []

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')
    if not username or not password: return jsonify({"error": "Username and password are required"}), 400
    
    hashed_password = generate_password_hash(password)
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('INSERT INTO users (username, password_hash) VALUES (%s, %s)', (username, hashed_password))
        conn.commit()
    except psycopg2.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    finally:
        conn.close()
    return jsonify({"message": "User created successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')
    conn = get_db_connection()
    with conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cur.fetchone()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'], session['username'] = user['id'], user['username']
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
    q, category = request.args.get('q', ''), request.args.get('category', '')
    conn = get_db_connection()
    sql, params = "SELECT * FROM articles WHERE 1=1", []
    
    if q:
        sql += " AND (title ILIKE %s OR description ILIKE %s)"
        params.extend([f'%{q}%', f'%{q}%'])
    if category:
        sql += " AND category = %s"
        params.append(category)
        
    sql += " ORDER BY published_at DESC LIMIT 50"
    
    with conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute(sql, tuple(params))
        articles = cur.fetchall()
    conn.close()
    return jsonify(articles)

@app.route('/api/interactions', methods=['POST'])
@login_required
def record_interaction():
    user_id = session['user_id']
    article_id = request.get_json().get('article_id')
    if not article_id: return jsonify({"error": "Article ID is required"}), 400
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if interaction already exists to prevent duplicates
            cur.execute('SELECT 1 FROM user_interactions WHERE user_id = %s AND article_id = %s', (user_id, article_id))
            if not cur.fetchone():
                cur.execute('INSERT INTO user_interactions (user_id, article_id, interaction_type) VALUES (%s, %s, %s)',(user_id, article_id, 'click'))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
    return jsonify({"message": "Interaction recorded"}), 201

@app.route('/api/recommendations', methods=['GET'])
@login_required
def get_user_recommendations():
    recs = get_recommendations(session['user_id'])
    return jsonify(recs)

# This check is important for Gunicorn, the production server
if __name__ == '__main__':
    app.run(port=5001, debug=True)

