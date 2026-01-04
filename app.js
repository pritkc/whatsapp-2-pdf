/**
 * WhatsApp2PDF - Main Application
 * Handles file upload, ZIP extraction, and orchestrates all modules
 */

const App = {
    // State
    chatData: null,
    chatName: '',
    mediaFiles: new Map(),
    exporterInfo: null,
    
    // DOM elements
    elements: {},

    /**
     * Initialize the application
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.initTheme();
        this.fetchExporterInfo();
        console.log('WhatsApp2PDF initialized');
    },

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            uploadSection: document.getElementById('uploadSection'),
            chatSection: document.getElementById('chatSection'),
            mainHeader: document.getElementById('mainHeader'),
            dropzone: document.getElementById('dropzone'),
            fileInput: document.getElementById('fileInput'),
            fileInputFolder: document.getElementById('fileInputFolder'),
            fileInputSingle: document.getElementById('fileInputSingle'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            messagesList: document.getElementById('messagesList'),
            searchInput: document.getElementById('searchInput'),
            themeToggle: document.getElementById('themeToggle'),
            backBtn: document.getElementById('backBtn'),
            exportPdf: document.getElementById('exportPdf'),
            exportHtml: document.getElementById('exportHtml'),
            jumpToDate: document.getElementById('jumpToDate'),
            datePickerModal: document.getElementById('datePickerModal'),
            closeDatePicker: document.getElementById('closeDatePicker'),
            jumpDateInput: document.getElementById('jumpDateInput'),
            jumpToDateBtn: document.getElementById('jumpToDateBtn'),
            currentUserSelect: document.getElementById('currentUserSelect'),
            dateFilterStart: document.getElementById('dateFilterStart'),
            dateFilterEnd: document.getElementById('dateFilterEnd'),
            dateFilterClear: document.getElementById('dateFilterClear'),
            // Export options
            includeAttachments: document.getElementById('includeAttachments'),
            includeImageGallery: document.getElementById('includeImageGallery')
        };
    },

    /**
     * Fetch exporter info (IP, location) for PDF metadata
     */
    async fetchExporterInfo() {
        try {
            // Use a free IP geolocation API
            const response = await fetch('https://ipapi.co/json/', { 
                method: 'GET',
                mode: 'cors'
            });
            if (response.ok) {
                const data = await response.json();
                this.exporterInfo = {
                    ip: data.ip || null,
                    location: data.city && data.country_name 
                        ? `${data.city}, ${data.region}, ${data.country_name}`
                        : null,
                    timezone: data.timezone || null
                };
                console.log('Exporter info fetched:', this.exporterInfo);
            }
        } catch (error) {
            // Silently fail - exporter info is optional
            console.log('Could not fetch exporter info (this is optional)');
            this.exporterInfo = null;
        }
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Dropzone click - open file picker for multiple files
        // Users can also drag-and-drop folders, or use Ctrl/Cmd+Click for folder selection
        this.elements.dropzone.addEventListener('click', (e) => {
            // Check if modifier key is pressed (Ctrl/Cmd) for folder selection
            if (e.ctrlKey || e.metaKey) {
                this.elements.fileInputFolder.click();
            } else {
                // Default: open file picker for multiple files
                this.elements.fileInput.click();
            }
        });
        
        this.elements.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.dropzone.classList.add('drag-over');
        });
        
        this.elements.dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.dropzone.classList.remove('drag-over');
        });
        
        this.elements.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.dropzone.classList.remove('drag-over');
            
            // Handle both files and directories from drag and drop
            const items = e.dataTransfer.items;
            if (items) {
                this.handleDataTransferItems(items);
            } else {
                this.handleFiles(e.dataTransfer.files);
            }
        });
        
        // File input for multiple files
        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
        
        // File input for folder upload
        this.elements.fileInputFolder.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
        
        // File input for single ZIP file
        this.elements.fileInputSingle.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
        
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Back button
        this.elements.backBtn.addEventListener('click', () => {
            this.resetToUpload();
        });
        
        // Export buttons
        this.elements.exportPdf.addEventListener('click', () => {
            this.exportToPDF();
        });
        
        this.elements.exportHtml.addEventListener('click', () => {
            this.exportToHTML();
        });
        
        // Export options checkboxes
        if (this.elements.includeAttachments) {
            this.elements.includeAttachments.addEventListener('change', (e) => {
                ChatExporter.exportOptions.includeAttachments = e.target.checked;
            });
        }
        
        if (this.elements.includeImageGallery) {
            this.elements.includeImageGallery.addEventListener('change', (e) => {
                ChatExporter.exportOptions.includeImageGallery = e.target.checked;
            });
        }
        
        // Search
        let searchTimeout;
        this.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                ChatRenderer.searchMessages(e.target.value);
            }, 300);
        });
        
        // Date picker
        this.elements.jumpToDate.addEventListener('click', () => {
            this.elements.datePickerModal.style.display = 'flex';
        });
        
        this.elements.closeDatePicker.addEventListener('click', () => {
            this.elements.datePickerModal.style.display = 'none';
        });
        
        this.elements.jumpToDateBtn.addEventListener('click', () => {
            const date = this.elements.jumpDateInput.value;
            if (date) {
                ChatRenderer.jumpToDate(date);
                this.elements.datePickerModal.style.display = 'none';
            }
        });
        
        // Close modal on outside click
        this.elements.datePickerModal.addEventListener('click', (e) => {
            if (e.target === this.elements.datePickerModal) {
                this.elements.datePickerModal.style.display = 'none';
            }
        });
        
        // Date filter
        if (this.elements.dateFilterStart && this.elements.dateFilterEnd) {
            this.elements.dateFilterStart.addEventListener('change', () => this.applyDateFilter());
            this.elements.dateFilterEnd.addEventListener('change', () => this.applyDateFilter());
        }
        
        if (this.elements.dateFilterClear) {
            this.elements.dateFilterClear.addEventListener('click', () => this.clearDateFilter());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.elements.datePickerModal.style.display = 'none';
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && this.chatData) {
                e.preventDefault();
                this.elements.searchInput.focus();
            }
        });
    },

    /**
     * Handle DataTransfer items (for folder drag and drop)
     */
    async handleDataTransferItems(items) {
        const files = [];
        const promises = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    if (entry.isDirectory) {
                        promises.push(this.readDirectory(entry, files));
                    } else {
                        const file = item.getAsFile();
                        if (file) files.push(file);
                    }
                } else {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
        }
        
        await Promise.all(promises);
        
        if (files.length > 0) {
            await this.handleFiles(files);
        }
    },

    /**
     * Recursively read directory entries
     */
    readDirectory(dirEntry, files) {
        return new Promise((resolve) => {
            const reader = dirEntry.createReader();
            const readEntries = () => {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve();
                        return;
                    }
                    
                    for (const entry of entries) {
                        if (entry.isFile) {
                            const file = await this.getFileFromEntry(entry);
                            if (file) files.push(file);
                        } else if (entry.isDirectory) {
                            await this.readDirectory(entry, files);
                        }
                    }
                    
                    readEntries();
                });
            };
            readEntries();
        });
    },

    /**
     * Get File from FileEntry
     */
    getFileFromEntry(fileEntry) {
        return new Promise((resolve) => {
            fileEntry.file(resolve, () => resolve(null));
        });
    },

    /**
     * Initialize theme from localStorage or system preference
     */
    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (prefersDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    },

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    },

    /**
     * Handle uploaded files (array or FileList)
     */
    async handleFiles(files) {
        if (!files || files.length === 0) return;
        
        // Convert FileList to array
        const fileArray = Array.from(files);
        
        this.showLoading('Reading files...');
        
        try {
            // Check if there's a ZIP file
            const zipFile = fileArray.find(f => f.name.toLowerCase().endsWith('.zip'));
            
            if (zipFile) {
                await this.processZipFile(zipFile);
            } else {
                // Handle folder/multiple files upload
                await this.processMultipleFiles(fileArray);
            }
        } catch (error) {
            console.error('Error processing files:', error);
            alert(`Error: ${error.message}`);
            this.hideLoading();
        }
    },

    /**
     * Process a ZIP file
     */
    async processZipFile(file) {
        this.showLoading('Extracting ZIP archive...');
        
        const zip = await JSZip.loadAsync(file);
        let chatContent = null;
        this.mediaFiles = new Map();
        
        // Extract chat name from ZIP filename
        this.chatName = file.name.replace('.zip', '').replace('WhatsApp Chat - ', '');
        
        // First pass: collect all filenames for debugging
        const allFiles = [];
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                allFiles.push(relativePath.split('/').pop());
            }
        });
        console.log('Files in ZIP:', allFiles);
        
        // Process all files in the ZIP
        const filePromises = [];
        
        zip.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            
            const filename = relativePath.split('/').pop();
            
            if (filename === '_chat.txt' || filename.endsWith('.txt')) {
                filePromises.push(
                    zipEntry.async('string').then(content => {
                        if (!chatContent || filename === '_chat.txt') {
                            chatContent = content;
                        }
                    })
                );
            } else if (this.isMediaFile(filename)) {
                filePromises.push(
                    zipEntry.async('base64').then(data => {
                        const mimeType = this.getMimeType(filename);
                        const dataUrl = `data:${mimeType};base64,${data}`;
                        this.mediaFiles.set(filename, dataUrl);
                        console.log(`Loaded media: ${filename}`);
                    })
                );
            }
        });
        
        await Promise.all(filePromises);
        
        console.log('Media files loaded:', Array.from(this.mediaFiles.keys()));
        
        if (!chatContent) {
            throw new Error('No chat text file found in the ZIP archive');
        }
        
        this.showLoading('Parsing chat messages...');
        await this.parseAndRender(chatContent);
    },

    /**
     * Process multiple files (folder upload)
     */
    async processMultipleFiles(files) {
        this.showLoading('Processing files...');
        
        let chatContent = null;
        this.mediaFiles = new Map();
        
        // Find text file first
        const txtFile = files.find(f => f.name.endsWith('.txt'));
        
        if (!txtFile) {
            throw new Error('No chat text file found. Please include _chat.txt or a .txt file.');
        }
        
        // Extract chat name - try to use folder name from webkitRelativePath if available
        if (txtFile.webkitRelativePath) {
            // Extract folder name from path (e.g., "WhatsApp Chat - Name/_chat.txt" -> "WhatsApp Chat - Name")
            const pathParts = txtFile.webkitRelativePath.split('/');
            if (pathParts.length > 1) {
                this.chatName = pathParts[0].replace('WhatsApp Chat - ', '');
            } else {
                this.chatName = txtFile.name.replace('.txt', '').replace('_chat', '') || 'WhatsApp Chat';
            }
        } else {
            // Fallback to filename-based extraction
            this.chatName = txtFile.name.replace('.txt', '').replace('_chat', '').replace('WhatsApp Chat - ', '') || 'WhatsApp Chat';
        }
        
        // Read all files
        console.log('Processing files:', files.map(f => f.name));
        
        for (const file of files) {
            if (file.name.endsWith('.txt')) {
                chatContent = await this.readFileAsText(file);
                console.log('Loaded chat text:', file.name);
            } else if (this.isMediaFile(file.name)) {
                const dataUrl = await this.readFileAsDataURL(file);
                this.mediaFiles.set(file.name, dataUrl);
                console.log('Loaded media file:', file.name);
            }
        }
        
        console.log('Total media files loaded:', this.mediaFiles.size);
        console.log('Media filenames:', Array.from(this.mediaFiles.keys()));
        
        if (!chatContent) {
            throw new Error('No chat text file found');
        }
        
        await this.parseAndRender(chatContent);
    },

    /**
     * Parse chat content and render UI
     */
    async parseAndRender(chatContent) {
        this.showLoading('Parsing messages...');
        
        // Debug: show what media files we have
        console.log('Available media files for parsing:', Array.from(this.mediaFiles.keys()));
        
        // Parse the chat
        this.chatData = WhatsAppParser.parse(chatContent, this.mediaFiles);
        
        console.log(`📱 Export format detected: ${this.chatData.exportFormat || 'unknown'}`);
        console.log(`Parsed ${this.chatData.messages.length} messages`);
        console.log(`Found ${this.chatData.participants.length} participants`);
        console.log(`Media files available: ${this.mediaFiles.size}`);
        
        // Debug: check how many messages have media
        const messagesWithMedia = this.chatData.messages.filter(m => m.media && m.media.hasData);
        console.log(`Messages with loaded media: ${messagesWithMedia.length}`);
        
        this.showLoading('Rendering chat...');
        
        // Initialize renderer
        ChatRenderer.init(this.chatData, this.mediaFiles);
        
        // Populate participant selector
        this.populateParticipantSelector();
        
        // Update UI
        ChatRenderer.updateChatInfo(this.chatData, this.chatName);
        ChatRenderer.renderMessages('messagesList', this.chatData);
        
        // Set date picker min/max
        if (this.chatData.stats.firstDate) {
            const firstDateStr = this.formatDateForInput(this.chatData.stats.firstDate);
            const lastDateStr = this.formatDateForInput(this.chatData.stats.lastDate);
            
            if (this.elements.jumpDateInput) {
                this.elements.jumpDateInput.min = firstDateStr;
                this.elements.jumpDateInput.max = lastDateStr;
                this.elements.jumpDateInput.value = firstDateStr;
            }
            
            // Set date filter min/max
            if (this.elements.dateFilterStart) {
                this.elements.dateFilterStart.min = firstDateStr;
                this.elements.dateFilterStart.max = lastDateStr;
            }
            if (this.elements.dateFilterEnd) {
                this.elements.dateFilterEnd.min = firstDateStr;
                this.elements.dateFilterEnd.max = lastDateStr;
            }
        }
        
        // Show chat section, show header
        this.elements.uploadSection.style.display = 'none';
        this.elements.chatSection.style.display = 'flex';
        if (this.elements.mainHeader) {
            this.elements.mainHeader.style.display = 'flex';
        }
        
        this.hideLoading();
    },

    /**
     * Populate the participant selector list
     */
    populateParticipantSelector() {
        const participantsList = document.getElementById('participantsList');
        if (!participantsList || !this.chatData) return;
        
        participantsList.innerHTML = '';
        
        this.chatData.participants.forEach(participant => {
            const li = document.createElement('li');
            li.className = 'participant-item';
            li.dataset.participant = participant.name;
            
            const avatar = document.createElement('div');
            avatar.className = 'participant-avatar';
            avatar.textContent = participant.name.charAt(0).toUpperCase();
            
            const name = document.createElement('span');
            name.className = 'participant-name';
            name.textContent = participant.name;
            
            const count = document.createElement('span');
            count.className = 'participant-count';
            count.textContent = participant.count;
            
            li.appendChild(avatar);
            li.appendChild(name);
            li.appendChild(count);
            
            li.addEventListener('click', () => {
                // Remove selected class from all items
                participantsList.querySelectorAll('li').forEach(item => {
                    item.classList.remove('selected');
                });
                // Add selected class to clicked item
                li.classList.add('selected');
                
                ChatRenderer.setCurrentUser(participant.name);
                ChatRenderer.renderMessages('messagesList', this.chatData);
            });
            
            participantsList.appendChild(li);
        });
        
        // Auto-select the participant with most messages
        if (this.chatData.participants.length > 0) {
            const firstItem = participantsList.querySelector('li');
            if (firstItem) {
                firstItem.click();
            }
        }
    },

    /**
     * Apply date filter to messages
     */
    applyDateFilter() {
        const startDate = this.elements.dateFilterStart?.value;
        const endDate = this.elements.dateFilterEnd?.value;
        
        if (!startDate && !endDate) {
            ChatRenderer.renderMessages('messagesList', this.chatData);
            return;
        }
        
        const filteredMessages = this.chatData.messages.filter(msg => {
            if (!msg.timestamp) return false;
            const msgDate = new Date(msg.timestamp);
            msgDate.setHours(0, 0, 0, 0);
            
            if (startDate) {
                const start = new Date(startDate);
                if (msgDate < start) return false;
            }
            
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (msgDate > end) return false;
            }
            
            return true;
        });
        
        const filteredData = {
            ...this.chatData,
            messages: filteredMessages
        };
        
        ChatRenderer.renderMessages('messagesList', filteredData);
    },

    /**
     * Clear date filter
     */
    clearDateFilter() {
        if (this.elements.dateFilterStart) this.elements.dateFilterStart.value = '';
        if (this.elements.dateFilterEnd) this.elements.dateFilterEnd.value = '';
        ChatRenderer.renderMessages('messagesList', this.chatData);
    },

    /**
     * Export to PDF
     */
    async exportToPDF() {
        if (!this.chatData) return;
        
        this.showLoading('Generating PDF...');
        
        try {
            const filename = await ChatExporter.exportToPDF(
                this.chatData,
                this.chatName,
                this.mediaFiles,
                (progress) => this.showLoading(progress),
                this.exporterInfo
            );
            console.log(`PDF exported: ${filename}`);
        } catch (error) {
            console.error('PDF export error:', error);
            alert(`Export failed: ${error.message}`);
        }
        
        this.hideLoading();
    },

    /**
     * Export to HTML
     */
    async exportToHTML() {
        if (!this.chatData) return;
        
        this.showLoading('Generating HTML...');
        
        try {
            const filename = await ChatExporter.exportToHTML(
                this.chatData,
                this.chatName,
                this.mediaFiles
            );
            console.log(`HTML exported: ${filename}`);
        } catch (error) {
            console.error('HTML export error:', error);
            alert(`Export failed: ${error.message}`);
        }
        
        this.hideLoading();
    },

    /**
     * Reset to upload view
     */
    resetToUpload() {
        this.chatData = null;
        this.chatName = '';
        this.mediaFiles = new Map();
        this.elements.fileInput.value = '';
        this.elements.fileInputFolder.value = '';
        this.elements.fileInputSingle.value = '';
        this.elements.searchInput.value = '';
        
        this.elements.chatSection.style.display = 'none';
        this.elements.uploadSection.style.display = 'flex';
        if (this.elements.mainHeader) {
            this.elements.mainHeader.style.display = 'none';
        }
    },

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        this.elements.loadingText.textContent = message;
        this.elements.loadingOverlay.style.display = 'flex';
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.elements.loadingOverlay.style.display = 'none';
    },

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },

    /**
     * Read file as data URL
     */
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    },

    /**
     * Check if file is a media file
     */
    isMediaFile(filename) {
        const mediaExtensions = [
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
            'mp4', 'mov', 'avi', '3gp', 'mkv',
            'mp3', 'ogg', 'opus', 'm4a', 'wav', 'aac',
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
        ];
        const ext = filename.split('.').pop().toLowerCase();
        return mediaExtensions.includes(ext);
    },

    /**
     * Get MIME type for file
     */
    getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            // Images
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            heic: 'image/heic',
            heif: 'image/heif',
            // Videos
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            '3gp': 'video/3gpp',
            mkv: 'video/x-matroska',
            // Audio
            mp3: 'audio/mpeg',
            ogg: 'audio/ogg',
            opus: 'audio/opus',
            m4a: 'audio/mp4',
            wav: 'audio/wav',
            aac: 'audio/aac',
            // Documents
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    },

    /**
     * Format date for input element
     */
    formatDateForInput(date) {
        if (!(date instanceof Date)) return '';
        return date.toISOString().split('T')[0];
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
