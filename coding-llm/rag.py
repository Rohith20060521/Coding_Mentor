import numpy as np
from transformers import AutoTokenizer, AutoModel
import torch
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag")

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")

# Check CUDA
device = "cuda" if torch.cuda.is_available() else "cpu"

tokenizer = AutoTokenizer.from_pretrained(EMBEDDING_MODEL)
model = AutoModel.from_pretrained(EMBEDDING_MODEL).to(device)
model.eval()

def get_embedding(text: str) -> list:
    """Generate dense vector embedding for text chunk."""
    inputs = tokenizer(text, padding=True, truncation=True, max_length=512, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model(**inputs)
        
    # Mean pooling
    attention_mask = inputs['attention_mask']
    token_embeddings = outputs.last_hidden_state
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    embeddings = sum_embeddings / sum_mask
    
    return embeddings[0].cpu().tolist()

def cosine_similarity(a: list, b: list) -> float:
    """Compute cosine similarity between two vector lists."""
    v1 = np.array(a)
    v2 = np.array(b)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return float(np.dot(v1, v2) / (norm_v1 * norm_v2))

def split_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list:
    """Split text into chunks based on word boundary, keeping overlap."""
    chunks = []
    if not text:
        return chunks
        
    words = text.split()
    current_chunk = []
    current_len = 0
    
    # Calculate target overlap word length
    overlap_word_count = max(1, overlap // 6) # Estimate average word length is 6 chars
    
    for word in words:
        current_chunk.append(word)
        current_len += len(word) + 1  # word + space
        
        if current_len >= chunk_size:
            chunks.append(" ".join(current_chunk))
            # Keep overlap words
            current_chunk = current_chunk[-overlap_word_count:]
            current_len = sum(len(w) + 1 for w in current_chunk)
            
    if current_chunk:
        chunks.append(" ".join(current_chunk))
        
    return chunks
