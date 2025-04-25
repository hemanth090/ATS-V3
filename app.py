from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
import os
import json
import requests
from PyPDF2 import PdfReader
import io
import re
from pymongo import MongoClient
from datetime import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# MongoDB configuration
MONGODB_URI = os.getenv('MONGODB_URI')
if not MONGODB_URI:
    raise ValueError("MONGODB_URI environment variable is not set")

client = MongoClient(MONGODB_URI)
db = client.resume_analyzer
analyses_collection = db.analyses

# Groq API configuration
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is not set")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

def extract_text_from_pdf(pdf_data):
    """
    Extract text from PDF data
    """
    try:
        # Create a PDF reader object
        pdf_file = io.BytesIO(pdf_data)
        pdf_reader = PdfReader(pdf_file)
        
        # Extract text from all pages
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text.strip()
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

def extract_json_from_response(text):
    """
    Extract JSON content from the AI response
    """
    # Try to find JSON content between triple backticks
    json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if json_match:
        return json_match.group(1)
    
    # If no JSON in backticks, try to find content between curly braces
    json_match = re.search(r'({[\s\S]*})', text)
    if json_match:
        return json_match.group(1)
    
    return text

def analyze_resume(resume_text, job_description):
    """
    Send resume and job description to Groq AI for analysis
    """
    prompt = '''You are an expert ATS (Applicant Tracking System) analyzer. Analyze the following resume against the job description in detail.
    
    Resume:
    {}

    Job Description:
    {}

    Provide a comprehensive analysis including:
    1. Calculate a match score (0-100) based on skills, experience, and qualifications alignment
    2. List all matched skills and experiences found in both the resume and job description
    3. Identify missing or weak keywords that are important for the role
    4. Provide specific suggestions to improve the resume's alignment with the job
    5. Share key insights about the application's strengths and areas for improvement

    Format your response as a JSON object with the following structure:
    {{
        "match_score": <number between 0 and 100>,
        "matched_skills": ["skill1", "skill2", ...],
        "missing_skills": ["skill1", "skill2", ...],
        "suggestions": ["suggestion1", "suggestion2", ...],
        "insights": ["insight1", "insight2", ...]
    }}

    IMPORTANT: Wrap your JSON response in ```json``` code blocks.
    Be thorough in your analysis and provide actionable feedback.
    '''.format(resume_text, job_description)

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "deepseek-r1-distill-llama-70b",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.6,
        "max_tokens": 4096,
        "top_p": 0.95,
        "stream": False
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        
        # Extract the content from the response
        content = result['choices'][0]['message']['content']
        
        # Extract JSON from the content
        json_content = extract_json_from_response(content)
        
        # Parse the JSON content
        analysis = json.loads(json_content)
        return analysis
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse AI response: {str(e)}", 
            "raw_response": content,
            "extracted_json": json_content
        }
    except Exception as e:
        return {"error": str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/extract-pdf', methods=['POST'])
def extract_pdf():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"error": "File must be a PDF"}), 400
        
        # Read the PDF file
        pdf_data = file.read()
        
        # Extract text from PDF
        extracted_text = extract_text_from_pdf(pdf_data)
        
        if not extracted_text or len(extracted_text.strip()) == 0:
            return jsonify({
                "error": "No text could be extracted from the PDF. Please ensure the PDF contains selectable text and is not a scanned image."
            }), 400
        
        return jsonify({"text": extracted_text})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        resume_text = data.get('resume_text')
        job_description = data.get('job_description')

        if not resume_text or not job_description:
            return jsonify({"error": "Both resume and job description are required"}), 400

        analysis = analyze_resume(resume_text, job_description)
        if "error" in analysis:
            return jsonify({"error": analysis["error"]}), 500
        
        # Store the analysis in MongoDB
        analysis_record = {
            "resume_text": resume_text,
            "job_description": job_description,
            "analysis": analysis,
            "created_at": datetime.utcnow()
        }
        analyses_collection.insert_one(analysis_record)
        
        return jsonify(analysis)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyses', methods=['GET'])
def get_analyses():
    try:
        # Retrieve the last 10 analyses
        analyses = list(analyses_collection.find(
            {},
            {'_id': 0}  # Exclude MongoDB _id field
        ).sort('created_at', -1).limit(10))
        
        return jsonify(analyses)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 