// ===========================
// STATE MANAGEMENT
// ===========================
let state = {
    paperInputs: [],
    bibtexResults: [],
    rawData: [],
    isProcessing: false,
    settings: {
        delay: 1.0,
        email: '',
        apiPriority: 'auto',
        formatIndent: true,
        sortAlphabetically: false,
        includeComments: true,
        autoSaveHistory: true,
        retryAttempts: 1,
        enableDarkMode: false,
        enableShortcuts: true,
        enableAnalytics: false,
        enableOffline: true,
        citationStyle: 'bibtex'
    },
    stats: {
        success: 0,
        failed: 0,
        startTime: 0,
        apiSource: {
            crossref: 0,
            arxiv: 0,
            semantic: 0
        }
    },
    history: [],
    inputHistory: [],
    currentInputIndex: -1,
    detectedInputType: 'titles'
};

// ===========================
// DOM ELEMENTS
// ===========================
const elements = {
    // Core elements
    paperInput: document.getElementById('paperInput'),
    fileInput: document.getElementById('fileInput'),
    fileUploadArea: document.getElementById('fileUploadArea'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileCount: document.getElementById('fileCount'),
    clearFile: document.getElementById('clearFile'),
    generateBtn: document.getElementById('generateBtn'),
    exampleBtn: document.getElementById('exampleBtn'),
    clearBtn: document.getElementById('clearBtn'),
    undoBtn: document.getElementById('undoBtn'),

    // Results elements
    bibtexOutput: document.getElementById('bibtexOutput'),
    citationPreview: document.getElementById('citationPreview'),
    rawDataOutput: document.getElementById('rawDataOutput'),
    copyBtn: document.getElementById('copyBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    shareBtn: document.getElementById('shareBtn'),
    exportFormat: document.getElementById('exportFormat'),

    // Progress elements
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentPaper: document.getElementById('currentPaper'),
    retryQueue: document.getElementById('retryQueue'),
    retryCount: document.getElementById('retryCount'),

    // Stats elements
    successCount: document.getElementById('successCount'),
    failCount: document.getElementById('failCount'),
    timeElapsed: document.getElementById('timeElapsed'),
    sourceStats: document.getElementById('sourceStats'),
    paperCount: document.getElementById('paperCount'),

    // Settings elements
    delaySlider: document.getElementById('delaySlider'),
    delayValue: document.getElementById('delayValue'),
    userEmail: document.getElementById('userEmail'),
    formatIndent: document.getElementById('formatIndent'),
    sortAlphabetically: document.getElementById('sortAlphabetically'),
    includeComments: document.getElementById('includeComments'),
    autoSaveHistory: document.getElementById('autoSaveHistory'),
    retrySlider: document.getElementById('retrySlider'),
    retryValue: document.getElementById('retryValue'),
    enableDarkMode: document.getElementById('enableDarkMode'),
    enableShortcuts: document.getElementById('enableShortcuts'),
    enableAnalytics: document.getElementById('enableAnalytics'),
    enableOffline: document.getElementById('enableOffline'),
    resetSettings: document.getElementById('resetSettings'),
    saveSettings: document.getElementById('saveSettings'),

    // History elements
    historyCount: document.getElementById('historyCount'),
    lastHistoryDate: document.getElementById('lastHistoryDate'),
    historySuccessRate: document.getElementById('historySuccessRate'),
    historyList: document.getElementById('historyList'),
    clearHistory: document.getElementById('clearHistory'),
    exportHistory: document.getElementById('exportHistory'),

    // UI elements
    inputTypeIndicator: document.getElementById('inputTypeIndicator'),
    inputCount: document.getElementById('inputCount'),
    inputTypeSelector: document.querySelectorAll('.input-type-btn'),
    keyboardHelp: document.getElementById('keyboardHelp'),
    showKeyboardHelp: document.getElementById('showKeyboardHelp'),
    closeKeyboardHelp: document.getElementById('closeKeyboardHelp'),
    keyboardShortcutsLink: document.getElementById('keyboardShortcutsLink'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    darkModeToggleFloating: document.getElementById('darkModeToggleFloating'),
    installPrompt: document.getElementById('installPrompt'),
    installLater: document.getElementById('installLater'),
    installNow: document.getElementById('installNow'),
    privacyLink: document.getElementById('privacyLink'),
    privacyModal: document.getElementById('privacyModal'),
    closePrivacy: document.getElementById('closePrivacy'),
    menuToggle: document.getElementById('menuToggle'),
    toastContainer: document.getElementById('toastContainer'),
    liveRegion: document.getElementById('liveRegion'),
    footerHistoryLink: document.getElementById('footerHistoryLink'),
    historyNavLink: document.getElementById('historyNavLink'),
    donateBtn: document.getElementById('donateBtn'),
    newsletterForm: document.getElementById('newsletterForm'),
    offlineStatus: document.getElementById('offlineStatus'),
    appVersion: document.getElementById('appVersion')
};

// ===========================
// UTILITY FUNCTIONS
// ===========================

function showToast(message, type = 'info', duration = 3000) {
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

    // Announce to screen readers
    announceToScreenReader(message);

    // Remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);

    // Auto-hide for success/error
    if (type !== 'info') {
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
}

function announceToScreenReader(message, priority = 'polite') {
    elements.liveRegion.setAttribute('aria-live', priority);
    elements.liveRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
        elements.liveRegion.textContent = '';
    }, 1000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===========================
// INPUT DETECTION & PROCESSING
// ===========================

function detectInputType(text) {
    const lines = text.trim().split('\n').filter(line => line.trim());

    if (lines.length === 0) return 'titles';

    // Check for DOIs
    const doiPattern = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
    const doiLines = lines.filter(line => doiPattern.test(line.trim()));
    if (doiLines.length === lines.length) return 'doi';
    if (doiLines.length > lines.length / 2) return 'mixed-doi';

    // Check for arXiv IDs
    const arxivPattern = /^\d{4}\.\d{4,5}(v\d+)?$/;
    const arxivLines = lines.filter(line => arxivPattern.test(line.trim()));
    if (arxivLines.length === lines.length) return 'arxiv';
    if (arxivLines.length > lines.length / 2) return 'mixed-arxiv';

    // Default to titles
    return 'titles';
}

function updateInputTypeUI(type) {
    state.detectedInputType = type;

    const typeMap = {
        'titles': { text: 'Paper Titles', icon: 'fa-font', color: 'var(--primary)' },
        'doi': { text: 'DOIs', icon: 'fa-link', color: 'var(--secondary)' },
        'arxiv': { text: 'arXiv IDs', icon: 'fa-atom', color: '#b31b1b' },
        'mixed-doi': { text: 'Mixed (Mostly DOIs)', icon: 'fa-random', color: 'var(--warning)' },
        'mixed-arxiv': { text: 'Mixed (Mostly arXiv)', icon: 'fa-random', color: '#185adb' }
    };

    const info = typeMap[type] || typeMap.titles;
    elements.inputTypeIndicator.innerHTML = `
        <i class="fas ${info.icon}" style="color: ${info.color}"></i>
        ${info.text}
    `;

    // Update input type buttons
    elements.inputTypeSelector.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type.split('-')[0]) {
            btn.classList.add('active');
        }
    });
}

function updatePaperCount() {
    const text = elements.paperInput.value.trim();
    const lines = text.split('\n').filter(line => line.trim());
    const count = lines.length;

    elements.paperCount.textContent = `${count} paper${count !== 1 ? 's' : ''} ready`;
    elements.inputCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;

    // Update input type detection
    if (count > 0) {
        const type = detectInputType(text);
        updateInputTypeUI(type);
    } else {
        elements.inputTypeIndicator.textContent = 'Waiting for input...';
    }

    // Enable/disable generate button
    elements.generateBtn.disabled = count === 0;

    // Store in input history for undo
    if (text !== '' && state.inputHistory[state.currentInputIndex] !== text) {
        state.inputHistory.push(text);
        state.currentInputIndex = state.inputHistory.length - 1;
        elements.undoBtn.disabled = false;
    }
}

// ===========================
// API FUNCTIONS (ENHANCED)
// ===========================

async function fetchFromCrossref(title, type = 'title') {
    const email = state.settings.email || 'citation-fetcher@github.io';
    let url;

    if (type === 'doi') {
        const cleanDOI = title.replace(/^(https?:\/\/)?(doi\.org\/)?/, '');
        url = `https://api.crossref.org/works/${cleanDOI}?mailto=${email}`;
    } else {
        const encodedQuery = encodeURIComponent(title);
        url = `https://api.crossref.org/works?query.title=${encodedQuery}&rows=1&mailto=${email}`;
    }

    try {
        const response = await fetchWithRetry(url);
        if (!response.ok) throw new Error(`Crossref API error: ${response.status}`);

        const data = await response.json();

        if (type === 'doi') {
            return {
                bibtex: convertCrossrefToBibtex(data.message),
                raw: data.message,
                source: 'crossref'
            };
        } else if (data.message && data.message.items && data.message.items.length > 0) {
            return {
                bibtex: convertCrossrefToBibtex(data.message.items[0]),
                raw: data.message.items[0],
                source: 'crossref'
            };
        }
        return null;
    } catch (error) {
        console.error('Crossref error:', error);
        return null;
    }
}

async function fetchFromArxiv(id, type = 'title') {
    let url;

    if (type === 'arxiv') {
        url = `https://export.arxiv.org/api/query?id_list=${id}`;
    } else {
        const encodedTitle = encodeURIComponent(id);
        url = `https://export.arxiv.org/api/query?search_query=ti:"${encodedTitle}"&max_results=1`;
    }

    try {
        const response = await fetchWithRetry(url);
        if (!response.ok) throw new Error(`ArXiv API error: ${response.status}`);

        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const entry = xml.querySelector('entry');

        if (entry) {
            return {
                bibtex: convertArxivToBibtex(entry),
                raw: entry,
                source: 'arxiv'
            };
        }
        return null;
    } catch (error) {
        console.error('ArXiv error:', error);
        return null;
    }
}

async function fetchFromSemanticScholar(title, type = 'title') {
    let url;

    if (type === 'doi') {
        const cleanDOI = title.replace(/^(https?:\/\/)?(doi\.org\/)?/, '');
        url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${cleanDOI}?fields=title,authors,year,venue,abstract,citationCount,referenceCount`;
    } else {
        const encodedTitle = encodeURIComponent(title);
        url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedTitle}&limit=1&fields=title,authors,year,venue,abstract,citationCount,referenceCount`;
    }

    try {
        const response = await fetchWithRetry(url);
        if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`);

        const data = await response.json();

        if (type === 'doi' || (data.data && data.data.length > 0)) {
            const paper = type === 'doi' ? data : data.data[0];
            return {
                bibtex: convertSemanticToBibtex(paper),
                raw: paper,
                source: 'semantic'
            };
        }
        return null;
    } catch (error) {
        console.error('Semantic Scholar error:', error);
        return null;
    }
}

async function fetchWithRetry(url, retries = state.settings.retryAttempts) {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;

            if (response.status === 429) { // Rate limited
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }

            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            if (i === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// ===========================
// BIBTEX CONVERSION FUNCTIONS
// ===========================

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
    const number = item.issue || '';
    const pages = item.page || '';
    const doi = item.DOI || '';
    const publisher = item.publisher || '';

    // Create citation key
    const firstAuthor = item.author?.[0]?.family?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
    const firstWord = title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${firstAuthor}${year}${firstWord}`.substring(0, 50);

    // Determine entry type
    const type = journal ? 'article' : 'misc';

    let bibtex = `@${type}{${key},\n`;
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `author = {${authors}},\n`;
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `title = {{${title}}},\n`;
    if (journal) {
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `journal = {${journal}},\n`;
    }
    if (year) {
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `year = {${year}}`;
    }
    if (volume) {
        bibtex += ',\n';
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `volume = {${volume}}`;
    }
    if (number) {
        bibtex += ',\n';
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `number = {${number}}`;
    }
    if (pages) {
        bibtex += ',\n';
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `pages = {${pages}}`;
    }
    if (doi) {
        bibtex += ',\n';
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `doi = {${doi}}`;
    }
    if (publisher && !journal) {
        bibtex += ',\n';
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `publisher = {${publisher}}`;
    }
    bibtex += '\n}';

    return bibtex;
}

function convertArxivToBibtex(entry) {
    const title = entry.querySelector('title')?.textContent?.replace(/\n/g, ' ').trim() || 'Unknown Title';
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
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `author = {${authors}},\n`;
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `title = {{${title}}},\n`;
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `journal = {arXiv preprint},\n`;
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `year = {${published}}`;
    if (arxivId) {
        bibtex += ',\n';
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `note = {arXiv:${arxivId}}`;
    }
    bibtex += '\n}';

    return bibtex;
}

function convertSemanticToBibtex(paper) {
    const authors = paper.authors?.map(a => `${a.name}`).join(' and ') || 'Unknown Author';
    const title = paper.title || 'Unknown Title';
    const year = paper.year || new Date().getFullYear();
    const venue = paper.venue || '';
    const doi = paper.externalIds?.DOI || '';
    const abstract = paper.abstract || '';

    // Create citation key
    const firstAuthor = paper.authors?.[0]?.name?.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
    const key = `${firstAuthor}${year}semantic`;

    const type = venue ? 'article' : 'misc';

    let bibtex = `@${type}{${key},\n`;
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `author = {${authors}},\n`;
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `title = {{${title}}},\n`;
    if (venue) {
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `journal = {${venue}},\n`;
    }
    if (state.settings.formatIndent) bibtex += '  ';
    bibtex += `year = {${year}}`;
    if (doi) {
        bibtex += ',\n';
        if (state.settings.formatIndent) bibtex += '  ';
        bibtex += `doi = {${doi}}`;
    }
    bibtex += '\n}';

    return bibtex;
}

// ===========================
// PROCESSING FUNCTIONS
// ===========================

async function processPapers() {
    const input = elements.paperInput.value.trim();
    if (!input) {
        showToast('Please enter some paper titles, DOIs, or arXiv IDs', 'error');
        return;
    }

    const lines = input.split('\n').filter(line => line.trim()).map(line => line.trim());
    const inputType = state.detectedInputType;

    if (lines.length > 100) {
        showToast(`Processing ${lines.length} papers (max 100 shown)`, 'warning');
        lines.splice(100);
    }

    // Switch to results tab
    switchTab('results');

    // Reset state
    state.isProcessing = true;
    state.bibtexResults = [];
    state.rawData = [];
    state.stats = {
        success: 0,
        failed: 0,
        startTime: Date.now(),
        apiSource: { crossref: 0, arxiv: 0, semantic: 0 }
    };
    state.paperInputs = lines;

    // Update UI
    elements.generateBtn.disabled = true;
    elements.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    elements.progressContainer.classList.remove('hidden');
    elements.bibtexOutput.classList.add('hidden');
    updateStats();

    // Process each paper
    for (let i = 0; i < lines.length; i++) {
        if (!state.isProcessing) break;

        const input = lines[i];
        const progress = ((i + 1) / lines.length) * 100;

        // Update progress
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `${i + 1}/${lines.length}`;
        elements.currentPaper.textContent = `Processing: ${input.substring(0, 100)}${input.length > 100 ? '...' : ''}`;

        // Determine API priority based on input type
        let apiPriority = state.settings.apiPriority;
        if (apiPriority === 'auto') {
            if (inputType.includes('doi')) apiPriority = 'crossref';
            else if (inputType.includes('arxiv')) apiPriority = 'arxiv';
            else apiPriority = 'crossref';
        }

        // Fetch citation
        let result = null;
        let attempts = [];

        if (apiPriority === 'crossref') {
            attempts = [
                () => fetchFromCrossref(input, inputType.includes('doi') ? 'doi' : 'title'),
                () => fetchFromArxiv(input, inputType.includes('arxiv') ? 'arxiv' : 'title'),
                () => fetchFromSemanticScholar(input, inputType.includes('doi') ? 'doi' : 'title')
            ];
        } else if (apiPriority === 'arxiv') {
            attempts = [
                () => fetchFromArxiv(input, inputType.includes('arxiv') ? 'arxiv' : 'title'),
                () => fetchFromCrossref(input, inputType.includes('doi') ? 'doi' : 'title'),
                () => fetchFromSemanticScholar(input, inputType.includes('doi') ? 'doi' : 'title')
            ];
        }

        for (const attempt of attempts) {
            if (result) break;
            try {
                result = await attempt();
            } catch (error) {
                console.error('Fetch attempt failed:', error);
            }
        }

        // Store result
        if (result) {
            state.bibtexResults.push(result.bibtex);
            state.rawData.push(result.raw);
            state.stats.success++;
            state.stats.apiSource[result.source]++;

            if (state.settings.autoSaveHistory) {
                saveToHistory(input, result.bibtex, result.raw, result.source);
            }
        } else {
            state.bibtexResults.push(`% Failed to fetch citation for: ${input}`);
            state.rawData.push({ error: 'Not found', input });
            state.stats.failed++;
        }

        updateStats();
        updatePreview();

        // Delay between requests
        if (i < lines.length - 1) {
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

    const successRate = Math.round((state.stats.success / lines.length) * 100);
    showToast(`Completed! ${state.stats.success} successful, ${state.stats.failed} failed (${successRate}% success rate)`,
              state.stats.failed > lines.length / 2 ? 'warning' : 'success');

    // Update history display
    if (state.settings.autoSaveHistory) {
        loadHistory();
    }
}

function displayResults() {
    let output = '';

    // Add header comment if enabled
    if (state.settings.includeComments) {
        const elapsed = ((Date.now() - state.stats.startTime) / 1000).toFixed(1);
        output += `% Generated by Citation Fetcher v2.0\n`;
        output += `% Date: ${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}\n`;
        output += `% Total items: ${state.paperInputs.length}\n`;
        output += `% Successful: ${state.stats.success}, Failed: ${state.stats.failed}\n`;
        output += `% Processing time: ${elapsed}s\n`;
        output += `% Sources: Crossref (${state.stats.apiSource.crossref}), ArXiv (${state.stats.apiSource.arxiv}), Semantic Scholar (${state.stats.apiSource.semantic})\n`;
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
    elements.rawDataOutput.textContent = JSON.stringify(state.rawData, null, 2);
}

function updateStats() {
    const elapsed = ((Date.now() - state.stats.startTime) / 1000).toFixed(1);
    elements.successCount.textContent = state.stats.success;
    elements.failCount.textContent = state.stats.failed;
    elements.timeElapsed.textContent = `${elapsed}s`;

    const sourceText = [
        state.stats.apiSource.crossref > 0 ? `Crossref: ${state.stats.apiSource.crossref}` : '',
        state.stats.apiSource.arxiv > 0 ? `ArXiv: ${state.stats.apiSource.arxiv}` : '',
        state.stats.apiSource.semantic > 0 ? `Semantic: ${state.stats.apiSource.semantic}` : ''
    ].filter(Boolean).join(', ');

    elements.sourceStats.textContent = sourceText || '-';
}

function updatePreview() {
    const previewContainer = elements.citationPreview;
    previewContainer.innerHTML = '';

    state.bibtexResults.forEach((bibtex, index) => {
        if (bibtex.startsWith('%')) return; // Skip failed entries

        const item = document.createElement('div');
        item.className = 'citation-item';

        // Extract title from BibTeX
        const titleMatch = bibtex.match(/title\s*=\s*\{([^}]+)\}/);
        const authorMatch = bibtex.match(/author\s*=\s*\{([^}]+)\}/);
        const journalMatch = bibtex.match(/journal\s*=\s*\{([^}]+)\}/);
        const yearMatch = bibtex.match(/year\s*=\s*\{([^}]+)\}/);

        const title = titleMatch ? titleMatch[1].replace(/[{}]/g, '') : 'Unknown Title';
        const authors = authorMatch ? authorMatch[1].replace(/[{}]/g, '') : 'Unknown Authors';
        const journal = journalMatch ? journalMatch[1].replace(/[{}]/g, '') : 'No Journal';
        const year = yearMatch ? yearMatch[1] : 'Unknown Year';

        item.innerHTML = `
            <h4>${title}</h4>
            <div class="authors">${authors}</div>
            <div class="journal">${journal}, ${year}</div>
            <div class="preview-actions">
                <button class="btn-small copy-preview" data-index="${index}">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>
        `;

        previewContainer.appendChild(item);
    });

    // Add event listeners for preview copy buttons
    document.querySelectorAll('.copy-preview').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            const bibtex = state.bibtexResults[index];
            navigator.clipboard.writeText(bibtex).then(() => {
                showToast('Copied citation to clipboard', 'success');
            });
        });
    });
}

// ===========================
// HISTORY FUNCTIONS
// ===========================

function saveToHistory(input, bibtex, raw, source) {
    const history = JSON.parse(localStorage.getItem('citationHistory') || '[]');

    history.unshift({
        id: Date.now(),
        input: input,
        bibtex: bibtex,
        raw: raw,
        source: source,
        date: new Date().toISOString(),
        success: !bibtex.startsWith('%')
    });

    // Keep only last 100 entries
    if (history.length > 100) {
        history.splice(100);
    }

    localStorage.setItem('citationHistory', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('citationHistory') || '[]');
    state.history = history;

    elements.historyCount.textContent = history.length;

    if (history.length > 0) {
        const lastDate = new Date(history[0].date);
        elements.lastHistoryDate.textContent = lastDate.toLocaleDateString();

        const successCount = history.filter(item => item.success).length;
        const successRate = Math.round((successCount / history.length) * 100);
        elements.historySuccessRate.textContent = `${successRate}%`;
    } else {
        elements.lastHistoryDate.textContent = 'Never';
        elements.historySuccessRate.textContent = '0%';
    }

    renderHistoryList();
}

function renderHistoryList() {
    const historyList = elements.historyList;

    if (state.history.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-history fa-3x"></i>
                <h4>No History Yet</h4>
                <p>Your fetched citations will appear here for quick access</p>
                <button class="btn-primary" onclick="switchTab('input')">
                    <i class="fas fa-plus"></i> Start Generating
                </button>
            </div>
        `;
        return;
    }

    historyList.innerHTML = '';

    state.history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const date = new Date(item.date);
        const title = item.bibtex.match(/title\s*=\s*\{([^}]+)\}/)?.[1]?.replace(/[{}]/g, '') || item.input.substring(0, 100);

        historyItem.innerHTML = `
            <div class="history-item-header">
                <div class="history-item-title">${title}</div>
                <div class="history-item-date">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            <div class="history-item-source">
                <span class="badge ${item.source}">${item.source.toUpperCase()}</span>
                <span class="status ${item.success ? 'success' : 'failed'}">
                    <i class="fas fa-${item.success ? 'check' : 'times'}"></i>
                </span>
            </div>
            <div class="history-item-preview">${item.bibtex.substring(0, 200)}${item.bibtex.length > 200 ? '...' : ''}</div>
            <div class="history-item-actions">
                <button class="btn-small copy-history" data-id="${item.id}">
                    <i class="fas fa-copy"></i> Copy
                </button>
                <button class="btn-small load-history" data-input="${item.input.replace(/"/g, '&quot;')}">
                    <i class="fas fa-redo"></i> Reuse
                </button>
                <button class="btn-small delete-history" data-id="${item.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        historyList.appendChild(historyItem);
    });

    // Add event listeners
    document.querySelectorAll('.copy-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('button').dataset.id);
            const item = state.history.find(h => h.id === id);
            if (item) {
                navigator.clipboard.writeText(item.bibtex).then(() => {
                    showToast('Copied citation to clipboard', 'success');
                });
            }
        });
    });

    document.querySelectorAll('.load-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = e.target.closest('button').dataset.input;
            switchTab('input');
            elements.paperInput.value = input;
            updatePaperCount();
            showToast('Input loaded from history', 'info');
        });
    });

    document.querySelectorAll('.delete-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('button').dataset.id);
            deleteHistoryItem(id);
        });
    });
}

function deleteHistoryItem(id) {
    const history = JSON.parse(localStorage.getItem('citationHistory') || '[]');
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem('citationHistory', JSON.stringify(filtered));
    loadHistory();
    showToast('Item removed from history', 'info');
}

function clearAllHistory() {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
        localStorage.removeItem('citationHistory');
        loadHistory();
        showToast('History cleared', 'success');
    }
}

function exportHistory() {
    const history = JSON.parse(localStorage.getItem('citationHistory') || '[]');
    const exportData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        itemCount: history.length,
        items: history
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citation-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('History exported successfully', 'success');
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

    // Special handling for history tab
    if (tabName === 'history') {
        loadHistory();
    }

    // Announce tab change for screen readers
    announceToScreenReader(`Switched to ${tabName} tab`);
}

function switchView(viewName) {
    document.querySelectorAll('.results-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.result-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}View`).classList.add('active');
}

function loadExample() {
    const example = `Attention Is All You Need
10.48550/arXiv.1706.03762
1706.03762v5
BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding
Deep Residual Learning for Image Recognition
10.1145/3065386
ImageNet Classification with Deep Convolutional Neural Networks
Generative Adversarial Networks`;

    elements.paperInput.value = example;
    updatePaperCount();
    showToast('Example papers loaded', 'success');
}

function clearAll() {
    if (elements.paperInput.value.trim() || state.inputHistory.length > 0) {
        if (confirm('Clear all input?')) {
            state.inputHistory.push(elements.paperInput.value);
            state.currentInputIndex = state.inputHistory.length - 1;
            elements.paperInput.value = '';
            updatePaperCount();
            clearFile();
            showToast('Cleared all inputs', 'info');
        }
    } else {
        showToast('Nothing to clear', 'warning');
    }
}

function undoInput() {
    if (state.currentInputIndex > 0) {
        state.currentInputIndex--;
        elements.paperInput.value = state.inputHistory[state.currentInputIndex];
        updatePaperCount();
        showToast('Undo successful', 'success');
    } else {
        showToast('Nothing to undo', 'warning');
        elements.undoBtn.disabled = true;
    }
}

function copyToClipboard() {
    const format = elements.exportFormat.value;
    let text;

    if (format === 'bibtex') {
        text = elements.bibtexOutput.textContent;
    } else if (format === 'plain') {
        text = convertToPlainText(state.bibtexResults);
    } else {
        text = convertToCitationStyle(state.rawData, format);
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied as ${format.toUpperCase()} to clipboard!`, 'success');
    }).catch(err => {
        showToast('Failed to copy', 'error');
    });
}

function downloadBib() {
    const format = elements.exportFormat.value;
    let text, filename;

    if (format === 'bibtex') {
        text = elements.bibtexOutput.textContent;
        filename = 'citations.bib';
    } else if (format === 'plain') {
        text = convertToPlainText(state.bibtexResults);
        filename = 'citations.txt';
    } else {
        text = convertToCitationStyle(state.rawData, format);
        filename = `citations.${format}.txt`;
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
}

function shareResults() {
    if (navigator.share) {
        const text = elements.bibtexOutput.textContent.substring(0, 100) + '...';
        navigator.share({
            title: 'Citations from Citation Fetcher',
            text: `I found ${state.stats.success} citations using Citation Fetcher!`,
            url: window.location.href
        }).then(() => {
            showToast('Shared successfully!', 'success');
        }).catch(() => {
            copyToClipboard();
        });
    } else {
        copyToClipboard();
    }
}

function convertToPlainText(bibtexArray) {
    return bibtexArray.map((bibtex, index) => {
        if (bibtex.startsWith('%')) return bibtex;

        const titleMatch = bibtex.match(/title\s*=\s*\{([^}]+)\}/);
        const authorMatch = bibtex.match(/author\s*=\s*\{([^}]+)\}/);
        const journalMatch = bibtex.match(/journal\s*=\s*\{([^}]+)\}/);
        const yearMatch = bibtex.match(/year\s*=\s*\{([^}]+)\}/);

        const title = titleMatch ? titleMatch[1].replace(/[{}]/g, '') : 'Unknown Title';
        const authors = authorMatch ? authorMatch[1].replace(/[{}]/g, '').replace(/ and /g, ', ') : 'Unknown Authors';
        const journal = journalMatch ? journalMatch[1].replace(/[{}]/g, '') : '';
        const year = yearMatch ? yearMatch[1] : '';

        return `${index + 1}. ${authors} (${year}). ${title}. ${journal}`.trim();
    }).join('\n\n');
}

function convertToCitationStyle(data, style) {
    const styles = {
        apa: (item) => {
            const authors = item.author || item.authors || [];
            const authorStr = authors.map(a => {
                if (typeof a === 'string') return a;
                const family = a.family || a.name?.split(' ').pop() || '';
                const given = a.given || a.name?.split(' ')[0] || '';
                return `${family}, ${given.charAt(0)}.`;
            }).join(', ');

            const year = item.year || item.published?.['date-parts']?.[0]?.[0] || '';
            const title = item.title?.[0] || item.title || '';
            const journal = item['container-title']?.[0] || item.venue || '';
            const volume = item.volume || '';
            const issue = item.issue || '';
            const pages = item.page || '';
            const doi = item.DOI || item.externalIds?.DOI || '';

            let citation = `${authorStr} (${year}). ${title}. `;
            if (journal) citation += `${journal}`;
            if (volume) citation += `, ${volume}`;
            if (issue) citation += `(${issue})`;
            if (pages) citation += `, ${pages}`;
            if (doi) citation += `. https://doi.org/${doi}`;

            return citation;
        },

        mla: (item) => {
            const authors = item.author || item.authors || [];
            const authorStr = authors.map(a => {
                if (typeof a === 'string') return a;
                const family = a.family || a.name?.split(' ').pop() || '';
                const given = a.given || a.name?.split(' ')[0] || '';
                return `${family}, ${given}`;
            }).join(', ');

            const title = item.title?.[0] || item.title || '';
            const journal = item['container-title']?.[0] || item.venue || '';
            const volume = item.volume || '';
            const issue = item.issue || '';
            const year = item.year || item.published?.['date-parts']?.[0]?.[0] || '';
            const pages = item.page || '';

            let citation = `${authorStr}. "${title}." `;
            if (journal) citation += `<em>${journal}</em>`;
            if (volume) citation += `, vol. ${volume}`;
            if (issue) citation += `, no. ${issue}`;
            if (year) citation += `, ${year}`;
            if (pages) citation += `, pp. ${pages}`;
            citation += '.';

            return citation;
        },

        chicago: (item) => {
            const authors = item.author || item.authors || [];
            const authorStr = authors.map((a, i) => {
                if (typeof a === 'string') return a;
                const family = a.family || a.name?.split(' ').pop() || '';
                const given = a.given || a.name?.split(' ')[0] || '';
                return `${given} ${family}`;
            }).join(', ');

            const title = item.title?.[0] || item.title || '';
            const journal = item['container-title']?.[0] || item.venue || '';
            const volume = item.volume || '';
            const issue = item.issue || '';
            const year = item.year || item.published?.['date-parts']?.[0]?.[0] || '';
            const pages = item.page || '';
            const doi = item.DOI || item.externalIds?.DOI || '';

            let citation = `${authorStr}. "${title}." `;
            if (journal) citation += `<em>${journal}</em>`;
            if (volume) citation += ` ${volume}`;
            if (issue) citation += `, no. ${issue}`;
            if (year) citation += ` (${year})`;
            if (pages) citation += `: ${pages}`;
            if (doi) citation += `. https://doi.org/${doi}`;

            return citation;
        },

        harvard: (item) => {
            const authors = item.author || item.authors || [];
            const authorStr = authors.map((a, i) => {
                if (typeof a === 'string') return a;
                const family = a.family || a.name?.split(' ').pop() || '';
                return family;
            }).join(', ');

            const year = item.year || item.published?.['date-parts']?.[0]?.[0] || '';
            const title = item.title?.[0] || item.title || '';
            const journal = item['container-title']?.[0] || item.venue || '';
            const volume = item.volume || '';
            const issue = item.issue || '';
            const pages = item.page || '';

            return `${authorStr} (${year}) '${title}', <em>${journal}</em>, ${volume}(${issue}), pp. ${pages}.`;
        }
    };

    return data.filter(item => !item.error).map((item, index) => {
        try {
            return styles[style] ? styles[style](item) : `[${style} format not available]`;
        } catch (error) {
            return `Error formatting citation ${index + 1}`;
        }
    }).join('\n\n');
}

// ===========================
// FILE HANDLING (ENHANCED)
// ===========================

function handleFileUpload(event) {
    let file;

    if (event.type === 'drop') {
        file = event.dataTransfer.files[0];
        elements.fileInput.files = event.dataTransfer.files;
    } else {
        file = event.target.files[0];
    }

    if (!file) return;

    // Validate file type
    const validTypes = ['text/plain', 'application/pdf', 'application/x-bibtex'];
    const validExtensions = ['.txt', '.pdf', '.bib'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(extension) && !validTypes.includes(file.type)) {
        showToast('Please upload a .txt, .pdf, or .bib file', 'error');
        resetFileInput();
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('File too large. Maximum size is 5MB.', 'error');
        resetFileInput();
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            let content;

            if (extension === '.pdf') {
                // PDF handling would require pdf.js library
                showToast('PDF text extraction requires additional setup', 'warning');
                content = extractTextFromPDF(e.target.result) || '';
            } else if (extension === '.bib') {
                content = parseBibFile(e.target.result);
            } else {
                content = e.target.result;
            }

            if (!content || content.trim().length === 0) {
                showToast('File is empty or could not be read', 'error');
                resetFileInput();
                return;
            }

            const lines = content.trim().split('\n')
                .filter(line => line.trim())
                .map(line => line.trim());

            if (lines.length === 0) {
                showToast('No valid content found in file', 'error');
                resetFileInput();
                return;
            }

            // Update UI
            elements.paperInput.value = content;
            elements.fileName.textContent = file.name;
            elements.fileCount.textContent = `${lines.length} item${lines.length !== 1 ? 's' : ''}`;
            elements.fileInfo.classList.remove('hidden');

            // Update paper count and input type
            updatePaperCount();

            showToast(`Loaded ${lines.length} items from ${file.name}`, 'success');

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

    if (extension === '.pdf') {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

function extractTextFromPDF(arrayBuffer) {
    // This is a placeholder for PDF text extraction
    // In production, you would use pdf.js or similar library
    showToast('PDF text extraction is not fully implemented in this version', 'info');
    return '';
}

function parseBibFile(content) {
    // Extract titles from BibTeX file
    const titleMatches = content.match(/title\s*=\s*\{([^}]+)\}/gi) || [];
    return titleMatches.map(match => {
        const title = match.match(/title\s*=\s*\{([^}]+)\}/i)[1];
        return title.replace(/[{}]/g, '');
    }).join('\n');
}

function resetFileInput() {
    elements.fileInput.value = '';
    elements.fileInfo.classList.add('hidden');
}

// ===========================
// SETTINGS MANAGEMENT
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
    state.settings.autoSaveHistory = elements.autoSaveHistory.checked;
    state.settings.retryAttempts = parseInt(elements.retrySlider.value);
    state.settings.enableDarkMode = elements.enableDarkMode.checked;
    state.settings.enableShortcuts = elements.enableShortcuts.checked;
    state.settings.enableAnalytics = elements.enableAnalytics.checked;
    state.settings.enableOffline = elements.enableOffline.checked;

    // Apply dark mode if changed
    if (state.settings.enableDarkMode) {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.setAttribute('data-theme', 'light');
    }

    // Save to localStorage
    localStorage.setItem('citationFetcherSettings', JSON.stringify(state.settings));
    showToast('Settings saved', 'success');
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
            elements.autoSaveHistory.checked = state.settings.autoSaveHistory;
            elements.retrySlider.value = state.settings.retryAttempts;
            elements.retryValue.textContent = `${state.settings.retryAttempts} retr${state.settings.retryAttempts === 1 ? 'y' : 'ies'}`;
            elements.enableDarkMode.checked = state.settings.enableDarkMode;
            elements.enableShortcuts.checked = state.settings.enableShortcuts;
            elements.enableAnalytics.checked = state.settings.enableAnalytics;
            elements.enableOffline.checked = state.settings.enableOffline;

            // Apply dark mode
            if (state.settings.enableDarkMode) {
                document.body.setAttribute('data-theme', 'dark');
            }

        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

function resetSettings() {
    if (confirm('Reset all settings to default values?')) {
        state.settings = {
            delay: 1.0,
            email: '',
            apiPriority: 'auto',
            formatIndent: true,
            sortAlphabetically: false,
            includeComments: true,
            autoSaveHistory: true,
            retryAttempts: 1,
            enableDarkMode: false,
            enableShortcuts: true,
            enableAnalytics: false,
            enableOffline: true,
            citationStyle: 'bibtex'
        };

        localStorage.removeItem('citationFetcherSettings');
        loadSettings();
        showToast('Settings reset to defaults', 'success');
    }
}

// ===========================
// DARK MODE
// ===========================

function toggleDarkMode() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';

    if (isDark) {
        document.body.setAttribute('data-theme', 'light');
        state.settings.enableDarkMode = false;
    } else {
        document.body.setAttribute('data-theme', 'dark');
        state.settings.enableDarkMode = true;
    }

    elements.enableDarkMode.checked = state.settings.enableDarkMode;
    updateSettings();

    showToast(`Dark mode ${isDark ? 'disabled' : 'enabled'}`, 'info');
}

// ===========================
// KEYBOARD SHORTCUTS
// ===========================

function initKeyboardShortcuts() {
    if (!state.settings.enableShortcuts) return;

    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts if user is typing in an input
        if (e.target.matches('input, textarea, select')) return;

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

        // Show/hide keyboard help
        if (e.key === '?') {
            e.preventDefault();
            elements.keyboardHelp.classList.toggle('hidden');
            return;
        }

        // Only process shortcuts when Ctrl/Cmd is pressed
        if (!ctrlKey && e.key !== 'Escape') return;

        switch(e.key) {
            case 'Enter':
                e.preventDefault();
                if (!state.isProcessing) processPapers();
                break;

            case 's':
                e.preventDefault();
                switchTab('settings');
                break;

            case 'h':
                e.preventDefault();
                switchTab('history');
                break;

            case 'd':
                e.preventDefault();
                toggleDarkMode();
                break;

            case 'Escape':
                e.preventDefault();
                clearAll();
                break;

            case 'u':
                if (e.altKey) {
                    e.preventDefault();
                    undoInput();
                }
                break;
        }
    });
}

// ===========================
// PWA & OFFLINE FUNCTIONALITY
// ===========================

function initServiceWorker() {
    if ('serviceWorker' in navigator && state.settings.enableOffline) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
                updateOnlineStatus();

                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('New version available! Refresh to update.', 'info', 5000);
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    elements.offlineStatus.innerHTML = `
        <i class="fas fa-${isOnline ? 'wifi' : 'exclamation-triangle'}"></i>
        ${isOnline ? 'Online' : 'Offline'}
    `;
    elements.offlineStatus.className = `offline-status ${isOnline ? 'online' : 'offline'}`;

    if (!isOnline) {
        showToast('You are offline. Some features may be limited.', 'warning');
    }
}

function initInstallPrompt() {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show install prompt after delay
        setTimeout(() => {
            if (!localStorage.getItem('installPromptDismissed')) {
                elements.installPrompt.classList.remove('hidden');
            }
        }, 10000);
    });

    elements.installNow.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                showToast('App installed successfully!', 'success');
            }
            deferredPrompt = null;
        }
        elements.installPrompt.classList.add('hidden');
    });

    elements.installLater.addEventListener('click', () => {
        elements.installPrompt.classList.add('hidden');
        localStorage.setItem('installPromptDismissed', 'true');
    });
}


// ===========================
// QR CODE PAYMENT FUNCTIONALITY
// ===========================

function initQRPayment() {
    const qrModal = document.getElementById('qrModal');
    const donateBtn = document.getElementById('donateBtn');
    const closeQRBtn = document.getElementById('closeQR');
    const enlargeModal = document.getElementById('enlargeModal');
    const closeEnlargeBtn = document.getElementById('closeEnlarge');
    const closeEnlargeBtn2 = document.getElementById('closeEnlargeBtn');
    const showQRCodeAnywayBtn = document.getElementById('showQRCodeAnyway');
    const appDetection = document.getElementById('appDetection');
    const qrDisplay = document.getElementById('qrDisplay');

    // Check if device is mobile
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Check if device is iOS
    function isIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    // Check if device is Android
    function isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    // Check if WeChat browser
    function isWeChatBrowser() {
        return /MicroMessenger/i.test(navigator.userAgent);
    }

    // Check if Alipay browser
    function isAlipayBrowser() {
        return /AlipayClient/i.test(navigator.userAgent);
    }

    // Open Alipay app with deep link
    function openAlipay() {
        // Alipay deep link format
        const alipayLink = "alipays://platformapi/startapp?appId=09999988&actionType=toAccount&goBack=NO&amount=&userId=YOUR_ALIPAY_ID&memo=Support%20Citation%20Fetcher";

        // Try to open Alipay app
        window.location.href = alipayLink;

        // If app doesn't open, fallback after delay
        setTimeout(() => {
            if (document.hasFocus()) {
                // App didn't open, show QR code
                showAppDetection('Alipay app not detected. Showing QR code...');
                setTimeout(() => {
                    hideAppDetection();
                }, 2000);
            }
        }, 500);
    }

    // Open WeChat app with deep link
    function openWeChat() {
        // WeChat deep link format (payment link)
        const wechatLink = "weixin://scanqrcode";

        // Try to open WeChat app
        window.location.href = wechatLink;

        // If app doesn't open, fallback after delay
        setTimeout(() => {
            if (document.hasFocus()) {
                // App didn't open, show QR code
                showAppDetection('WeChat app not detected. Showing QR code...');
                setTimeout(() => {
                    hideAppDetection();
                }, 2000);
            }
        }, 500);
    }

    // Show app detection screen
    function showAppDetection(message = 'Opening payment app...') {
        appDetection.classList.remove('hidden');
        document.getElementById('detectionMessage').textContent = message;
    }

    // Hide app detection screen
    function hideAppDetection() {
        appDetection.classList.add('hidden');
    }

    // Show QR code modal with smart behavior
    function showQRModal() {
        qrModal.classList.remove('hidden');

        // Track donation click
        trackEvent('donation_modal_opened');

        // If mobile, try to detect payment apps
        if (isMobileDevice()) {
            // Check if already in WeChat or Alipay browser
            if (isWeChatBrowser()) {
                showAppDetection('You are in WeChat! Showing WeChat payment...');
                setTimeout(() => {
                    hideAppDetection();
                    switchToWeChat();
                }, 1000);
                return;
            }

            if (isAlipayBrowser()) {
                showAppDetection('You are in Alipay! Showing Alipay payment...');
                setTimeout(() => {
                    hideAppDetection();
                    switchToAlipay();
                }, 1000);
                return;
            }

            // Check iOS/Android and try appropriate app
            if (isIOS()) {
                // iOS users might have both apps
                showAppDetection('Detected iOS device. Opening payment options...');
                setTimeout(() => {
                    hideAppDetection();
                }, 1500);
            } else if (isAndroid()) {
                // Android users might have both apps
                showAppDetection('Detected Android device. Opening payment options...');
                setTimeout(() => {
                    hideAppDetection();
                }, 1500);
            }
        }

        // Default: Show QR codes
        hideAppDetection();
    }

    // Close QR modal
    function closeQRModal() {
        qrModal.classList.add('hidden');
    }

    // Switch to Alipay tab
    function switchToAlipay() {
        document.querySelectorAll('.payment-option').forEach(opt => {
            opt.classList.remove('active');
        });
        document.querySelector('.payment-option[data-payment="alipay"]').classList.add('active');

        document.querySelectorAll('.qr-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById('alipaySection').classList.add('active');
    }

    // Switch to WeChat tab
    function switchToWeChat() {
        document.querySelectorAll('.payment-option').forEach(opt => {
            opt.classList.remove('active');
        });
        document.querySelector('.payment-option[data-payment="wechat"]').classList.add('active');

        document.querySelectorAll('.qr-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById('wechatSection').classList.add('active');
    }

    // Enlarge QR code
    function enlargeQR(paymentType) {
        const enlargeModal = document.getElementById('enlargeModal');
        const enlargedQR = document.getElementById('enlargedQR');
        const enlargeTitle = document.getElementById('enlargeTitle');

        if (paymentType === 'alipay') {
            enlargedQR.src = 'images/donate/alipay-qr.png';
            enlargeTitle.innerHTML = '<i class="fab fa-alipay"></i> Alipay QR Code';
        } else {
            enlargedQR.src = 'images/donate/wechat-qr.png';
            enlargeTitle.innerHTML = '<i class="fab fa-weixin"></i> WeChat QR Code';
        }

        enlargeModal.classList.remove('hidden');
    }

    // Save QR code
    function saveQRCode(paymentType) {
        const qrImage = paymentType === 'alipay' ?
            document.querySelector('#alipaySection .qr-image') :
            document.querySelector('#wechatSection .qr-image');

        if (!qrImage || !qrImage.src) {
            showToast('QR code image not found', 'error');
            return;
        }

        // Create temporary link to download
        const link = document.createElement('a');
        link.href = qrImage.src;
        link.download = `citation-fetcher-${paymentType}-qr.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('QR code saved to downloads!', 'success');
        trackEvent('qr_code_saved', { type: paymentType });
    }

    // Copy payment link to clipboard
    function copyPaymentLink(paymentType) {
        let link = '';
        let message = '';

        if (paymentType === 'alipay') {
            link = 'alipays://platformapi/startapp?appId=09999988&actionType=toAccount&userId=YOUR_ALIPAY_ID';
            message = 'Alipay payment link copied!';
        } else {
            link = 'weixin://wxpay/bizpayurl?pr=YOUR_WECHAT_TRANSACTION_ID';
            message = 'WeChat payment link copied!';
        }

        navigator.clipboard.writeText(link).then(() => {
            showToast(message, 'success');
            trackEvent('payment_link_copied', { type: paymentType });
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy link', 'error');
        });
    }

    // Event Listeners
    if (donateBtn) {
        donateBtn.addEventListener('click', showQRModal);
    }

    if (closeQRBtn) {
        closeQRBtn.addEventListener('click', closeQRModal);
    }

    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
            closeQRModal();
        }
    });

    // Payment option switching
    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', () => {
            const paymentType = option.dataset.payment;

            // Update active states
            document.querySelectorAll('.payment-option').forEach(opt => {
                opt.classList.remove('active');
            });
            option.classList.add('active');

            // Show corresponding QR section
            document.querySelectorAll('.qr-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`${paymentType}Section`).classList.add('active');

            trackEvent('payment_option_switched', { type: paymentType });
        });
    });

    // QR image click to enlarge
    document.querySelectorAll('.qr-image-container').forEach(container => {
        container.addEventListener('click', (e) => {
            const parentSection = container.closest('.qr-section');
            const paymentType = parentSection.id === 'alipaySection' ? 'alipay' : 'wechat';
            enlargeQR(paymentType);
        });
    });

    // Open app buttons
    document.getElementById('openAlipay')?.addEventListener('click', () => {
        trackEvent('open_alipay_clicked');
        openAlipay();
    });

    document.getElementById('openWeChat')?.addEventListener('click', () => {
        trackEvent('open_wechat_clicked');
        openWeChat();
    });

    // Show QR code anyway
    if (showQRCodeAnywayBtn) {
        showQRCodeAnywayBtn.addEventListener('click', () => {
            hideAppDetection();
        });
    }

    // Save QR code button
    document.getElementById('saveQR')?.addEventListener('click', () => {
        const activePayment = document.querySelector('.payment-option.active').dataset.payment;
        saveQRCode(activePayment);
    });

    // Copy payment link button
    document.getElementById('copyPaymentLink')?.addEventListener('click', () => {
        const activePayment = document.querySelector('.payment-option.active').dataset.payment;
        copyPaymentLink(activePayment);
    });

    // Enlargement modal controls
    if (closeEnlargeBtn) {
        closeEnlargeBtn.addEventListener('click', () => {
            enlargeModal.classList.add('hidden');
        });
    }

    if (closeEnlargeBtn2) {
        closeEnlargeBtn2.addEventListener('click', () => {
            enlargeModal.classList.add('hidden');
        });
    }

    enlargeModal.addEventListener('click', (e) => {
        if (e.target === enlargeModal) {
            enlargeModal.classList.add('hidden');
        }
    });

    // Download enlarged QR code
    document.getElementById('downloadEnlarged')?.addEventListener('click', () => {
        const enlargedQR = document.getElementById('enlargedQR');
        if (!enlargedQR.src) return;

        const link = document.createElement('a');
        link.href = enlargedQR.src;
        link.download = `citation-fetcher-qr-large.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Large QR code saved!', 'success');
        enlargeModal.classList.add('hidden');
    });

    // Keyboard shortcuts for modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!qrModal.classList.contains('hidden')) {
                closeQRModal();
            }
            if (!enlargeModal.classList.contains('hidden')) {
                enlargeModal.classList.add('hidden');
            }
        }

        // Tab switching with keyboard
        if (!qrModal.classList.contains('hidden')) {
            if (e.key === '1' || e.key === 'a') {
                switchToAlipay();
            } else if (e.key === '2' || e.key === 'w') {
                switchToWeChat();
            }
        }
    });

    // Auto-switch based on user agent
    function autoDetectPaymentMethod() {
        if (isWeChatBrowser()) {
            switchToWeChat();
        } else if (isAlipayBrowser()) {
            switchToAlipay();
        } else if (isMobileDevice()) {
            // On mobile, default to WeChat for China
            const isChineseUser = navigator.language.startsWith('zh') ||
                                 /zh-CN|zh-TW|zh-HK/i.test(navigator.language) ||
                                 /China|Chinese/i.test(navigator.userAgent);

            if (isChineseUser) {
                switchToWeChat();
            } else {
                // Non-Chinese mobile users might prefer Alipay
                switchToAlipay();
            }
        } else {
            // Desktop users default to Alipay
            switchToAlipay();
        }
    }

    // Run auto-detection when modal opens
    qrModal.addEventListener('modalOpen', autoDetectPaymentMethod);

    // Return public methods if needed
    return {
        showQRModal,
        closeQRModal,
        openAlipay,
        openWeChat
    };
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const qrPayment = initQRPayment();

    // Make available globally if needed
    window.qrPayment = qrPayment;

    console.log('QR Payment system initialized');
});

// ===========================
// ANALYTICS (PRIVACY-FOCUSED)
// ===========================

function trackEvent(eventName, data = {}) {
    if (!state.settings.enableAnalytics) return;

    const analyticsData = {
        event: eventName,
        timestamp: Date.now(),
        version: '2.0',
        ...data
    };

    // Store locally (could be sent to analytics server in production)
    const analytics = JSON.parse(localStorage.getItem('citationAnalytics') || '[]');
    analytics.push(analyticsData);

    if (analytics.length > 1000) {
        analytics.splice(0, 100);
    }

    localStorage.setItem('citationAnalytics', JSON.stringify(analytics));
}

// ===========================
// EVENT LISTENERS SETUP
// ===========================

function setupEventListeners() {
    // Input handling
    elements.paperInput.addEventListener('input', debounce(updatePaperCount, 300));

    // File upload
    elements.fileInput.addEventListener('change', handleFileUpload);
    elements.fileUploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.clearFile.addEventListener('click', resetFileInput);

    // Drag and drop
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
        handleFileUpload(e);
    });

    // Main buttons
    elements.generateBtn.addEventListener('click', () => {
        trackEvent('generate_citations', { count: state.paperInputs.length });
        processPapers();
    });
    elements.exampleBtn.addEventListener('click', loadExample);
    elements.clearBtn.addEventListener('click', clearAll);
    elements.undoBtn.addEventListener('click', undoInput);

    // Results actions
    elements.copyBtn.addEventListener('click', copyToClipboard);
    elements.downloadBtn.addEventListener('click', downloadBib);
    elements.shareBtn.addEventListener('click', shareResults);

    // Export format change
    elements.exportFormat.addEventListener('change', () => {
        const format = elements.exportFormat.value;
        elements.copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy as ${format.toUpperCase()}`;
        elements.downloadBtn.innerHTML = `<i class="fas fa-download"></i> Download ${format}`;
    });

    // Results view tabs
    document.querySelectorAll('.results-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Input type selector
    elements.inputTypeSelector.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            elements.inputTypeSelector.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.detectedInputType = type;
            updateInputTypeUI(type);
        });
    });

    // History actions
    elements.clearHistory.addEventListener('click', clearAllHistory);
    elements.exportHistory.addEventListener('click', exportHistory);
    elements.footerHistoryLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('history');
    });
    elements.historyNavLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('history');
    });

    // Settings
    elements.delaySlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        elements.delayValue.textContent = `${value.toFixed(1)}s`;
        state.settings.delay = value;
    });

    elements.retrySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        elements.retryValue.textContent = `${value} retr${value === 1 ? 'y' : 'ies'}`;
        state.settings.retryAttempts = value;
    });

    elements.userEmail.addEventListener('change', updateSettings);
    elements.formatIndent.addEventListener('change', updateSettings);
    elements.sortAlphabetically.addEventListener('change', updateSettings);
    elements.includeComments.addEventListener('change', updateSettings);
    elements.autoSaveHistory.addEventListener('change', updateSettings);
    elements.enableDarkMode.addEventListener('change', updateSettings);
    elements.enableShortcuts.addEventListener('change', updateSettings);
    elements.enableAnalytics.addEventListener('change', updateSettings);
    elements.enableOffline.addEventListener('change', updateSettings);

    document.querySelectorAll('input[name="apiPriority"]').forEach(radio => {
        radio.addEventListener('change', updateSettings);
    });

    elements.resetSettings.addEventListener('click', resetSettings);
    elements.saveSettings.addEventListener('click', updateSettings);

    // Dark mode toggles
    elements.darkModeToggle.addEventListener('click', toggleDarkMode);
    elements.darkModeToggleFloating.addEventListener('click', toggleDarkMode);

    // Keyboard help
    elements.showKeyboardHelp.addEventListener('click', () => {
        elements.keyboardHelp.classList.toggle('hidden');
    });

    elements.closeKeyboardHelp.addEventListener('click', () => {
        elements.keyboardHelp.classList.add('hidden');
    });

    elements.keyboardShortcutsLink.addEventListener('click', (e) => {
        e.preventDefault();
        elements.keyboardHelp.classList.remove('hidden');
    });

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

    // Mobile menu
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

    // Donate button
    elements.donateBtn.addEventListener('click', () => {
        showToast('Thank you for considering a donation!', 'info');
        // In production, you would link to your donation page
        // window.open('https://buymeacoffee.com/yourusername', '_blank');
    });

    // Newsletter form
    elements.newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[type="email"]').value;
        showToast('Thank you for subscribing!', 'success');
        e.target.reset();
    });

    // Online/offline status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Citation Fetcher v2.0 initialized');

    // Set app version
    elements.appVersion.textContent = 'v2.0';

    // Load saved state
    loadSettings();
    loadHistory();

    // Initialize features
    initKeyboardShortcuts();
    initServiceWorker();
    initInstallPrompt();

    // Set up event listeners
    setupEventListeners();

    // Initial UI update
    updatePaperCount();
    updateOnlineStatus();

    // Track app launch
    trackEvent('app_launch');

    // Announce app is ready for screen readers
    setTimeout(() => {
        announceToScreenReader('Citation Fetcher is ready. Enter paper titles, DOIs, or arXiv IDs to generate citations.');
    }, 1000);
});

// Make functions available globally
window.switchTab = switchTab;
window.loadExample = loadExample;
window.toggleDarkMode = toggleDarkMode;