import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("db")

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/nextrus_db"
)

# Global database variables
engine = None
SessionLocal = None
Base = declarative_base()

def init_db():
    global engine, SessionLocal
    
    # Try connecting to PostgreSQL
    try:
        logger.info(f"Attempting connection to PostgreSQL...")
        temp_engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Test connection
        with temp_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        # Connection successful
        engine = temp_engine
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        logger.info("Connected to PostgreSQL successfully.")
    except Exception as e:
        logger.error(
            "\n"
            "===============================================================\n"
            "DATABASE WARNING: Could not connect to PostgreSQL!\n"
            f"Error: {e}\n"
            "Falling back to local SQLite database (sqlite:///./nextrus.db)\n"
            "===============================================================\n"
        )
        # Fallback to SQLite
        sqlite_url = "sqlite:///./nextrus.db"
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        logger.info("Initialized local SQLite fallback database successfully.")

def get_db():
    global SessionLocal
    if SessionLocal is None:
        init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
