import os
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to database: {e}")
        return None

def initialize_db():
    conn = get_db_connection()
    if conn is None:
        print("Could not connect to the database. Aborting initialization.")
        return

    cur = conn.cursor()
    try:
        with open('schema.sql', 'r') as f:
            schema_sql = f.read()
        cur.execute(schema_sql)
        conn.commit()
        print("Database initialized successfully.")
    except FileNotFoundError:
        print("schema.sql not found. Please ensure it is in the backend directory.")
    except Exception as e:
        print(f"An error occurred during database initialization: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    initialize_db()

