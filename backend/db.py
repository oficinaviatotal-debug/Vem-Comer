# backend/db.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Força o Python a descobrir a pasta real do backend e ler o arquivo .env correto
base_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(base_dir, '.env')
load_dotenv(dotenv_path)

# Pega a URL do .env. Se o arquivo sumir por algum motivo, usa o padrão local correto como segurança
DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://localhost:5433/vem_comer?host=/home/codespace/postgres_local')

def get_db_connection():
    """Retorna uma conexão limpa travada na porta privada 5433."""
    return psycopg2.connect(DATABASE_URL)

def query_db(query, args=(), one=False):
    """Executa consultas de leitura com segurança e flexibilidade."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(query, args)
        
        # Só lê os dados se a consulta de fato retornar linhas
        rv = cur.fetchall() if cur.description else None
        
        cur.close()
        conn.close()
        
        if rv:
            return rv if one else rv
        return None if one else []
    except Exception as e:
        cur.close()
        conn.close()
        raise e
