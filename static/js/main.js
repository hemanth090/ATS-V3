document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const resultsSection = document.getElementById('resultsSection');
    const themeToggle = document.getElementById('theme-toggle');
    
    // Theme switching
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.checked = currentTheme === 'dark';

    themeToggle.addEventListener('change', function() {
        const theme = this.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });

    // File input handlers
    function handleFileInput(fileInput, textArea) {
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const uploadArea = fileInput.closest('.file-upload');
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'file-loading d-none';
        loadingIndicator.innerHTML = `
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="ms-2">Processing file...</span>
        `;
        uploadArea.appendChild(loadingIndicator);

        // Drag and drop handlers
        uploadArea.addEventListener('dragenter', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });

        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });

        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Reset previous error states
            fileInput.classList.remove('is-invalid');
            uploadArea.classList.remove('is-invalid');
            const existingError = uploadArea.querySelector('.invalid-feedback');
            if (existingError) existingError.remove();

            // Validate file size
            if (file.size > maxFileSize) {
                showError(uploadArea, 'File size must be less than 10MB');
                fileInput.value = '';
                return;
            }

            // Show loading indicator
            loadingIndicator.classList.remove('d-none');
            fileInput.disabled = true;

            try {
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await fetch('/extract-pdf', {
                        method: 'POST',
                        body: formData
                    });

                    let data;
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        throw new Error('Server error: Expected JSON response but got HTML. Please try again or contact support if the issue persists.');
                    }

                    try {
                        data = await response.json();
                    } catch (jsonError) {
                        console.error('JSON parsing error:', jsonError);
                        throw new Error('Failed to process server response. Please try again or contact support.');
                    }

                    if (!response.ok) {
                        throw new Error(data.error || 'PDF extraction failed');
                    }

                    if (!data.text || data.text.trim().length === 0) {
                        throw new Error('No text could be extracted from the PDF. Please ensure the PDF contains selectable text and is not a scanned image.');
                    }
                    textArea.value = data.text;
                } else {
                    // Handle text files
                    const text = await readTextFile(file);
                    if (!text || text.trim().length === 0) {
                        throw new Error('The file appears to be empty');
                    }
                    textArea.value = text;
                }
            } catch (error) {
                console.error('Error processing file:', error);
                showError(uploadArea, error.message || 'Failed to process file. Please try again or paste the text manually.');
                fileInput.value = '';
                textArea.value = '';
            } finally {
                loadingIndicator.classList.add('d-none');
                fileInput.disabled = false;
            }
        });
    }

    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    function showError(element, message) {
        element.classList.add('is-invalid');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        element.appendChild(errorDiv);
    }

    handleFileInput(document.getElementById('resumeFile'), document.getElementById('resumeText'));
    handleFileInput(document.getElementById('jobFile'), document.getElementById('jobText'));

    // Analysis handler
    analyzeBtn.addEventListener('click', async function() {
        const resumeText = document.getElementById('resumeText').value.trim();
        const jobText = document.getElementById('jobText').value.trim();

        // Reset previous error states
        document.getElementById('resumeText').classList.remove('is-invalid');
        document.getElementById('jobText').classList.remove('is-invalid');

        let hasError = false;
        if (!resumeText) {
            showError(document.getElementById('resumeText'), 'Please provide your resume text');
            hasError = true;
        }
        if (!jobText) {
            showError(document.getElementById('jobText'), 'Please provide the job description');
            hasError = true;
        }

        if (hasError) return;

        try {
            analyzeBtn.disabled = true;
            loadingSpinner.classList.remove('d-none');
            resultsSection.classList.add('d-none');

            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resume_text: resumeText,
                    job_description: jobText
                })
            });

            let data;
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server error: Expected JSON response but got HTML. Please try again or contact support if the issue persists.');
            }

            try {
                data = await response.json();
            } catch (jsonError) {
                console.error('JSON parsing error:', jsonError);
                throw new Error('Failed to process server response. Please try again or contact support.');
            }

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            displayResults(data);
        } catch (error) {
            console.error('Error during analysis:', error);
            alert(error.message || 'Analysis failed. Please try again.');
        } finally {
            analyzeBtn.disabled = false;
            loadingSpinner.classList.add('d-none');
        }
    });

    function displayResults(data) {
        // Update match score with animation
        const matchScoreElement = document.getElementById('matchScore');
        const targetScore = parseInt(data.match_score);
        let currentScore = 0;
        const duration = 1000; // 1 second animation
        const interval = 16; // ~60fps
        const steps = duration / interval;
        const increment = targetScore / steps;

        const animation = setInterval(() => {
            currentScore = Math.min(currentScore + increment, targetScore);
            matchScoreElement.textContent = `${Math.round(currentScore)}%`;
            
            if (currentScore >= targetScore) {
                clearInterval(animation);
            }
        }, interval);

        // Display matched skills with fade-in animation
        const matchedSkillsContainer = document.getElementById('matchedSkills');
        matchedSkillsContainer.innerHTML = '';
        data.matched_skills.forEach((skill, index) => {
            const skillTag = document.createElement('span');
            skillTag.className = 'skill-tag';
            skillTag.textContent = skill;
            skillTag.style.opacity = '0';
            skillTag.style.transform = 'translateY(10px)';
            skillTag.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            matchedSkillsContainer.appendChild(skillTag);

            setTimeout(() => {
                skillTag.style.opacity = '1';
                skillTag.style.transform = 'translateY(0)';
            }, 100 * index);
        });

        // Update lists with fade-in animation
        function updateList(elementId, items) {
            const container = document.getElementById(elementId);
            container.innerHTML = '';
            items.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = item;
                li.style.opacity = '0';
                li.style.transform = 'translateX(-10px)';
                li.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                container.appendChild(li);

                setTimeout(() => {
                    li.style.opacity = '1';
                    li.style.transform = 'translateX(0)';
                }, 100 * index);
            });
        }

        updateList('missingSkills', data.missing_skills);
        updateList('suggestions', data.suggestions);
        updateList('insights', data.insights);

        resultsSection.classList.remove('d-none');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
}); 