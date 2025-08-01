# ATS Resume Analyzer

A web application that analyzes resumes against job descriptions using Groq AI to provide match scores, skill analysis, and improvement suggestions.

## Features

- Resume and job description input via text or file upload
- AI-powered analysis using Groq API
- Match score calculation
- Matched and missing skills identification
- Personalized improvement suggestions
- Key insights visualization
- Responsive design using Bootstrap 5

## Setup

1. Clone the repository:
```bash
git clone https://github.com/hemanth090/ATS-V3.git
cd ats-resume-analyzer
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the project root and add your Groq API key:
```
GROQ_API_KEY=your_groq_api_key_here
FLASK_ENV=development
```

5. Run the application:
```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Usage

1. Enter your resume text or upload a resume file (supported formats: .txt, .pdf, .doc, .docx)
2. Enter the job description text or upload a job description file
3. Click "Analyze Resume"
4. View the analysis results:
   - Overall match score
   - Matched skills
   - Missing or weak keywords
   - Suggestions for improvement
   - Key insights

## Technologies Used

- Frontend:
  - HTML5
  - CSS3
  - Bootstrap 5
  - JavaScript (ES6+)
- Backend:
  - Python 3.8+
  - Flask
  - python-dotenv
  - Groq AI API

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

