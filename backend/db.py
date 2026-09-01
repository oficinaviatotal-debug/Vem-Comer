import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(base_dir, '.env')
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://localhost:5433/vem_comer?host=/home/codespace/postgres_local')

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def query_db(query, args=(), one=False):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(query, args)
        rv = cur.fetchall() if cur.description else None
        cur.close()
        conn.close()
        
        if rv:
            return rv[0] if one else rv
        return None if one else []
    except Exception as e:
        cur.close()
        conn.close()
        raise e
