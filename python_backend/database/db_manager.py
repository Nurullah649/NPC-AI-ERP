import logging
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from sqlalchemy.sql import func
import json

# Veritabanı dosyasının yolu
# Bu, main.py'deki get_persistent_data_path() ile aynı mantığı kullanmalı
def get_db_path():
    if len(sys.argv) > 1:
        return Path(sys.argv[1]) / "npc_erp.db"
    elif sys.platform == "win32":
        return Path(os.getenv("APPDATA")) / "NPC-AI-ERP" / "npc_erp.db"
    else:
        return Path.home() / ".config" / "NPC-AI-ERP" / "npc_erp.db"

DB_PATH = get_db_path()
DB_PATH.parent.mkdir(exist_ok=True) # Klasörün var olduğundan emin ol

# SQLAlchemy motorunu oluştur
engine = create_engine(f'sqlite:///{DB_PATH}')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Veritabanı Modelleri (Tablolar) ---

class ProductCache(Base):
    __tablename__ = "product_cache"
    id = Column(Integer, primary_key=True, index=True)
    search_term = Column(String, index=True, unique=True)
    results = Column(Text)  # JSON string olarak saklanacak
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    assignments = relationship("Assignment", back_populates="customer")

class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    product_name = Column(String)
    product_code = Column(String)
    cas_number = Column(String)
    price_numeric = Column(Float)
    price_str = Column(String)
    source = Column(String)
    brand = Column(String)
    unit = Column(String)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    customer = relationship("Customer", back_populates="assignments")

class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id = Column(String, primary_key=True, index=True)
    date = Column(String, index=True)
    note = Column(Text, nullable=True)
    meetings = Column(Text) # JSON string olarak saklanacak

# --- Veritabanı İşlem Fonksiyonları ---

def init_db():
    """Veritabanını ve tabloları oluşturur."""
    try:
        Base.metadata.create_all(bind=engine)
        logging.info("Veritabanı ve tablolar başarıyla oluşturuldu/kontrol edildi.")
    except Exception as e:
        logging.critical(f"Veritabanı başlatılırken kritik hata: {e}", exc_info=True)

def save_calendar_notes_to_db(notes: list):
    db = SessionLocal()
    try:
        # Önce mevcut tüm notları sil
        db.query(CalendarEvent).delete()
        # Yeni notları ekle
        for note_data in notes:
            meetings_json = json.dumps(note_data.get("meetings", []))
            db_note = CalendarEvent(
                id=note_data["id"],
                date=note_data["date"],
                note=note_data.get("note", ""),
                meetings=meetings_json
            )
            db.add(db_note)
        db.commit()
        logging.info(f"{len(notes)} adet takvim notu veritabanına kaydedildi.")
    except Exception as e:
        db.rollback()
        logging.error(f"Takvim notları veritabanına kaydedilirken hata: {e}", exc_info=True)
    finally:
        db.close()

def load_calendar_notes_from_db() -> list:
    db = SessionLocal()
    try:
        notes_from_db = db.query(CalendarEvent).all()
        notes = []
        for db_note in notes_from_db:
            notes.append({
                "id": db_note.id,
                "date": db_note.date,
                "note": db_note.note,
                "meetings": json.loads(db_note.meetings or "[]")
            })
        logging.info(f"{len(notes)} adet takvim notu veritabanından yüklendi.")
        return notes
    except Exception as e:
        logging.error(f"Takvim notları veritabanından yüklenirken hata: {e}", exc_info=True)
        return []
    finally:
        db.close()

# Diğer fonksiyonlar (ürün ekleme, müşteri ekleme vb.) buraya eklenecek.

if __name__ == "__main__":
    # Bu dosya doğrudan çalıştırıldığında veritabanını başlatır.
    print("Veritabanı şeması oluşturuluyor...")
    init_db()
    print("Veritabanı şeması başarıyla oluşturuldu.")
