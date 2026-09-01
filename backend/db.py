# backend/db.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def get_db_connection():
    """Retorna uma conexão limpa com o banco usando cursores de dicionário."""
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def query_db(query, args=(), one=False):
    """Executa consultas de leitura no banco retornando dicionários nativos."""
    conn = get_db_connection()
    # RealDictCursor faz o Python retornar dados como {'id': 1, 'name': 'Exemplo'}
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(query, args)
        rv = cur.fetchall()
        cur.close()
        conn.close()
        return (rv[0] if rv else None) if one else rv
    except Exception as e:
        cur.close()
        conn.close()
        raise e
