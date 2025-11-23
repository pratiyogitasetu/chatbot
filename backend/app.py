#!/usr/bin/env python3
"""
Updated Flask Backend for React Frontend
Flask API providing backend services for the React chat interface
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import time
import hashlib
from groq import Groq
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
import threading
import uuid
from functools import wraps
import traceback

# Optional dotenv - for local development only
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # On production, env vars are set directly

app = Flask(__name__)

# Production-ready CORS configuration
# Get allowed origins from environment variable or use defaults
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:3002').split(',')

# Add production frontend URL if in production
if os.getenv('FLASK_ENV') == 'production':
    # User should set ALLOWED_ORIGINS env var with their Vercel URL
    # Example: ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app-preview.vercel.app
    pass

CORS(app, 
     origins=ALLOWED_ORIGINS,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
     supports_credentials=True)

# Configure production logging
import logging
if os.getenv('FLASK_ENV') == 'production':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s'
    )
    app.logger.setLevel(logging.INFO)
else:
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    )
    app.logger.setLevel(logging.DEBUG)

# Global variables to store initialized components
search_components = {}
system_initialized = False
rate_limit_storage = {}

def rate_limit(max_requests=10, window_seconds=60):
    """Simple rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.remote_addr
            current_time = time.time()
            
            # Clean old entries
            if client_ip in rate_limit_storage:
                rate_limit_storage[client_ip] = [
                    timestamp for timestamp in rate_limit_storage[client_ip]
                    if current_time - timestamp < window_seconds
                ]
            else:
                rate_limit_storage[client_ip] = []
            
            # Check rate limit
            if len(rate_limit_storage[client_ip]) >= max_requests:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': f'Maximum {max_requests} requests per {window_seconds} seconds'
                }), 429
            
            # Add current request
            rate_limit_storage[client_ip].append(current_time)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.after_request
def after_request(response):
    """Add CORS headers to all responses"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f'Unhandled exception: {str(e)}')
    app.logger.error(traceback.format_exc())
    
    # In production, don't expose internal error details
    is_production = os.getenv('FLASK_ENV') == 'production'
    
    return jsonify({
        'error': 'An unexpected error occurred',
        'message': 'Please try again later' if is_production else str(e),
        'type': type(e).__name__ if not is_production else None
    }), 500

def load_api_keys():
    """Load API keys from environment variables"""
    groq_api_key = os.getenv('GROQ_API_KEY')
    pine_api_key = os.getenv('PINECONE_API_KEY')
    
    is_production = os.getenv('FLASK_ENV') == 'production'

    if not groq_api_key:
        if is_production:
            app.logger.error("❌ CRITICAL: GROQ_API_KEY not found in environment variables!")
        else:
            print("\n❌ CRITICAL: GROQ_API_KEY not found in environment variables!")
            print("   Please create a .env file with your API keys or set them in your environment.")
            print("   Example: GROQ_API_KEY=your_key_here\n")
    
    if not pine_api_key:
        if is_production:
            app.logger.error("❌ CRITICAL: PINECONE_API_KEY not found in environment variables!")
        else:
            print("\n❌ CRITICAL: PINECONE_API_KEY not found in environment variables!")
            print("   Please create a .env file with your API keys or set them in your environment.")
            print("   Example: PINECONE_API_KEY=your_key_here\n")

    return groq_api_key, pine_api_key

def initialize_search_system():
    """Initialize all components needed for search"""
    global search_components, system_initialized
    
    is_production = os.getenv('FLASK_ENV') == 'production'
    
    try:
        if is_production:
            app.logger.info("🔧 Initializing search system...")
        else:
            print("🔧 Initializing search system...")
        
        # Load API keys
        groq_api_key, pine_api_key = load_api_keys()
        
        # Initialize components only if API keys are available
        if pine_api_key:
            try:
                # Initialize Pinecone for RAG
                pc_rag = Pinecone(api_key=pine_api_key)
                rag_index_name = "ncert"
                rag_index = pc_rag.Index(rag_index_name)
                rag_model = SentenceTransformer("all-MiniLM-L6-v2")
                
                # Initialize Pinecone for MCQ
                pc_mcq = Pinecone(api_key=pine_api_key)
                mcq_index_name = 'pyq-1'
                mcq_index = pc_mcq.Index(mcq_index_name)
                mcq_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', device='cpu')
                
                search_components['rag_index'] = rag_index
                search_components['rag_model'] = rag_model
                search_components['mcq_index'] = mcq_index
                search_components['mcq_model'] = mcq_model
                
                if is_production:
                    app.logger.info("✅ Pinecone components initialized")
                else:
                    print("✅ Pinecone components initialized")
            except Exception as e:
                error_msg = f"⚠️  Failed to initialize Pinecone: {str(e)}"
                if is_production:
                    app.logger.warning(error_msg)
                else:
                    print(error_msg)
        
        # Initialize Groq client for response generation
        if groq_api_key:
            try:
                client = Groq(api_key=groq_api_key)
                search_components['client'] = client
                
                if is_production:
                    app.logger.info("✅ Groq client initialized")
                else:
                    print("✅ Groq client initialized")
            except Exception as e:
                error_msg = f"⚠️  Failed to initialize Groq: {str(e)}"
                if is_production:
                    app.logger.warning(error_msg)
                else:
                    print(error_msg)
        
        system_initialized = True
        success_msg = "✅ Search system initialized successfully"
        if is_production:
            app.logger.info(success_msg)
        else:
            print(success_msg)
        return True
    except Exception as e:
        error_msg = f"❌ Failed to initialize search system: {str(e)}"
        if is_production:
            app.logger.error(error_msg)
        else:
            print(error_msg)
        system_initialized = True  # Still mark as initialized to allow API endpoints to work
        return False

# Search functions (adapted from search_query.py)
def semantic_search(index, model, query: str, n_results: int = 2, namespace: str = ""):
    """Perform semantic search on Pinecone index"""
    query_embedding = model.encode([query]).tolist()[0]
    
    if namespace:
        results = index.query(
            vector=query_embedding,
            top_k=n_results,
            include_metadata=True,
            namespace=namespace
        )
    else:
        results = index.query(
            vector=query_embedding,
            top_k=n_results,
            include_metadata=True
        )
    return results

def get_context_with_sources(results):
    """Extract context and sources from search results with improved formatting"""
    # Create structured context with clear separation and relevance indicators
    context_parts = []
    sources = []
    
    for i, match in enumerate(results['matches'], 1):
        metadata = match.get('metadata', {})
        text_content = metadata.get('text', metadata.get('question', ''))
        score = match.get('score', 0)
        
        # Add context with relevance indicator
        context_parts.append(f"[Source {i} - Relevance: {score:.2f}]\n{text_content}")
        
        # Prepare source information with rich metadata
        source_info = {
            'source': metadata.get('source', 'Unknown'),
            'chunk': metadata.get('chunk', 'Unknown'),
            'score': round(score, 3),
            'text_preview': text_content[:200] + "..." if len(text_content) > 200 else text_content,
            'full_text': text_content,
            # Add hierarchical metadata
            'subject': metadata.get('subject', ''),
            'class': metadata.get('class', ''),
            'unit': metadata.get('unit', ''),
            'chapter': metadata.get('chapter', ''),
            'chapter_name': metadata.get('chapter_name', ''),
            'topic': metadata.get('topic', ''),
            'hierarchy': metadata.get('hierarchy', ''),
            'content': metadata.get('content', text_content)
        }
        sources.append(source_info)
    
    # Join context with clear separators
    context = "\n\n" + "="*50 + "\n\n".join(context_parts) + "\n" + "="*50
    
    return context, sources

def get_prompt(context: str, query: str):
    """Generate enhanced prompt for LLM with better instruction clarity"""
    
    # Check if context seems relevant
    context_quality = "high" if len(context.strip()) > 200 else "limited"
    
    if context_quality == "limited":
        prompt = f"""You are an intelligent educational assistant specializing in NCERT content and competitive exam preparation.

**Current Situation:** The available context is limited, but you should still try to provide helpful educational guidance.

**Instructions:**
1. Review the available context carefully for any relevant information
2. Provide the best educational response possible based on what's available
3. If the context has some relevant information, expand on it with your educational knowledge
4. Structure your response clearly and make it educational
5. If the context is truly empty or completely unrelated, acknowledge this and provide general guidance on the topic if possible

**Available Context:**
{context}

**Student Question:** {query}

**Educational Response:** Based on the available information and educational best practices, let me help you with this question."""
    else:
        prompt = f"""You are an intelligent educational assistant specializing in NCERT content and competitive exam preparation. Your task is to provide comprehensive, accurate, and helpful responses based on the provided context.

**Instructions:**
1. Use the provided context as your primary source of information
2. Provide a detailed and comprehensive answer based on the context
3. Structure your response clearly with proper formatting
4. Include specific details, examples, and explanations from the context
5. Make your response educational and easy to understand
6. If the context only partially answers the question, provide what information you can
7. Always aim to be helpful and educational

**Context from Educational Documents:**
{context}

**Student Question:** {query}

**Educational Response:**"""
    
    return prompt

@app.route("/api/health", methods=["GET"])
def health_check():
    """Enhanced health check endpoint"""
    health_status = {
        "status": "healthy",
        "system_initialized": system_initialized,
        "timestamp": time.time(),
        "version": "1.0.0"
    }
    
    # Check individual components
    components = {}
    
    if system_initialized:
        try:
            # Check Pinecone connection
            if 'rag_index' in search_components:
                rag_stats = search_components['rag_index'].describe_index_stats()
                components['rag_index'] = {
                    "status": "healthy",
                    "total_vectors": rag_stats.total_vector_count
                }
            
            if 'mcq_index' in search_components:
                mcq_stats = search_components['mcq_index'].describe_index_stats()
                components['mcq_index'] = {
                    "status": "healthy", 
                    "total_vectors": mcq_stats.total_vector_count
                }
            
            # Check models
            if 'rag_model' in search_components:
                components['rag_model'] = {"status": "healthy"}
            if 'mcq_model' in search_components:
                components['mcq_model'] = {"status": "healthy"}
            if 'client' in search_components:
                components['groq_client'] = {"status": "healthy"}
                
        except Exception as e:
            health_status["status"] = "degraded"
            health_status["error"] = str(e)
    else:
        health_status["status"] = "initializing"
    
    health_status["components"] = components
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return jsonify(health_status), status_code

@app.route("/api/search", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def search():
    """Handle search queries - return RAG response and related MCQs separately"""
    global search_components
    
    if not system_initialized:
        return jsonify({
            "error": "Search system not initialized",
            "message": "Backend is starting up or API keys are not configured. Please check server logs."
        }), 500
    
    # Check if essential components are available
    if 'client' not in search_components:
        return jsonify({
            "error": "AI service not available",
            "message": "GROQ_API_KEY is not configured. Please set your API key in the .env file."
        }), 500
    
    if 'rag_index' not in search_components:
        return jsonify({
            "error": "Search index not available",
            "message": "PINECONE_API_KEY is not configured. Please set your API key in the .env file."
        }), 500
    
    data = request.json
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400
    
    query = data.get("query", "")
    n_results = data.get("n_results", 5)  # Increased from 3 to 5 for better context
    namespace = data.get("namespace", "")
    mcq_threshold = data.get("mcq_threshold", 0.25)  # Slightly increased for better MCQ matching
    mcq_limit = data.get("mcq_limit", 8)  # Increased from 5 to 8 for more PYQs
    
    # Input validation
    if not query.strip():
        return jsonify({"error": "Query cannot be empty"}), 400
    
    if len(query) > 1000:
        return jsonify({"error": "Query too long (max 1000 characters)"}), 400
    
    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400
    
    try:
        # Set a timeout for the entire operation
        start_time = time.time()
        timeout_seconds = 30  # 30 second timeout
        
        # RAG search for contextual answer
        if namespace and namespace != "all":
            rag_results = semantic_search(
                search_components['rag_index'], 
                search_components['rag_model'], 
                query, 
                n_results, 
                namespace
            )
            context, sources = get_context_with_sources(rag_results)
        else:
            # Search all namespaces
            context, sources = search_all_namespaces(
                search_components['rag_index'],
                search_components['rag_model'],
                query,
                n_results
            )
        
        # Check timeout
        if time.time() - start_time > timeout_seconds:
            return jsonify({"error": "Request timeout"}), 408
        
        # Debug logging for context quality
        print(f"DEBUG: Retrieved {len(sources)} sources for query: '{query[:50]}...'")
        print(f"DEBUG: Context length: {len(context)} characters")
        if sources:
            print(f"DEBUG: Best match score: {sources[0]['score']}")
        
        # Enhance context if it's too short or has low relevance scores
        if len(context.strip()) < 100 or (sources and sources[0]['score'] < 0.3):
            # Try searching with relaxed parameters
            print("DEBUG: Context appears limited, trying broader search...")
            try:
                broader_results = semantic_search(
                    search_components['rag_index'], 
                    search_components['rag_model'], 
                    query, 
                    n_results + 3,  # Get more results
                    ""  # Search all namespaces
                )
                broader_context, broader_sources = get_context_with_sources(broader_results)
                if len(broader_context) > len(context):
                    context = broader_context
                    sources = broader_sources
                    print(f"DEBUG: Using broader context with {len(broader_sources)} sources")
            except Exception as e:
                print(f"DEBUG: Broader search failed: {e}")
        
        # Generate RAG response using Groq with optimized parameters
        prompt = get_prompt(context, query)
        chat_completion = search_components['client'].chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert educational assistant for NCERT content and competitive exam preparation. Provide detailed, accurate, and well-structured responses to help students learn effectively."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.1-8b-instant",  # Reliable and fast Groq model
            max_tokens=1500,  # Increased for more detailed responses
            temperature=0.3,  # Lower temperature for more focused, accurate responses
            top_p=0.9,       # Better coherence
        )
        rag_response = chat_completion.choices[0].message.content
        
        # MCQ search for related questions
        mcq_results = query_mcq(
            search_components['mcq_index'],
            search_components['mcq_model'],
            query,
            mcq_threshold,
            mcq_limit
        )
        
        return jsonify({
            "rag_response": rag_response,
            "sources": sources,
            "mcq_results": mcq_results,
            "query": query,
            "namespace_used": namespace if namespace else "all",
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"Error in search: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/total-questions", methods=["GET"])
def get_total_questions():
    """Get total number of questions in the MCQ database"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        # Get stats from the MCQ index
        mcq_index = search_components.get('mcq_index')
        if not mcq_index:
            return jsonify({"error": "MCQ index not available"}), 500
        
        # Get index stats to find total vector count
        stats = mcq_index.describe_index_stats()
        total_questions = stats.get('total_vector_count', 0)
        
        return jsonify({
            "total_questions": total_questions,
            "status": "success",
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"Error getting total questions: {str(e)}")
        return jsonify({
            "error": f"Failed to get total questions: {str(e)}",
            "total_questions": 0
        }), 500

@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get system statistics"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        # Get stats from the MCQ index
        mcq_index = search_components.get('mcq_index')
        rag_index = search_components.get('rag_index')
        
        total_questions = 0
        total_books = 0
        
        if mcq_index:
            mcq_stats = mcq_index.describe_index_stats()
            total_questions = mcq_stats.get('total_vector_count', 0)
        
        if rag_index:
            rag_stats = rag_index.describe_index_stats()
            # RAG index contains document chunks, approximate books by dividing by average chunks per book
            total_chunks = rag_stats.get('total_vector_count', 0)
            # Estimate books based on namespaces (5 main subjects)
            namespaces = rag_stats.get('namespaces', {})
            total_books = len(namespaces)
        
        return jsonify({
            "total_questions": total_questions,
            "total_books": total_books,
            "total_users": 1,  # Single user system for now
            "avg_response_time": "1.2s",  # Typical response time
            "system_status": "operational",
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"Error getting stats: {str(e)}")
        return jsonify({
            "error": f"Failed to get stats: {str(e)}",
            "total_questions": 0,
            "total_books": 0,
            "total_users": 0,
            "avg_response_time": "N/A",
            "system_status": "error"
        }), 500

@app.route("/api/questions", methods=["GET"])
def get_questions():
    """Get questions from the MCQ database with filtering"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    exam_filter = request.args.get('exam', 'all')
    subject_filter = request.args.get('subject', 'all')
    limit = int(request.args.get('limit', 50))
    
    try:
        # Get questions from MCQ index
        mcq_index = search_components.get('mcq_index')
        if not mcq_index:
            return jsonify({"error": "MCQ index not available"}), 500
        
        # Get all available namespaces dynamically from index stats
        stats = mcq_index.describe_index_stats()
        pyq_namespaces = list(stats.namespaces.keys()) if stats.namespaces else ["CIVIL SERVICES EXAMS", "BANKING EXAMS", "SCHOOL EXAMS"]
        all_questions = []
        
        # Query for questions - using dummy query to get random questions
        dummy_query = search_components['mcq_model'].encode(["sample question"]).tolist()[0]
        
        for namespace in pyq_namespaces:
            try:
                # Get questions from each namespace
                results = mcq_index.query(
                    vector=dummy_query,
                    top_k=min(limit * 2, 200),  # Get extra for filtering
                    include_metadata=True,
                    namespace=namespace
                )
                
                for i, match in enumerate(results['matches']):
                    metadata = match.get('metadata', {})
                    
                    # Extract data from full_json_str field (new structure)
                    full_question_data = {}
                    if 'full_json_str' in metadata:
                        try:
                            import json
                            full_question_data = json.loads(metadata['full_json_str'])
                        except (json.JSONDecodeError, Exception) as e:
                            print(f"⚠️ Error parsing full_json_str: {e}")
                            full_question_data = {}
                    
                    # Extract required fields - prioritize full_json_str, fallback to metadata
                    question_text = full_question_data.get('question', metadata.get('question', ''))
                    exam_name = full_question_data.get('exam_name', metadata.get('exam_name', 'Unknown'))
                    exam_year = full_question_data.get('exam_year', metadata.get('exam_year', 'Unknown'))
                    exam_term = full_question_data.get('exam_term', metadata.get('exam_term', ''))
                    subject = full_question_data.get('subject', metadata.get('subject', 'Unknown'))
                    explanation = full_question_data.get('explanation', metadata.get('explanation', ''))
                    correct_option = full_question_data.get('correct_option', metadata.get('correct_option', ''))
                    correct_answer = full_question_data.get('correct_answer', metadata.get('correct_answer', ''))
                    
                    # Get options
                    options_dict = full_question_data.get('options', {})
                    if not options_dict:
                        # Fallback: reconstruct from individual metadata fields
                        options_dict = {}
                        if metadata.get('option_a'):
                            options_dict['a'] = metadata.get('option_a')
                        if metadata.get('option_b'):
                            options_dict['b'] = metadata.get('option_b')
                        if metadata.get('option_c'):
                            options_dict['c'] = metadata.get('option_c')
                        if metadata.get('option_d'):
                            options_dict['d'] = metadata.get('option_d')
                    
                    # Convert options dict to array for frontend compatibility
                    option_keys = ['a', 'b', 'c', 'd']
                    options_array = []
                    for key in option_keys:
                        if key in options_dict:
                            options_array.append(options_dict[key])
                    
                    # Get correct answer index
                    correct_answer_index = None
                    if correct_option and correct_option in option_keys:
                        correct_answer_index = option_keys.index(correct_option)
                    
                    # Apply filters
                    if exam_filter != 'all' and exam_name.lower() != exam_filter.lower():
                        continue
                    if subject_filter != 'all' and subject.lower() != subject_filter.lower():
                        continue
                    
                    # Generate a unique ID using timestamp and question hash
                    question_hash = hashlib.md5(question_text.encode()).hexdigest()[:8]
                    unique_id = f"{int(time.time() * 1000)}_{question_hash}_{i}_{namespace}"
                    
                    # Extract question data with required fields only
                    question_data = {
                        "id": unique_id,
                        "question": question_text,
                        "options": options_array,
                        "correct_option": correct_option,
                        "correct_answer": correct_answer_index,
                        "correct_answer_text": correct_answer,
                        "exam_name": exam_name,
                        "exam_year": exam_year,
                        "year": exam_year,
                        "exam_term": exam_term,
                        "term": exam_term,
                        "subject": subject,
                        "explanation": explanation,
                        "metadata": {
                            "exam": exam_name,
                            "exam_name": exam_name,
                            "exam_year": exam_year,
                            "exam_term": exam_term,
                            "term": exam_term,
                            "year": exam_year,
                            "subject": subject
                        }
                    }
                    all_questions.append(question_data)
                    
                    if len(all_questions) >= limit:
                        break
                        
            except Exception as e:
                print(f"⚠️ Error querying namespace {namespace}: {str(e)}")
                continue
        
        # Limit to requested number
        questions = all_questions[:limit]
        
        return jsonify({
            "questions": questions,
            "total": len(questions),
            "filters": {
                "exam": exam_filter,
                "subject": subject_filter
            },
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"Error getting questions: {str(e)}")
        return jsonify({
            "error": f"Failed to get questions: {str(e)}",
            "questions": [],
            "total": 0
        }), 500

@app.route("/api/filters", methods=["GET"])
def get_filter_options():
    """Get unique exam names and subjects from MCQ database for filter dropdowns"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        # Get unique exams and subjects from MCQ index
        mcq_index = search_components.get('mcq_index')
        if not mcq_index:
            return jsonify({"error": "MCQ index not available"}), 500
        
        # Get all available namespaces dynamically from index stats
        stats = mcq_index.describe_index_stats()
        pyq_namespaces = list(stats.namespaces.keys()) if stats.namespaces else ["CIVIL SERVICES EXAMS", "BANKING EXAMS", "SCHOOL EXAMS"]
        unique_exams = set()
        unique_subjects = set()
        
        # Query for questions from each namespace to extract metadata
        dummy_query = search_components['mcq_model'].encode(["filter query"]).tolist()[0]
        
        for namespace in pyq_namespaces:
            try:
                # Get questions from each namespace
                results = mcq_index.query(
                    vector=dummy_query,
                    top_k=1000,  # Get many results to extract all unique values
                    include_metadata=True,
                    namespace=namespace
                )
                
                for match in results['matches']:
                    metadata = match.get('metadata', {})
                    
                    # Extract data from full_json_str field (new structure)
                    full_question_data = {}
                    if 'full_json_str' in metadata:
                        try:
                            import json
                            full_question_data = json.loads(metadata['full_json_str'])
                        except (json.JSONDecodeError, Exception):
                            full_question_data = {}
                    
                    # Extract exam name
                    exam_name = full_question_data.get('exam_name', metadata.get('exam_name', ''))
                    if exam_name and exam_name.strip():
                        unique_exams.add(exam_name.strip())
                    
                    # Extract subject
                    subject = full_question_data.get('subject', metadata.get('subject', ''))
                    if subject and subject.strip():
                        unique_subjects.add(subject.strip())
                        
            except Exception as e:
                print(f"⚠️ Error querying namespace {namespace} for filters: {str(e)}")
                continue
        
        # Convert to sorted lists for consistent ordering
        exams_list = sorted(list(unique_exams))
        subjects_list = sorted(list(unique_subjects))
        
        return jsonify({
            "exams": exams_list,
            "subjects": subjects_list,
            "total_exams": len(exams_list),
            "total_subjects": len(subjects_list),
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"Error getting filter options: {str(e)}")
        return jsonify({
            "error": f"Failed to get filter options: {str(e)}",
            "exams": [],
            "subjects": []
        }), 500

@app.route("/api/books", methods=["GET"])
def get_books():
    """Get inserted books/subjects from Pinecone index statistics"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        # Get books from RAG index statistics
        rag_index = search_components.get('rag_index')
        if not rag_index:
            return jsonify({"error": "RAG index not available"}), 500
        
        # Get index statistics to see what namespaces exist
        stats = rag_index.describe_index_stats()
        namespaces = stats.namespaces if stats.namespaces else {}
        
        books_list = []
        
        # Map of known subjects/namespaces to display names
        subject_info = {
            "geography": {
                "title": "NCERT Geography",
                "description": "Complete Geography curriculum from NCERT",
                "classes": ["6th", "10th", "11th", "12th"],
                "topics": ["Physical Geography", "Climate", "Solar System", "Natural Vegetation", "Weather Systems"]
            },
            "history": {
                "title": "NCERT History", 
                "description": "Complete History curriculum from NCERT",
                "classes": ["6th", "10th", "11th", "12th"],
                "topics": ["Ancient History", "Medieval History", "Modern History", "Freedom Struggle"]
            },
            "polity": {
                "title": "NCERT Political Science",
                "description": "Complete Polity curriculum from NCERT", 
                "classes": ["6th", "10th", "11th", "12th"],
                "topics": ["Constitution", "Government", "Democracy", "Elections", "Rights"]
            },
            "economics": {
                "title": "NCERT Economics",
                "description": "Complete Economics curriculum from NCERT",
                "classes": ["6th", "10th", "11th", "12th"], 
                "topics": ["Microeconomics", "Macroeconomics", "Development", "Globalization"]
            },
            "science": {
                "title": "NCERT Science",
                "description": "Complete Science curriculum from NCERT",
                "classes": ["6th", "7th", "8th", "9th", "10th"],
                "topics": ["Physics", "Chemistry", "Biology", "Environmental Science"]
            }
        }
        
        # Create book entries for each namespace that has data
        for namespace, namespace_stats in namespaces.items():
            vector_count = namespace_stats.vector_count
            if vector_count > 0:
                subject_data = subject_info.get(namespace, {
                    "title": f"NCERT {namespace.title()}",
                    "description": f"Educational content for {namespace}",
                    "classes": ["Multiple Classes"],
                    "topics": ["Various Topics"]
                })
                
                book_data = {
                    "title": subject_data["title"],
                    "source": f"NCERT {namespace.title()}",
                    "namespace": namespace,
                    "description": subject_data["description"],
                    "total_chunks": vector_count,
                    "classes": subject_data["classes"],
                    "topics": subject_data["topics"],
                    "status": "✅ Indexed",
                    "last_updated": time.strftime("%Y-%m-%d", time.localtime())
                }
                books_list.append(book_data)
        
        # Add information about available but not indexed subjects
        all_subjects = ["geography", "history", "polity", "economics", "science"]
        indexed_subjects = list(namespaces.keys())
        
        for subject in all_subjects:
            if subject not in indexed_subjects:
                subject_data = subject_info[subject]
                book_data = {
                    "title": subject_data["title"],
                    "source": f"NCERT {subject.title()}",
                    "namespace": subject,
                    "description": subject_data["description"],
                    "total_chunks": 0,
                    "classes": subject_data["classes"],
                    "topics": subject_data["topics"],
                    "status": "⏳ Available (Not Indexed)",
                    "last_updated": "Not indexed yet"
                }
                books_list.append(book_data)
        
        return jsonify({
            "books": books_list,
            "total": len(books_list),
            "indexed_count": len([b for b in books_list if b["total_chunks"] > 0]),
            "available_count": len([b for b in books_list if b["total_chunks"] == 0]),
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"Error getting books: {str(e)}")
        return jsonify({
            "error": f"Failed to get books: {str(e)}",
            "books": [],
            "total": 0
        }), 500

@app.route("/api/inserted-pyqs", methods=["GET"])
def get_inserted_pyqs():
    """Get inserted PYQs from MCQ index statistics with hierarchical exam structure"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        # Get PYQs from MCQ index statistics
        mcq_index = search_components.get('mcq_index')
        if not mcq_index:
            return jsonify({"error": "MCQ index not available"}), 500
        
        # Get index statistics to see what namespaces exist
        stats = mcq_index.describe_index_stats()
        namespaces = stats.namespaces if stats.namespaces else {}
        
        pyq_list = []
        total_questions = 0
        
        # For each namespace with actual data, extract hierarchical exam information
        for namespace, namespace_stats in namespaces.items():
            vector_count = namespace_stats.vector_count
            if vector_count > 0:
                # Query the namespace to get detailed exam information
                try:
                    dummy_query = search_components['mcq_model'].encode(["sample"]).tolist()[0]
                    results = mcq_index.query(
                        vector=dummy_query,
                        top_k=min(vector_count, 1000),  # Get all or up to 1000 questions
                        include_metadata=True,
                        namespace=namespace
                    )
                    
                    # Create hierarchical structure: main_exam -> sub_exam -> year -> term
                    main_exam_structure = {}
                    
                    for match in results['matches']:
                        metadata = match.get('metadata', {})
                        
                        # Extract data from full_json_str field
                        full_question_data = {}
                        if 'full_json_str' in metadata:
                            try:
                                import json
                                full_question_data = json.loads(metadata['full_json_str'])
                            except (json.JSONDecodeError, Exception):
                                full_question_data = {}
                        
                        # Extract exam information
                        main_exam = namespace  # Use namespace as main exam (e.g., "SCHOOL EXAMS")
                        sub_exam = full_question_data.get('exam_name', metadata.get('exam_name', 'Unknown Sub Exam'))
                        year = full_question_data.get('exam_year', metadata.get('exam_year', 'Unknown'))
                        term = full_question_data.get('exam_term', metadata.get('exam_term', ''))
                        
                        # Build hierarchical structure
                        if main_exam not in main_exam_structure:
                            main_exam_structure[main_exam] = {}
                        
                        if sub_exam not in main_exam_structure[main_exam]:
                            main_exam_structure[main_exam][sub_exam] = {}
                        
                        if year not in main_exam_structure[main_exam][sub_exam]:
                            main_exam_structure[main_exam][sub_exam][year] = {}
                        
                        if term not in main_exam_structure[main_exam][sub_exam][year]:
                            main_exam_structure[main_exam][sub_exam][year][term] = 0
                        
                        main_exam_structure[main_exam][sub_exam][year][term] += 1
                    
                    # Convert hierarchical structure to flat list for display
                    for main_exam, sub_exams in main_exam_structure.items():
                        for sub_exam, years in sub_exams.items():
                            # Collect all years and terms for this sub exam
                            available_years = []
                            available_terms = []
                            sub_exam_questions = 0
                            
                            for year, terms in years.items():
                                if year and year != 'Unknown':
                                    available_years.append(year)
                                for term, question_count in terms.items():
                                    if term and term.strip():
                                        available_terms.append(term)
                                    sub_exam_questions += question_count
                            
                            # Remove duplicates and sort
                            available_years = sorted(list(set(available_years)))
                            available_terms = sorted(list(set([t for t in available_terms if t.strip()])))
                            
                            pyq_data = {
                                "title": f"{sub_exam}",
                                "main_exam": main_exam,
                                "sub_exam": sub_exam,
                                "years": available_years,
                                "terms": available_terms if available_terms else [],
                                "total_questions": sub_exam_questions,
                                "namespace": namespace,
                                "status": "✅ Active",
                                "last_updated": time.strftime("%Y-%m-%d", time.localtime())
                            }
                            pyq_list.append(pyq_data)
                            total_questions += sub_exam_questions
                        
                except Exception as e:
                    print(f"⚠️ Error extracting details from namespace {namespace}: {str(e)}")
                    # Fallback to basic info
                    pyq_data = {
                        "title": f"{namespace}",
                        "main_exam": namespace,
                        "sub_exam": "Various Exams",
                        "years": [],
                        "terms": [],
                        "total_questions": vector_count,
                        "namespace": namespace,
                        "status": "✅ Active",
                        "last_updated": time.strftime("%Y-%m-%d", time.localtime())
                    }
                    pyq_list.append(pyq_data)
                    total_questions += vector_count
        
        return jsonify({
            "inserted_pyqs": pyq_list,
            "total": len(pyq_list),
            "indexed_count": len(pyq_list),
            "available_count": 0,
            "total_questions": total_questions,
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"Error getting inserted PYQs: {str(e)}")
        return jsonify({
            "error": f"Failed to get inserted PYQs: {str(e)}",
            "inserted_pyqs": [],
            "total": 0
        }), 500

def search_all_namespaces(pinecone_index, model, query: str, n_chunks: int = 2):
    """Search across all namespaces and return best results"""
    namespaces = ["geography", "polity", "history", "economics", "science"]
    all_results = []
    
    for namespace in namespaces:
        try:
            results = semantic_search(pinecone_index, model, query, n_chunks, namespace)
            if results['matches']:
                for match in results['matches']:
                    match['namespace'] = namespace
                all_results.extend(results['matches'])
        except Exception as e:
            print(f"⚠️ Error searching namespace {namespace}: {str(e)}")
    
    # Sort by relevance score and take top results
    all_results.sort(key=lambda x: x['score'], reverse=True)
    top_results = all_results[:n_chunks]
    formatted_results = {'matches': top_results}
    context, sources = get_context_with_sources(formatted_results)
    
    return context, sources

def query_mcq(mcq_index, mcq_model, query_text, similarity_threshold=0.2, top_k=5):
    """Query MCQ index for relevant questions across all namespaces"""
    try:
        query_embedding = mcq_model.encode(query_text).tolist()
        
        # Get all available namespaces dynamically from index stats
        stats = mcq_index.describe_index_stats()
        pyq_namespaces = list(stats.namespaces.keys()) if stats.namespaces else ["CIVIL SERVICES EXAMS", "BANKING EXAMS", "SCHOOL EXAMS"]
        all_results = []
        
        for namespace in pyq_namespaces:
            try:
                response = mcq_index.query(
                    vector=query_embedding, 
                    top_k=20,  # Get more results per namespace to ensure variety
                    include_metadata=True,
                    namespace=namespace
                )
                
                # Add namespace info to results
                for match in response['matches']:
                    match['namespace'] = namespace
                    all_results.append(match)
            except Exception as e:
                print(f"⚠️ Error searching namespace {namespace}: {str(e)}")
                continue
        
        # Sort all results by score
        all_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Filter results by similarity threshold
        filtered_results = [
            result for result in all_results if result['score'] >= similarity_threshold
        ]
        
        # Format MCQ results for frontend
        formatted_mcqs = []
        for result in filtered_results[:top_k]:
            metadata = result['metadata']
            
            # Extract data from full_json_str field (new structure)
            full_question_data = {}
            if 'full_json_str' in metadata:
                try:
                    import json
                    full_question_data = json.loads(metadata['full_json_str'])
                except (json.JSONDecodeError, Exception) as e:
                    print(f"⚠️ Error parsing full_json_str: {e}")
                    # Fallback to individual metadata fields
                    full_question_data = {}
            
            # Extract required fields - prioritize full_json_str, fallback to metadata
            question_text = full_question_data.get('question', metadata.get('question', ''))
            if not question_text and 'text' in metadata:
                question_text = metadata['text'].split('Options:')[0].replace('Q:', '').strip() if 'Options:' in metadata['text'] else metadata['text']
            
            # Get options - prioritize full_json_str structure
            options_dict = full_question_data.get('options', {})
            if not options_dict:
                # Fallback: reconstruct from individual metadata fields
                if metadata.get('option_a'):
                    options_dict['a'] = metadata.get('option_a')
                if metadata.get('option_b'):
                    options_dict['b'] = metadata.get('option_b')
                if metadata.get('option_c'):
                    options_dict['c'] = metadata.get('option_c')
                if metadata.get('option_d'):
                    options_dict['d'] = metadata.get('option_d')
            
            # Convert options dict to array for frontend compatibility
            option_keys = ['a', 'b', 'c', 'd']
            options_array = []
            for key in option_keys:
                if key in options_dict:
                    options_array.append(options_dict[key])
            
            # Get correct option key and convert to index
            correct_option = full_question_data.get('correct_option', metadata.get('correct_option', ''))
            correct_answer_index = None
            if correct_option and correct_option in option_keys:
                correct_answer_index = option_keys.index(correct_option)
            
            # Get correct answer text
            correct_answer_text = full_question_data.get('correct_answer', metadata.get('correct_answer', ''))
            if not correct_answer_text and correct_option and options_dict and correct_option in options_dict:
                correct_answer_text = options_dict[correct_option]
            
            # Extract other required fields
            exam_name = full_question_data.get('exam_name', metadata.get('exam_name', 'Unknown'))
            exam_year = full_question_data.get('exam_year', metadata.get('exam_year', 'Unknown'))
            exam_term = full_question_data.get('exam_term', metadata.get('exam_term', ''))
            subject = full_question_data.get('subject', metadata.get('subject', 'Unknown'))
            explanation = full_question_data.get('explanation', metadata.get('explanation', ''))
            
            # Generate a unique ID using timestamp and question hash
            question_hash = hashlib.md5(question_text.encode()).hexdigest()[:8]
            unique_id = f"{int(time.time() * 1000)}_{question_hash}"
            
            formatted_mcqs.append({
                'id': unique_id,
                'question': question_text,
                'options': options_array,  # Array format: ["option1", "option2", ...]
                'correct_option': correct_option,  # Key like "a", "b", "c", "d"
                'correct_answer': correct_answer_index,  # Index (0, 1, 2, 3) for frontend
                'correct_answer_text': correct_answer_text,  # Actual answer text
                'exam_name': exam_name,
                'year': exam_year,
                'exam_year': exam_year,
                'term': exam_term,
                'exam_term': exam_term,
                'subject': subject,
                'metadata': {
                    'exam_name': exam_name,
                    'exam_term': exam_term,
                    'exam_year': exam_year,
                    'subject': subject,
                    'exam': exam_name,
                    'term': exam_term,
                    'year': exam_year
                },
                'explanation': explanation,
                'topic': full_question_data.get('topic', metadata.get('topic', '')),
                'similarity': round(result['score'], 3)
            })
        
        return formatted_mcqs
    except Exception as e:
        print(f"Error querying MCQs: {str(e)}")
        return []

# Dashboard tracking storage (in production, use a proper database)
user_stats = {
    'total_chats': 0,
    'total_questions': 0,
    'total_mcq_attempted': 0,
    'mcq_correct': 0,
    'mcq_wrong': 0,
    'subjects': {
        'Geography': 0,
        'Polity': 0,
        'History': 0,
        'Economics': 0,
        'Science': 0,
        'Others': 0
    },
    'achievements': [],
    'goals': [
        {'id': 1, 'title': 'Daily Questions', 'current': 0, 'target': 10, 'type': 'daily'},
        {'id': 2, 'title': 'Weekly Sessions', 'current': 0, 'target': 7, 'type': 'weekly'},
        {'id': 3, 'title': 'Subject Coverage', 'current': 0, 'target': 5, 'type': 'subjects'}
    ],
    'activities': []
}

@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # Calculate accuracy
        total_attempted = user_stats['total_mcq_attempted']
        accuracy = 0
        if total_attempted > 0:
            accuracy = round((user_stats['mcq_correct'] / total_attempted) * 100, 1)
        
        return jsonify({
            'totalChats': user_stats['total_chats'],
            'totalQuestions': user_stats['total_questions'],
            'totalMcqAttempted': user_stats['total_mcq_attempted'],
            'mcqCorrect': user_stats['mcq_correct'],
            'mcqWrong': user_stats['mcq_wrong'],
            'mcqAccuracy': accuracy,
            'timestamp': time.time()
        }), 200
    except Exception as e:
        print(f"Error getting dashboard stats: {str(e)}")
        return jsonify({
            'error': f'Failed to get dashboard stats: {str(e)}',
            'totalChats': 0,
            'totalQuestions': 0,
            'totalMcqAttempted': 0,
            'mcqCorrect': 0,
            'mcqWrong': 0,
            'mcqAccuracy': 0
        }), 500

@app.route("/api/dashboard/subjects", methods=["GET"])
def get_subject_stats():
    """Get subject-wise statistics"""
    try:
        subjects = []
        colors = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280']
        
        for i, (subject, count) in enumerate(user_stats['subjects'].items()):
            subjects.append({
                'name': subject,
                'questions': count,
                'color': colors[i % len(colors)]
            })
        
        return jsonify({
            'subjects': subjects,
            'timestamp': time.time()
        }), 200
    except Exception as e:
        print(f"Error getting subject stats: {str(e)}")
        return jsonify({
            'subjects': [],
            'error': str(e)
        }), 500

@app.route("/api/dashboard/achievements", methods=["GET"])
def get_achievements():
    """Get user achievements"""
    try:
        return jsonify({
            'achievements': user_stats['achievements'],
            'timestamp': time.time()
        }), 200
    except Exception as e:
        print(f"Error getting achievements: {str(e)}")
        return jsonify({
            'achievements': [],
            'error': str(e)
        }), 500

@app.route("/api/dashboard/goals", methods=["GET"])
def get_learning_goals():
    """Get learning goals and progress"""
    try:
        # Update goals with current stats
        goals = user_stats['goals'].copy()
        for goal in goals:
            if goal['type'] == 'daily':
                # For demo, use total questions
                goal['current'] = min(user_stats['total_questions'], goal['target'])
            elif goal['type'] == 'weekly':
                # For demo, use total chats
                goal['current'] = min(user_stats['total_chats'], goal['target'])
            elif goal['type'] == 'subjects':
                # Count how many subjects have been used
                subjects_used = sum(1 for count in user_stats['subjects'].values() if count > 0)
                goal['current'] = min(subjects_used, goal['target'])
        
        return jsonify({
            'goals': goals,
            'timestamp': time.time()
        }), 200
    except Exception as e:
        print(f"Error getting learning goals: {str(e)}")
        return jsonify({
            'goals': [],
            'error': str(e)
        }), 500

@app.route("/api/dashboard/activity", methods=["GET"])
def get_recent_activity():
    """Get recent user activity"""
    try:
        # Return last 10 activities
        recent_activities = user_stats['activities'][-10:] if user_stats['activities'] else []
        return jsonify({
            'activities': recent_activities,
            'timestamp': time.time()
        }), 200
    except Exception as e:
        print(f"Error getting recent activity: {str(e)}")
        return jsonify({
            'activities': [],
            'error': str(e)
        }), 500

@app.route("/api/dashboard/track", methods=["POST"])
def track_user_interaction():
    """Track user interaction and update stats"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        interaction_type = data.get('type', '')
        interaction_data = data.get('data', {})
        timestamp = data.get('timestamp', time.time())
        
        # Update stats based on interaction type
        if interaction_type == 'chat':
            user_stats['total_chats'] += 1
            user_stats['activities'].append({
                'type': 'chat',
                'description': 'Started a new conversation',
                'timestamp': timestamp
            })
        elif interaction_type == 'search':
            user_stats['total_questions'] += 1
            subject = interaction_data.get('subject', 'Others')
            if subject in user_stats['subjects']:
                user_stats['subjects'][subject] += 1
            else:
                user_stats['subjects']['Others'] += 1
            
            user_stats['activities'].append({
                'type': 'search',
                'description': f'Asked a question about {subject}',
                'timestamp': timestamp
            })
            
            # Check for achievements
            check_achievements()
            
        elif interaction_type == 'mcq_attempt':
            user_stats['total_mcq_attempted'] += 1
            is_correct = interaction_data.get('correct', False)
            if is_correct:
                user_stats['mcq_correct'] += 1
            else:
                user_stats['mcq_wrong'] += 1
            
            user_stats['activities'].append({
                'type': 'mcq',
                'description': f'Answered MCQ {"correctly" if is_correct else "incorrectly"}',
                'timestamp': timestamp
            })
            
            # Check for achievements
            check_achievements()
        
        # Keep only last 50 activities
        if len(user_stats['activities']) > 50:
            user_stats['activities'] = user_stats['activities'][-50:]
        
        return jsonify({
            'success': True,
            'message': 'Interaction tracked successfully'
        }), 200
        
    except Exception as e:
        print(f"Error tracking interaction: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route("/api/dashboard/update-stats", methods=["POST"])
def update_user_stats():
    """Update user statistics"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update stats with provided data
        for key, value in data.items():
            if key in user_stats and isinstance(value, (int, float)):
                user_stats[key] = value
        
        return jsonify({
            'success': True,
            'message': 'Stats updated successfully'
        }), 200
        
    except Exception as e:
        print(f"Error updating stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def check_achievements():
    """Check and add new achievements based on current stats"""
    try:
        achievements_to_add = []
        
        # First question achievement
        if user_stats['total_questions'] == 1 and not any(a['id'] == 'first_question' for a in user_stats['achievements']):
            achievements_to_add.append({
                'id': 'first_question',
                'title': 'First Question!',
                'description': 'Asked your first question',
                'icon': '🎯',
                'date': 'Just now'
            })
        
        # 10 questions milestone
        if user_stats['total_questions'] >= 10 and not any(a['id'] == 'ten_questions' for a in user_stats['achievements']):
            achievements_to_add.append({
                'id': 'ten_questions',
                'title': 'Curious Mind!',
                'description': 'Asked 10 questions',
                'icon': '🧠',
                'date': 'Just now'
            })
        
        # First MCQ attempt
        if user_stats['total_mcq_attempted'] == 1 and not any(a['id'] == 'first_mcq' for a in user_stats['achievements']):
            achievements_to_add.append({
                'id': 'first_mcq',
                'title': 'Quiz Starter!',
                'description': 'Attempted your first MCQ',
                'icon': '📝',
                'date': 'Just now'
            })
        
        # 50% accuracy with at least 10 MCQs
        if user_stats['total_mcq_attempted'] >= 10:
            accuracy = (user_stats['mcq_correct'] / user_stats['total_mcq_attempted']) * 100
            if accuracy >= 50 and not any(a['id'] == 'half_accurate' for a in user_stats['achievements']):
                achievements_to_add.append({
                    'id': 'half_accurate',
                    'title': 'Getting Better!',
                    'description': 'Achieved 50% MCQ accuracy',
                    'icon': '📈',
                    'date': 'Just now'
                })
        
        # Add new achievements
        user_stats['achievements'].extend(achievements_to_add)
        
        # Keep only last 20 achievements
        if len(user_stats['achievements']) > 20:
            user_stats['achievements'] = user_stats['achievements'][-20:]
            
    except Exception as e:
        print(f"Error checking achievements: {str(e)}")

# ============================================
# PYQ Practice API Endpoints
# ============================================

@app.route("/api/pyq/search", methods=["POST"])
@rate_limit(max_requests=30, window_seconds=60)
def search_pyq_questions():
    """Search and filter PYQ questions"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        data = request.get_json()
        query = data.get('query', '')
        exam_filter = data.get('exam', None)
        subject_filter = data.get('subject', None)
        year_filter = data.get('year', None)
        limit = data.get('limit', 50)
        
        mcq_index = search_components.get('mcq_index')
        mcq_model = search_components.get('mcq_model')
        
        if not mcq_index or not mcq_model:
            return jsonify({"error": "MCQ system not available"}), 500
        
        # Get all available namespaces
        stats = mcq_index.describe_index_stats()
        namespaces = list(stats.namespaces.keys()) if stats.namespaces else []
        
        all_questions = []
        
        # Limit namespaces to query based on filters to speed up
        target_namespaces = namespaces
        if exam_filter and exam_filter != 'all':
            # Try to match namespace to exam filter
            target_namespaces = [ns for ns in namespaces if exam_filter.lower().replace('_', ' ') in ns.lower()]
            if not target_namespaces:
                target_namespaces = namespaces  # fallback to all if no match
        
        # Query each namespace (limited for performance)
        for namespace in target_namespaces[:5]:  # Limit to first 5 namespaces for speed
            try:
                # Use query text if provided, otherwise use dummy query
                if query:
                    query_embedding = mcq_model.encode(query).tolist()
                else:
                    query_embedding = mcq_model.encode("general knowledge question").tolist()
                
                results = mcq_index.query(
                    vector=query_embedding,
                    top_k=min(limit + 10, 100),  # Reduced from 500 to 100 for faster queries
                    include_metadata=True,
                    namespace=namespace
                )
                
                for match in results['matches']:
                    metadata = match.get('metadata', {})
                    
                    # Parse full_json_str if available
                    full_data = {}
                    if 'full_json_str' in metadata:
                        try:
                            full_data = json.loads(metadata['full_json_str'])
                        except:
                            pass
                    
                    # Extract fields
                    exam_name = full_data.get('exam_name', metadata.get('exam_name', ''))
                    exam_year = str(full_data.get('exam_year', metadata.get('exam_year', '')))
                    exam_term = full_data.get('exam_term', metadata.get('exam_term', ''))
                    subject = full_data.get('subject', metadata.get('subject', ''))
                    question_text = full_data.get('question', metadata.get('question', ''))
                    explanation = full_data.get('explanation', metadata.get('explanation', ''))
                    correct_option = full_data.get('correct_option', metadata.get('correct_option', ''))
                    
                    # Get options
                    options_dict = full_data.get('options', {})
                    if not options_dict:
                        options_dict = {}
                        for opt_key in ['option_a', 'option_b', 'option_c', 'option_d']:
                            if metadata.get(opt_key):
                                options_dict[opt_key.replace('option_', '').upper()] = metadata.get(opt_key)
                    
                    # Extract options list - handle both uppercase and lowercase keys
                    options_list = []
                    for k in ['A', 'B', 'C', 'D']:
                        # Try uppercase first, then lowercase
                        opt_value = options_dict.get(k) or options_dict.get(k.lower())
                        if opt_value:
                            options_list.append(opt_value)
                    
                    # Map correct_option letter to index
                    correct_answer_index = None
                    if correct_option:
                        option_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3}
                        correct_answer_index = option_map.get(correct_option)
                    
                    # Apply filters
                    if exam_filter and exam_filter != 'all':
                        exam_lower = exam_name.lower().replace(' ', '_').replace('/', '_')
                        if exam_filter.lower() not in exam_lower:
                            continue
                    
                    if subject_filter and subject_filter != 'all':
                        subject_lower = subject.lower().replace(' ', '_')
                        if subject_filter.lower() not in subject_lower:
                            continue
                    
                    if year_filter and year_filter != 'all':
                        if str(year_filter) != str(exam_year):
                            continue
                    
                    # Build question object
                    question_obj = {
                        'id': match['id'],
                        'question': question_text,
                        'options': options_list,
                        'correct_answer': correct_answer_index,
                        'correct_option': correct_option,
                        'explanation': explanation,
                        'exam_name': exam_name,
                        'year': exam_year,
                        'term': exam_term,
                        'subject': subject,
                        'namespace': namespace,
                        'score': match.get('score', 0)
                    }
                    
                    all_questions.append(question_obj)
                    
            except Exception as e:
                print(f"Error querying namespace {namespace}: {str(e)}")
                continue
        
        # Sort by score and limit
        all_questions.sort(key=lambda x: x['score'], reverse=True)
        filtered_questions = all_questions[:limit]
        
        return jsonify({
            'questions': filtered_questions,
            'total': len(filtered_questions),
            'status': 'success'
        }), 200
        
    except Exception as e:
        print(f"Error searching PYQ questions: {str(e)}")
        return jsonify({
            'error': str(e),
            'questions': [],
            'total': 0
        }), 500


@app.route("/api/pyq/filters", methods=["GET"])
@rate_limit(max_requests=20, window_seconds=60)
def get_pyq_filters():
    """Get available filter options for PYQ practice"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        mcq_index = search_components.get('mcq_index')
        mcq_model = search_components.get('mcq_model')
        
        if not mcq_index or not mcq_model:
            return jsonify({"error": "MCQ system not available"}), 500
        
        # Get all namespaces
        stats = mcq_index.describe_index_stats()
        namespaces = list(stats.namespaces.keys()) if stats.namespaces else []
        
        exams_set = set()
        subjects_set = set()
        years_set = set()
        
        # Sample questions from each namespace to get filters
        dummy_query = mcq_model.encode("sample").tolist()
        
        for namespace in namespaces:
            try:
                results = mcq_index.query(
                    vector=dummy_query,
                    top_k=100,
                    include_metadata=True,
                    namespace=namespace
                )
                
                for match in results['matches']:
                    metadata = match.get('metadata', {})
                    
                    # Parse full_json_str
                    full_data = {}
                    if 'full_json_str' in metadata:
                        try:
                            full_data = json.loads(metadata['full_json_str'])
                        except:
                            pass
                    
                    exam_name = full_data.get('exam_name', metadata.get('exam_name', ''))
                    exam_year = str(full_data.get('exam_year', metadata.get('exam_year', '')))
                    subject = full_data.get('subject', metadata.get('subject', ''))
                    
                    if exam_name:
                        exams_set.add(exam_name)
                    if exam_year and exam_year != 'Unknown':
                        years_set.add(exam_year)
                    if subject:
                        subjects_set.add(subject)
                        
            except Exception as e:
                print(f"Error sampling namespace {namespace}: {str(e)}")
                continue
        
        return jsonify({
            'exams': sorted(list(exams_set)),
            'subjects': sorted(list(subjects_set)),
            'years': sorted(list(years_set), reverse=True),
            'status': 'success'
        }), 200
        
    except Exception as e:
        print(f"Error getting PYQ filters: {str(e)}")
        return jsonify({
            'error': str(e),
            'exams': [],
            'subjects': [],
            'years': []
        }), 500


@app.route("/api/pyq/random", methods=["POST"])
@rate_limit(max_requests=30, window_seconds=60)
def get_random_pyq_questions():
    """Get random PYQ questions with optional filters"""
    global search_components
    
    if not system_initialized:
        return jsonify({"error": "Search system not initialized"}), 500
    
    try:
        data = request.get_json()
        count = data.get('count', 10)
        exam_filter = data.get('exam', None)
        subject_filter = data.get('subject', None)
        year_filter = data.get('year', None)
        
        # Use the search endpoint with a generic query
        search_data = {
            'query': '',
            'exam': exam_filter,
            'subject': subject_filter,
            'year': year_filter,
            'limit': count * 2  # Get more than needed for randomization
        }
        
        # Call the search function internally
        import random
        request._cached_json = search_data
        response, status = search_pyq_questions()
        
        if status == 200:
            result = response.get_json()
            questions = result.get('questions', [])
            
            # Randomize and limit
            random.shuffle(questions)
            random_questions = questions[:count]
            
            return jsonify({
                'questions': random_questions,
                'status': 'success'
            }), 200
        else:
            return response, status
            
    except Exception as e:
        print(f"Error getting random PYQ questions: {str(e)}")
        return jsonify({
            'error': str(e),
            'questions': []
        }), 500

if __name__ == "__main__":
    # Initialize the search system before starting the app
    initialize_search_system()
    
    is_production = os.getenv('FLASK_ENV') == 'production'
    port = int(os.getenv('PORT', 5000))
    
    if is_production:
        app.logger.info("🚀 Starting Flask API server in PRODUCTION mode...")
        app.logger.info(f"📡 CORS enabled for origins: {ALLOWED_ORIGINS}")
        app.logger.info(f"🔗 Server running on port {port}")
    else:
        print("🚀 Starting Flask API server in DEVELOPMENT mode...")
        print("📡 CORS enabled for React frontend")
        print("🔗 API endpoints:")
        print("   - POST /api/search - Search queries")
        print("   - GET /api/total-questions - Total questions count")
        print("   - GET /api/stats - System statistics")
        print("   - GET /api/health - Health check")
        print("   - GET /api/questions - Get questions with filtering")
        print("   - GET /api/filters - Get unique exam names and subjects for dropdowns")
        print("   - GET /api/books - Get inserted books")
        print("   - GET /api/inserted-pyqs - Get inserted PYQs")
        print("   - POST /api/pyq/search - Search PYQ questions with filters")
        print("   - GET /api/pyq/filters - Get available PYQ filter options")
        print("   - POST /api/pyq/random - Get random PYQ questions")
        print("   - GET /api/dashboard/stats - Dashboard statistics")
        print("   - GET /api/dashboard/subjects - Subject-wise stats")
        print("   - GET /api/dashboard/achievements - User achievements")
        print("   - GET /api/dashboard/goals - Learning goals")
        print("   - GET /api/dashboard/activity - Recent activity")
        print("   - POST /api/dashboard/track - Track user interaction")
        print("   - POST /api/dashboard/update-stats - Update user stats")
    
    # In production, Gunicorn will handle the server
    # This is only for local development
    if not is_production:
        app.run(host="0.0.0.0", port=port, debug=True)
    else:
        # For production, just initialize and let Gunicorn handle it
        app.logger.info("✅ Application ready for Gunicorn")

