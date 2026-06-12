from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, AutoModelForCausalLM
from fastapi.middleware.cors import CORSMiddleware
import torch
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import io
import json
from pypdf import PdfReader
from sqlalchemy import func

from db import get_db, init_db
from models import User, Conversation, Message, Document, DocumentChunk
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_admin_user
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

MODEL_PATH = "./qwen-coding-model"

print("Loading model...")
torch.set_num_threads(torch.get_num_threads())
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    low_cpu_mem_usage=True
)
model.eval()

# Pydantic Schemas
class Question(BaseModel):
    prompt: str
    conversation_id: str = None  # Optional conversation ID to log history

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)
    role: str = "Student"  # "Student" or "Admin"

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class ConversationCreate(BaseModel):
    id: str
    title: str = "New Chat"

class CategoryUpdate(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)

# Authentication Endpoints
@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    if user_data.role not in ["Student", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'Student' or 'Admin'."
        )
        
    hashed = hash_password(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "User registered successfully",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role
        }
    }

@app.post("/login", response_model=TokenResponse)
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    token_payload = {
        "sub": user.username,
        "role": user.role,
        "email": user.email
    }
    access_token = create_access_token(data=token_payload)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }

@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "created_at": current_user.created_at
    }

# Admin endpoint - restricted to Admin role
@app.get("/admin/users")
def get_all_users(
    admin_user: User = Depends(get_admin_user), 
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at
        }
        for u in users
    ]

# Chat History Endpoints
@app.get("/conversations")
def get_conversations(
    search: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Conversation).filter(Conversation.user_id == current_user.id)
    
    if search:
        # Search both conversation titles AND message texts
        query = query.join(Message, isouter=True).filter(
            (Conversation.title.ilike(f"%{search}%")) | 
            (Message.text.ilike(f"%{search}%"))
        ).distinct()
        
    conversations = query.order_by(Conversation.updated_at.desc()).all()
    
    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at,
            "updated_at": c.updated_at
        }
        for c in conversations
    ]

@app.post("/conversations")
def create_conversation(
    conv_data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Conversation).filter(Conversation.id == conv_data.id).first()
    if existing:
        if existing.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return {
            "id": existing.id,
            "title": existing.title,
            "created_at": existing.created_at,
            "updated_at": existing.updated_at
        }
        
    new_conv = Conversation(
        id=conv_data.id,
        title=conv_data.title,
        user_id=current_user.id
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return {
        "id": new_conv.id,
        "title": new_conv.title,
        "created_at": new_conv.created_at,
        "updated_at": new_conv.updated_at
    }

@app.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    parsed_messages = []
    for m in messages:
        msg_sources = []
        conf_score = 0
        if m.sources:
            try:
                loaded = json.loads(m.sources)
                if isinstance(loaded, dict):
                    msg_sources = loaded.get("sources", [])
                    conf_score = loaded.get("confidence_score", 0)
                else:
                    msg_sources = loaded
            except Exception:
                msg_sources = []
                
        parsed_messages.append({
            "sender": m.sender,
            "text": m.text,
            "sources": msg_sources,
            "confidence_score": conf_score,
            "time": m.created_at.strftime("%I:%M:%S %p") if m.created_at else ""
        })
    return parsed_messages

@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted successfully"}

# RAG Document Management Endpoints
@app.post("/documents/upload", status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    category: str = Form("Uncategorized"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        # Read PDF content
        file_content = file.file.read()
        file_size = len(file_content)
        pdf_reader = PdfReader(io.BytesIO(file_content))
        
        # Save Document details (chunk count initialized to 0, updated later)
        doc = Document(
            filename=file.filename, 
            user_id=current_user.id,
            category=category.strip() or "Uncategorized",
            file_size=file_size
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        from rag import split_text, get_embedding
        
        total_chunks = 0
        
        # Process PDF page by page
        for page_idx, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text() or ""
            if not page_text.strip():
                continue
                
            chunks = split_text(page_text, chunk_size=500, overlap=100)
            total_chunks += len(chunks)
            
            for chunk in chunks:
                emb = get_embedding(chunk)
                db_chunk = DocumentChunk(
                    document_id=doc.id,
                    content=chunk,
                    embedding=json.dumps(emb),
                    page_num=page_idx + 1
                )
                db.add(db_chunk)
                
        # Update final chunk count
        doc.chunk_count = total_chunks
        db.commit()
        
        return {
            "message": "PDF uploaded and indexed successfully",
            "document": {
                "id": doc.id,
                "filename": doc.filename,
                "category": doc.category,
                "file_size": doc.file_size,
                "chunk_count": doc.chunk_count,
                "hit_count": doc.hit_count,
                "uploaded_at": doc.uploaded_at
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"PDF indexing failed: {str(e)}")

@app.get("/documents")
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "category": d.category,
            "file_size": d.file_size,
            "chunk_count": d.chunk_count,
            "hit_count": d.hit_count,
            "uploaded_at": d.uploaded_at
        }
        for d in docs
    ]

@app.put("/documents/{document_id}/category")
def update_document_category(
    document_id: int,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    doc.category = data.category.strip()
    db.commit()
    return {
        "message": "Category updated successfully",
        "document": {
            "id": doc.id,
            "filename": doc.filename,
            "category": doc.category
        }
    }

@app.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully"}

@app.get("/documents/stats")
def get_documents_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    
    total_files = len(docs)
    total_chunks = sum(d.chunk_count for d in docs)
    total_size = sum(d.file_size for d in docs)
    total_hits = sum(d.hit_count for d in docs)
    
    # Calculate category counts
    categories_dist = {}
    for d in docs:
        cat = d.category or "Uncategorized"
        categories_dist[cat] = categories_dist.get(cat, 0) + 1
        
    return {
        "total_files": total_files,
        "total_chunks": total_chunks,
        "total_size": total_size,
        "total_hits": total_hits,
        "categories_distribution": categories_dist
    }

# Secured AI Question endpoint with database logging and semantic context injection
@app.post("/ask")
def ask_ai(
    data: Question, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if conversation exists
    conv = None
    if data.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == data.conversation_id).first()
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        if conv.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Semantic Search RAG logic across user's uploaded PDFs
    context_str = ""
    sources = []
    confidence_score = 0
    
    user_docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    if user_docs:
        doc_ids = [d.id for d in user_docs]
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).all()
        
        if chunks:
            from rag import get_embedding, cosine_similarity
            query_emb = get_embedding(data.prompt)
            
            # Rank chunks
            ranked = []
            for chunk in chunks:
                chunk_emb = json.loads(chunk.embedding)
                sim = cosine_similarity(query_emb, chunk_emb)
                if sim >= 0.35:  # Similarity threshold
                    ranked.append((sim, chunk))
                    
            ranked.sort(key=lambda x: x[0], reverse=True)
            top_chunks = ranked[:3]
            
            if top_chunks:
                context_parts = []
                # Max similarity score converts to confidence score
                max_similarity = top_chunks[0][0]
                confidence_score = int(max_similarity * 100)
                
                # Deduplicate documents to increment hit_count once per query if multiple chunks match
                hit_docs = set()
                
                for sim, chunk in top_chunks:
                    context_parts.append(
                        f"[Document: {chunk.document.filename}, Page: {chunk.page_num}]\n{chunk.content}"
                    )
                    sources.append({
                        "filename": chunk.document.filename,
                        "page": chunk.page_num,
                        "content_snippet": chunk.content[:120] + "..." if len(chunk.content) > 120 else chunk.content
                    })
                    hit_docs.add(chunk.document_id)
                    
                context_str = "\n\n".join(context_parts)
                
                # Increment document hit_count in DB
                for doc_id in hit_docs:
                    db.query(Document).filter(Document.id == doc_id).update(
                        {Document.hit_count: Document.hit_count + 1}
                    )
                db.commit()

    # Log user message to database
    if data.conversation_id:
        user_msg = Message(
            conversation_id=data.conversation_id,
            sender="user",
            text=data.prompt
        )
        db.add(user_msg)
        
        # Auto-title conversation
        if conv.title == "New Chat":
            conv.title = data.prompt[:30].strip() or "New Chat"
            
        conv.updated_at = datetime.utcnow()
        db.commit()

    # Formulate context prompt
    if context_str:
        prompt_to_model = f"Context:\n{context_str}\n\nInstruction: Answer the question based on the context above.\nQuestion: {data.prompt}\nAnswer:"
    else:
        prompt_to_model = f"Instruction: {data.prompt}\nAnswer:"

    inputs = tokenizer(
        prompt_to_model,
        return_tensors="pt",
        truncation=True,
        max_length=1024
    )

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            do_sample=False,
            use_cache=True,
            num_beams=1,
            pad_token_id=tokenizer.eos_token_id
        )

    response = tokenizer.decode(
        outputs[0],
        skip_special_tokens=True
    )

    answer = response.replace(prompt_to_model, "").strip()

    # Log AI response and sources to database (saving confidence_score in metadata if desired, e.g. serialized with sources or in a custom column. serializing inside sources is easiest and highly compatible!)
    metadata = {
        "sources": sources,
        "confidence_score": confidence_score
    }
    
    if data.conversation_id:
        ai_msg = Message(
            conversation_id=data.conversation_id,
            sender="ai",
            text=answer,
            sources=json.dumps(metadata)
        )
        db.add(ai_msg)
        db.commit()

    return {"response": answer, "sources": sources, "confidence_score": confidence_score}