// ===========================
// STATE MANAGEMENT
// ===========================
let state = {
    paperTitles: [],
    bibtexResults: [],
    isProcessing: false,
    settings: {
        delay: 1.0,
        email: '',
        apiPriority: 'crossref',
        formatIndent: true,
        sortAlphabetically: false,
        includeComments: true
    },
    stats: {
        success: 0,
        failed: 0,
        startTime: 0
    }
};

// ===========================
// DOM ELEMENTS
// ===========================
const elements = {
    paperTitles: document.getElementById('paperTitles'),
    fileInput: document.getElementById('fileInput'),
    fileUploadArea: document.getElementById('fileUploadArea'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileCount: document.getElementById('fileCount'),
    clearFile: document.getElementById('clearFile'),
    generateBtn: document.getElementById('generateBtn'),
    exampleBtn: document.getElementById('exampleBtn'),
    clearBtn: document.getElementById('clearBtn'),
    bibtexOutput: document.getElementById('bibtexOutput'),
    copyBtn: document.getElementById('copyBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentPaper: document.getElementById('currentPaper'),
    successCount: document.getElementById('successCount'),
    failCount: document.getElementById('failCount'),
    timeElapsed: document.getElementById('timeElapsed'),
    delaySlider: document.getElementById('delaySlider'),
    delayValue: document.getElementById('delayValue'),
    userEmail: document.getElementById('userEmail'),
    formatIndent: document.getElementById('formatIndent'),
    sortAlphabetically: document.getElementById('sortAlphabetically'),
    includeComments: document.getElementById('includeComments'),
    privacyLink: document.getElementById('privacyLink'),
    privacyModal: document.getElementById('privacyModal'),
    closePrivacy: document.getElementById('closePrivacy'),
    menuToggle: document.getElementById('menuToggle'),
    toastContainer: document.getElementById('toastContainer')
};

// ===========================
// API FUNCTIONS
// ===========================

// Fetch citation from Crossref
async function fetchFromCrossref(title) {
    const email = state.settings.email || 'citation-fetcher@github.io';
    const encodedTitle = encodeURIComponent(title);
    const url = `https://api.crossref.org/works?query.title=${encodedTitle}&rows=1&mailto=${email}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Crossref API error');

        const data = await response.json();

        if (data.message && data.message.items && data.message.items.length > 0) {
            const item = data.message.items[0];
            return convertCrossrefToBibtex(item);
        }
        return null;
    } catch (error) {
        console.error('Crossref error:', error);
        return null;
    }
}

// Fetch citation from ArXiv
async function fetchFromArxiv(title) {
    const encodedTitle = encodeURIComponent(title);
    const url = `https://export.arxiv.org/api/query?search_query=ti:"${encodedTitle}"&max_results=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('ArXiv API error');

        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const entry = xml.querySelector('entry');

        if (entry) {
            return convertArxivToBibtex(entry);
        }
        return null;
    } catch (error) {
        console.error('ArXiv error:', error);
        return null;
    }
}

// Convert Crossref data to BibTeX
function convertCrossrefToBibtex(item) {
    const authors = item.author?.map(a => {
        const family = a.family || '';
        const given = a.given || '';
        return `${family}, ${given}`.trim();
    }).join(' and ') || 'Unknown Author';

    const title = item.title?.[0] || 'Unknown Title';
    const year = item.published?.['date-parts']?.[0]?.[0] ||
                 item.created?.['date-parts']?.[0]?.[0] ||
                 new Date().getFullYear();
    const journal = item['container-title']?.[0] || '';
    const volume = item.volume || '';
    const number = item['journal-issue']?.issue || '';
    const pages = item.page || '';
    const doi = item.DOI || '';
    const publisher = item.publisher || '';

    // Create citation key
    const firstAuthor = item.author?.[0]?.family?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
    const firstWord = title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${firstAuthor}${year}${firstWord}`;

    // Determine entry type
    const type = journal ? 'article' : 'misc';

    let bibtex = `@${type}{${key},\n`;
    bibtex += `  author = {${authors}},\n`;
    bibtex += `  title = {{${title}}},\n`;
    if (journal) bibtex += `  journal = {${journal}},\n`;
    if (volume) bibtex += `  volume = {${volume}},\n`;
    if (number) bibtex += `  number = {${number}},\n`;
    if (pages) bibtex += `  pages = {${pages}},\n`;
    bibtex += `  year = {${year}}`;
    if (doi) bibtex += `,\n  doi = {${doi}}`;
    if (publisher && !journal) bibtex += `,\n  publisher = {${publisher}}`;
    bibtex += `\n}`;

    return bibtex;
}

// Convert ArXiv XML to BibTeX
function convertArxivToBibtex(entry) {
    const title = entry.querySelector('title')?.textContent?.trim() || 'Unknown Title';
    const authors = Array.from(entry.querySelectorAll('author name'))
        .map(a => a.textContent.trim())
        .join(' and ') || 'Unknown Author';
    const published = entry.querySelector('published')?.textContent?.substring(0, 4) || new Date().getFullYear();
    const arxivId = entry.querySelector('id')?.textContent?.split('/').pop()?.replace('abs/', '') || '';
    const summary = entry.querySelector('summary')?.textContent?.trim() || '';

    // Create citation key
    const firstAuthor = authors.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
    const key = `${firstAuthor}${published}arxiv`;

    let bibtex = `@article{${key},\n`;
    bibtex += `  author = {${authors}},\n`;
    bibtex += `  title = {{${title}}},\n`;
    bibtex += `  journal = {arXiv preprint},\n`;
    bibtex += `  year = {${published}}`;
    if (arxivId) bibtex += `,\n  note = {arXiv:${arxivId}}`;
    bibtex += `\n}`;

    return bibtex;
}

// ===========================
// PROCESSING FUNCTIONS
// ===========================

async function processPapers() {
    const titles = elements.paperTitles.value
        .trim()
        .split('\n')
        .filter(t => t.trim())
        .map(t => t.trim());

    if (titles.length === 0) {
        showToast('Please enter at least one paper title', 'error');
        return;
    }

    // Switch to results tab
    switchTab('results');

    // Reset state
    state.isProcessing = true;
    state.bibtexResults = [];
    state.stats = { success: 0, failed: 0, startTime: Date.now() };
    state.paperTitles = titles;

    // Update UI
    elements.generateBtn.disabled = true;
    elements.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    elements.progressContainer.classList.remove('hidden');
    elements.bibtexOutput.classList.add('hidden');
    updateStats();

    // Process each paper
    for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        const progress = ((i + 1) / titles.length) * 100;

        // Update progress
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `${i + 1}/${titles.length}`;
        elements.currentPaper.textContent = `Processing: ${title}`;

        // Fetch citation
        let bibtex = null;

        if (state.settings.apiPriority === 'crossref') {
            bibtex = await fetchFromCrossref(title);
            if (!bibtex) bibtex = await fetchFromArxiv(title);
        } else {
            bibtex = await fetchFromArxiv(title);
            if (!bibtex) bibtex = await fetchFromCrossref(title);
        }

        // Store result
        if (bibtex) {
            state.bibtexResults.push(bibtex);
            state.stats.success++;
        } else {
            state.bibtexResults.push(`% Failed to fetch citation for: ${title}`);
            state.stats.failed++;
        }

        updateStats();

        // Delay between requests (except for last one)
        if (i < titles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, state.settings.delay * 1000));
        }
    }

    // Finish processing
    state.isProcessing = false;
    displayResults();

    // Update UI
    elements.generateBtn.disabled = false;
    elements.generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Generate Citations';
    elements.progressContainer.classList.add('hidden');
    elements.bibtexOutput.classList.remove('hidden');

    showToast(`Completed! ${state.stats.success} successful, ${state.stats.failed} failed`,
              state.stats.failed > 0 ? 'warning' : 'success');
}

function displayResults() {
    let output = '';

    // Add header comment if enabled
    if (state.settings.includeComments) {
        const elapsed = ((Date.now() - state.stats.startTime) / 1000).toFixed(1);
        output += `% Generated by Citation Fetcher\n`;
        output += `% Date: ${new Date().toLocaleDateString()}\n`;
        output += `% Total papers: ${state.paperTitles.length}\n`;
        output += `% Successful: ${state.stats.success}, Failed: ${state.stats.failed}\n`;
        output += `% Processing time: ${elapsed}s\n`;
        output += `\n`;
    }

    // Add citations
    let citations = state.bibtexResults;

    // Sort alphabetically if enabled
    if (state.settings.sortAlphabetically) {
        citations = [...citations].sort();
    }

    output += citations.join('\n\n');

    elements.bibtexOutput.textContent = output;
}

function updateStats() {
    const elapsed = ((Date.now() - state.stats.startTime) / 1000).toFixed(1);
    elements.successCount.textContent = state.stats.success;
    elements.failCount.textContent = state.stats.failed;
    elements.timeElapsed.textContent = `${elapsed}s`;
}

// ===========================
// UI FUNCTIONS
// ===========================

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${iconMap[type]}"></i>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function loadExample() {
    const example = `Attention Is All You Need
BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding
Deep Residual Learning for Image Recognition
ImageNet Classification with Deep Convolutional Neural Networks
Generative Adversarial Networks`;

    elements.paperTitles.value = example;
    showToast('Example papers loaded', 'success');
}

function clearAll() {
    elements.paperTitles.value = '';
    clearFile();
    showToast('Cleared all inputs', 'info');
}

function clearFile() {
    elements.fileInput.value = '';
    elements.fileInfo.classList.add('hidden');
    elements.fileName.textContent = '';
    elements.fileCount.textContent = '';
}

function copyToClipboard() {
    const text = elements.bibtexOutput.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy', 'error');
    });
}

function downloadBib() {
    const text = elements.bibtexOutput.textContent;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'citations.bib';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded citations.bib', 'success');
}

// ===========================
// FILE UPLOAD
// ===========================

// ===========================
// FILE UPLOAD - UPDATED
// ===========================

function handleFileUpload(event) {
    let file;

    // Handle both direct file input and drag/drop
    if (event.type === 'drop') {
        file = event.dataTransfer.files[0];
        elements.fileInput.files = event.dataTransfer.files;
    } else {
        file = event.target.files[0];
    }

    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.txt')) {
        showToast('Please upload a .txt file', 'error');
        resetFileInput();
        return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
        showToast('File too large. Maximum size is 1MB.', 'error');
        resetFileInput();
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const content = e.target.result;

            // Validate content (basic validation)
            if (content.length === 0) {
                showToast('File is empty', 'error');
                resetFileInput();
                return;
            }

            const lines = content.trim().split('\n')
                .filter(line => line.trim())
                .map(line => line.trim());

            if (lines.length === 0) {
                showToast('No valid titles found in file', 'error');
                resetFileInput();
                return;
            }

            // Update UI
            elements.paperTitles.value = content;
            elements.fileName.textContent = file.name;
            elements.fileCount.textContent = `${lines.length} paper${lines.length !== 1 ? 's' : ''}`;
            elements.fileInfo.classList.remove('hidden');

            // Switch to input tab
            switchTab('input');

            showToast(`Loaded ${lines.length} papers from ${file.name}`, 'success');

        } catch (error) {
            console.error('Error reading file:', error);
            showToast('Error reading file', 'error');
            resetFileInput();
        }
    };

    reader.onerror = () => {
        showToast('Failed to read file', 'error');
        resetFileInput();
    };

    reader.readAsText(file);
}

function resetFileInput() {
    elements.fileInput.value = '';
    if (elements.fileInfo) {
        elements.fileInfo.classList.add('hidden');
    }
}

// Drag and drop support
elements.fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.fileUploadArea.classList.add('dragover');
});

elements.fileUploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.fileUploadArea.classList.remove('dragover');
});

elements.fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.fileUploadArea.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file) {
        handleFileUpload(e);
    }
});

// Click to upload
elements.fileUploadArea.addEventListener('click', (e) => {
    // Don't trigger if clicking on the file input itself
    if (e.target !== elements.fileInput) {
        elements.fileInput.click();
    }
});

// File input change
elements.fileInput.addEventListener('change', handleFileUpload);

// Clear file button
elements.clearFile.addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileInput();
    showToast('File cleared', 'info');
});

// Add keyboard support for file upload area
elements.fileUploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        elements.fileInput.click();
    }
});
// ===========================
// SETTINGS
// ===========================

function updateSettings() {
    state.settings.delay = parseFloat(elements.delaySlider.value);
    state.settings.email = elements.userEmail.value;

    const apiPriority = document.querySelector('input[name="apiPriority"]:checked');
    if (apiPriority) {
        state.settings.apiPriority = apiPriority.value;
    }

    state.settings.formatIndent = elements.formatIndent.checked;
    state.settings.sortAlphabetically = elements.sortAlphabetically.checked;
    state.settings.includeComments = elements.includeComments.checked;

    // Save to localStorage
    localStorage.setItem('citationFetcherSettings', JSON.stringify(state.settings));
}

function loadSettings() {
    const saved = localStorage.getItem('citationFetcherSettings');
    if (saved) {
        try {
            state.settings = { ...state.settings, ...JSON.parse(saved) };

            // Update UI
            elements.delaySlider.value = state.settings.delay;
            elements.delayValue.textContent = `${state.settings.delay.toFixed(1)}s`;
            elements.userEmail.value = state.settings.email;

            const apiRadio = document.querySelector(`input[name="apiPriority"][value="${state.settings.apiPriority}"]`);
            if (apiRadio) apiRadio.checked = true;

            elements.formatIndent.checked = state.settings.formatIndent;
            elements.sortAlphabetically.checked = state.settings.sortAlphabetically;
            elements.includeComments.checked = state.settings.includeComments;
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

// ===========================
// EVENT LISTENERS
// ===========================

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Main buttons
elements.generateBtn.addEventListener('click', processPapers);
elements.exampleBtn.addEventListener('click', loadExample);
elements.clearBtn.addEventListener('click', clearAll);

// Results buttons
elements.copyBtn.addEventListener('click', copyToClipboard);
elements.downloadBtn.addEventListener('click', downloadBib);

// File upload
elements.fileInput.addEventListener('change', handleFileUpload);
elements.fileUploadArea.addEventListener('click', () => elements.fileInput.click());
elements.clearFile.addEventListener('click', clearFile);

// Settings
elements.delaySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    elements.delayValue.textContent = `${value.toFixed(1)}s`;
    state.settings.delay = value;
    updateSettings();
});

elements.userEmail.addEventListener('change', updateSettings);

document.querySelectorAll('input[name="apiPriority"]').forEach(radio => {
    radio.addEventListener('change', updateSettings);
});

elements.formatIndent.addEventListener('change', updateSettings);
elements.sortAlphabetically.addEventListener('change', updateSettings);
elements.includeComments.addEventListener('change', updateSettings);

// Privacy modal
elements.privacyLink.addEventListener('click', (e) => {
    e.preventDefault();
    elements.privacyModal.classList.remove('hidden');
});

elements.closePrivacy.addEventListener('click', () => {
    elements.privacyModal.classList.add('hidden');
});

elements.privacyModal.addEventListener('click', (e) => {
    if (e.target === elements.privacyModal) {
        elements.privacyModal.classList.add('hidden');
    }
});

// Mobile menu toggle
elements.menuToggle.addEventListener('click', () => {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('show');
    document.body.classList.toggle('menu-open');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    const navLinks = document.querySelector('.nav-links');
    const menuToggle = elements.menuToggle;

    if (navLinks.classList.contains('show') &&
        !navLinks.contains(e.target) &&
        !menuToggle.contains(e.target)) {
        navLinks.classList.remove('show');
        document.body.classList.remove('menu-open');
    }
});

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        const navLinks = document.querySelector('.nav-links');
        navLinks.classList.remove('show');
        document.body.classList.remove('menu-open');
    });
});

// Smooth scrolling for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Active navigation highlighting
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');

        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
});

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    console.log('Citation Fetcher initialized');
});

// Add slideOut animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);