#!/usr/bin/env python3
"""
Production Flask Backend for NCERT + PYQ AI Study Assistant
Optimized for Railway deployment with minimal dependencies
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import time
import hashlib
from groq import Groq
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
from functools import wraps
import traceback

# Initialize Flask app
app = Flask(__name__)

# Production CORS Configuration
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3002,http://localhost:5173').split(',')

CORS(app, 
     origins=ALLOWED_ORIGINS + ["https://*.vercel.app", "https://*.railway.app"],
     methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     supports_credentials=True,
     max_age=3600)

# Global components
search_components = {}
system_initialized = False
rate_limit_storage = {}

# Rate limiting decorator
def rate_limit(max_requests=100, window_seconds=60):
    """Rate limiting to prevent abuse"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            current_time = time.time()
            
            if client_ip in rate_limit_storage:
                rate_limit_storage[client_ip] = [
                    ts for ts in rate_limit_storage[client_ip]
                    if current_time - ts < window_seconds
                ]
            else:
                rate_limit_storage[client_ip] = []
            
            if len(rate_limit_storage[client_ip]) >= max_requests:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': f'Max {max_requests} requests per {window_seconds}s'
                }), 429
            
            rate_limit_storage[client_ip].append(current_time)
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f'Internal error: {str(error)}')
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f'Exception: {str(e)}\n{traceback.format_exc()}')
    return jsonify({
        'error': 'An error occurred',
        'message': str(e) if os.getenv('FLASK_ENV') == 'development' else 'Please try again'
    }), 500

# Initialize system
def initialize_search_system():
    """Initialize Pinecone and Groq components"""
    global search_components, system_initialized
    
    try:
        print("🔧 Initializing search system...")
        
        groq_key = os.getenv('GROQ_API_KEY')
        pine_key = os.getenv('PINECONE_API_KEY')
        
        if not groq_key or not pine_key:
            print("❌ Missing API keys!")
            system_initialized = True
            return False
        
        # Initialize Pinecone
        pc_rag = Pinecone(api_key=pine_key)
        pc_mcq = Pinecone(api_key=pine_key)
        
        rag_index = pc_rag.Index("ncert")
        mcq_index = pc_mcq.Index('pyq-1')
        
        # Initialize embedding models (lazy loading)
        rag_model = SentenceTransformer("all-MiniLM-L6-v2")
        mcq_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', device='cpu')
        
        # Initialize Groq
        client = Groq(api_key=groq_key)
        
        search_components.update({
            'rag_index': rag_index,
            'rag_model': rag_model,
            'mcq_index': mcq_index,
            'mcq_model': mcq_model,
            'client': client
        })
        
        system_initialized = True
        print("✅ Search system initialized")
        return True
        
    except Exception as e:
        print(f"❌ Initialization failed: {str(e)}")
        system_initialized = True
        return False

# Search utilities
def semantic_search(index, model, query: str, n_results: int = 5, namespace: str = ""):
    """Perform semantic search"""
    query_embedding = model.encode([query]).tolist()[0]
    
    params = {
        'vector': query_embedding,
        'top_k': n_results,
        'include_metadata': True
    }
    
    if namespace:
        params['namespace'] = namespace
    
    return index.query(**params)

def get_context_with_sources(results):
    """Extract context and sources from search results"""
    context_parts = []
    sources = []
    
    for i, match in enumerate(results['matches'], 1):
        metadata = match.get('metadata', {})
        text_content = metadata.get('text', metadata.get('question', ''))
        score = match.get('score', 0)
        
        context_parts.append(f"[Source {i}]\n{text_content}")
        
        sources.append({
            'source': metadata.get('source', 'Unknown'),
            'score': float(score),
            'text': text_content[:200] + '...' if len(text_content) > 200 else text_content
        })
    
    return '\n\n'.join(context_parts), sources

def generate_response(client, query: str, context: str, conversation_history=None):
    """Generate AI response using Groq"""
    
    system_prompt = """You are an expert AI tutor specializing in NCERT curriculum and competitive exam preparation.
Provide clear, accurate answers based on the given context. Include examples when helpful."""
    
    user_message = f"""**Context:**
{context}

**Question:** {query}

Provide a comprehensive answer using the context above."""
    
    messages = [{"role": "system", "content": system_prompt}]
    
    if conversation_history:
        messages.extend(conversation_history[-4:])
    
    messages.append({"role": "user", "content": user_message})
    
    response = client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
        top_p=0.9,
        stream=False
    )
    
    return response.choices[0].message.content

# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'initialized': system_initialized,
        'timestamp': time.time()
    })

@app.route('/api/search', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=50, window_seconds=60)
def search():
    """Main search endpoint with RAG"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({'error': 'Query required'}), 400
        
        if not search_components:
            return jsonify({'error': 'System not initialized'}), 503
        
        rag_index = search_components['rag_index']
        rag_model = search_components['rag_model']
        mcq_index = search_components['mcq_index']
        mcq_model = search_components['mcq_model']
        client = search_components['client']
        
        n_results = data.get("n_results", 5)
        namespace = data.get("namespace", "")
        conversation_history = data.get("conversation_history", [])
        include_mcqs = data.get("include_mcqs", True)
        mcq_limit = data.get("mcq_limit", 5)
        
        # RAG search
        rag_results = semantic_search(rag_index, rag_model, query, n_results, namespace)
        context, sources = get_context_with_sources(rag_results)
        
        # Generate response
        response_text = generate_response(client, query, context, conversation_history)
        
        # MCQ search
        mcqs = []
        if include_mcqs and mcq_index:
            try:
                mcq_results = semantic_search(mcq_index, mcq_model, query, mcq_limit)
                for match in mcq_results['matches']:
                    metadata = match.get('metadata', {})
                    
                    if 'full_json_str' in metadata:
                        try:
                            mcq_data = json.loads(metadata['full_json_str'])
                            mcqs.append(mcq_data)
                        except:
                            pass
            except Exception as e:
                app.logger.warning(f"MCQ search failed: {str(e)}")
        
        return jsonify({
            'response': response_text,
            'sources': sources,
            'mcqs': mcqs[:mcq_limit],
            'query': query
        })
        
    except Exception as e:
        app.logger.error(f"Search error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics"""
    try:
        if not search_components.get('rag_index') or not search_components.get('mcq_index'):
            return jsonify({'error': 'System not initialized'}), 503
        
        rag_stats = search_components['rag_index'].describe_index_stats()
        mcq_stats = search_components['mcq_index'].describe_index_stats()
        
        return jsonify({
            'rag': {
                'total_vectors': rag_stats.get('total_vector_count', 0),
                'dimension': rag_stats.get('dimension', 384)
            },
            'mcq': {
                'total_vectors': mcq_stats.get('total_vector_count', 0),
                'dimension': mcq_stats.get('dimension', 384)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pyq/search', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=50, window_seconds=60)
def search_pyq():
    """Search PYQ questions with filters"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        query = data.get('query', '').strip()
        exam_name = data.get('exam_name')
        year = data.get('year')
        subject = data.get('subject')
        limit = data.get('limit', 20)
        
        if not query:
            return jsonify({'error': 'Query required'}), 400
        
        mcq_index = search_components.get('mcq_index')
        mcq_model = search_components.get('mcq_model')
        
        if not mcq_index or not mcq_model:
            return jsonify({'error': 'System not initialized'}), 503
        
        # Perform search
        results = semantic_search(mcq_index, mcq_model, query, limit * 2)
        
        questions = []
        for match in results['matches']:
            metadata = match.get('metadata', {})
            
            # Apply filters
            if exam_name and metadata.get('exam_name') != exam_name:
                continue
            if year and str(metadata.get('year')) != str(year):
                continue
            if subject and metadata.get('subject') != subject:
                continue
            
            if 'full_json_str' in metadata:
                try:
                    question_data = json.loads(metadata['full_json_str'])
                    question_data['score'] = float(match.get('score', 0))
                    questions.append(question_data)
                except:
                    pass
            
            if len(questions) >= limit:
                break
        
        return jsonify({
            'questions': questions,
            'total': len(questions)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pyq/random', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=30, window_seconds=60)
def random_pyq():
    """Get random PYQ questions for quiz"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        exam_name = data.get('exam_name')
        year = data.get('year')
        subject = data.get('subject')
        count = min(data.get('count', 10), 50)
        
        mcq_index = search_components.get('mcq_index')
        
        if not mcq_index:
            return jsonify({'error': 'System not initialized'}), 503
        
        # Get random vectors
        import random
        random_queries = [f"question {random.randint(1, 10000)}" for _ in range(count * 3)]
        
        questions = []
        seen_ids = set()
        
        for query_text in random_queries:
            if len(questions) >= count:
                break
            
            results = semantic_search(mcq_index, search_components['mcq_model'], query_text, 5)
            
            for match in results['matches']:
                if len(questions) >= count:
                    break
                
                metadata = match.get('metadata', {})
                q_id = match.get('id')
                
                if q_id in seen_ids:
                    continue
                
                # Apply filters
                if exam_name and metadata.get('exam_name') != exam_name:
                    continue
                if year and str(metadata.get('year')) != str(year):
                    continue
                if subject and metadata.get('subject') != subject:
                    continue
                
                if 'full_json_str' in metadata:
                    try:
                        question_data = json.loads(metadata['full_json_str'])
                        questions.append(question_data)
                        seen_ids.add(q_id)
                    except:
                        pass
        
        return jsonify({
            'questions': questions,
            'count': len(questions)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pyq/filters', methods=['GET'])
def get_pyq_filters():
    """Get available filter options"""
    try:
        mcq_index = search_components.get('mcq_index')
        
        if not mcq_index:
            return jsonify({'error': 'System not initialized'}), 503
        
        stats = mcq_index.describe_index_stats()
        namespaces = list(stats.get('namespaces', {}).keys())
        
        # Extract exam names and years from namespaces
        exams = set()
        years = set()
        
        for ns in namespaces:
            parts = ns.split('_')
            if len(parts) >= 2:
                exam = '_'.join(parts[:-1])
                year = parts[-1]
                exams.add(exam)
                try:
                    years.add(int(year))
                except:
                    pass
        
        return jsonify({
            'exams': sorted(list(exams)),
            'years': sorted(list(years), reverse=True),
            'subjects': ['History', 'Geography', 'Polity', 'Economics', 'Science', 'General Studies']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Production entry point
if __name__ == "__main__":
    initialize_search_system()
    
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    print(f"🚀 Starting Flask API on port {port}")
    print(f"🔒 Debug mode: {debug}")
    print(f"📡 CORS enabled for: {ALLOWED_ORIGINS}")
    
    app.run(host="0.0.0.0", port=port, debug=debug)
