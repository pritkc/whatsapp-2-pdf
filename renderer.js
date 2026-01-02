/**
 * WhatsApp2PDF - Chat Renderer
 * Renders parsed chat data into WhatsApp-style UI
 */

const ChatRenderer = {
    // Reference to the current user (for outgoing messages)
    currentUser: null,
    
    // All messages for search functionality
    allMessages: [],
    
    // Media files map
    mediaFiles: new Map(),

    /**
     * Initialize the renderer
     * @param {Object} chatData - Parsed chat data
     * @param {Map} mediaFiles - Map of media files
     */
    init(chatData, mediaFiles = new Map()) {
        this.allMessages = chatData.messages;
        this.mediaFiles = mediaFiles;
        
        // Don't auto-set current user here - let the user choose via selector
        // Default will be set by app.js after selector is populated
    },

    /**
     * Set the current user (for determining message direction)
     * @param {string} userName - Name of the current user
     */
    setCurrentUser(userName) {
        this.currentUser = userName;
    },

    /**
     * Render all messages to the container
     * @param {string} containerId - ID of the container element
     * @param {Object} chatData - Parsed chat data
     */
    renderMessages(containerId, chatData) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        let lastDate = null;
        let lastSender = null;
        
        chatData.messages.forEach((message, index) => {
            // Add date separator if needed
            if (message.formattedDate !== lastDate) {
                container.appendChild(this.createDateSeparator(message.formattedDate));
                lastDate = message.formattedDate;
                lastSender = null; // Reset sender grouping on new day
            }
            
            // Create and append message element
            const showSender = message.sender !== lastSender && !message.isSystem;
            const messageEl = this.createMessageElement(message, showSender);
            container.appendChild(messageEl);
            
            lastSender = message.sender;
        });
        
        // Scroll to bottom
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    },

    /**
     * Create a date separator element
     */
    createDateSeparator(dateText) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.innerHTML = `<span>${this.escapeHtml(dateText)}</span>`;
        return separator;
    },

    /**
     * Create a message element
     */
    createMessageElement(message, showSender = true) {
        const wrapper = document.createElement('div');
        wrapper.className = `message ${this.getMessageClass(message)}`;
        wrapper.dataset.messageId = message.id;
        wrapper.dataset.timestamp = message.timestamp ? message.timestamp.getTime() : 0;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        // Add sender name for incoming messages (in groups)
        if (showSender && !message.isSystem && this.getMessageClass(message) === 'incoming') {
            const senderEl = document.createElement('div');
            senderEl.className = 'message-sender';
            senderEl.textContent = message.sender;
            bubble.appendChild(senderEl);
        }
        
        // Add quoted message if present (reply feature)
        if (message.quotedMessage) {
            const quoteEl = document.createElement('div');
            quoteEl.className = 'quoted-message';
            quoteEl.innerHTML = `
                <div class="quoted-sender">${this.escapeHtml(message.quotedMessage.sender || '')}</div>
                <div class="quoted-text">${this.escapeHtml(message.quotedMessage.text || 'Media')}</div>
            `;
            bubble.appendChild(quoteEl);
        }
        
        // Add media if present
        if (message.media) {
            bubble.appendChild(this.createMediaElement(message.media));
        }
        
        // Add message text
        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.innerHTML = this.formatMessageText(message);
        
        if (textEl.innerHTML.trim()) {
            bubble.appendChild(textEl);
        }
        
        // Add timestamp (not for system messages)
        if (!message.isSystem) {
            const metaEl = document.createElement('div');
            metaEl.className = 'message-meta';
            metaEl.innerHTML = `<span class="message-time">${this.escapeHtml(message.formattedTime || '')}</span>`;
            bubble.appendChild(metaEl);
        }
        
        wrapper.appendChild(bubble);
        return wrapper;
    },

    /**
     * Get message CSS class (incoming/outgoing/system/call)
     */
    getMessageClass(message) {
        if (message.isSystem || message.type === 'system') {
            return 'system';
        }
        
        if (message.type === 'call' || message.type === 'missed_call') {
            const baseClass = this.currentUser && message.sender === this.currentUser ? 'outgoing' : 'incoming';
            return `${baseClass} ${message.type === 'missed_call' ? 'missed_call' : 'call'}`;
        }
        
        // Simple heuristic: if sender matches current user pattern, it's outgoing
        // This is a best-effort approach since WhatsApp exports don't explicitly mark this
        if (this.currentUser && message.sender === this.currentUser) {
            return 'outgoing';
        }
        
        // For 1-on-1 chats, we can use message position or other heuristics
        // Default to incoming if we can't determine
        return 'incoming';
    },

    /**
     * Create media element
     */
    createMediaElement(media) {
        const container = document.createElement('div');
        container.className = 'message-media';
        
        // Handle "omitted" type (user chose not to export media)
        if (media.type === 'omitted') {
            container.innerHTML = `
                <div class="media-placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    <span>Media not included in export</span>
                </div>
            `;
            return container;
        }
        
        // Handle images with data
        if (media.type === 'image' && media.hasData) {
            const img = document.createElement('img');
            img.src = media.data;
            img.alt = media.filename || 'Image';
            img.loading = 'lazy';
            img.onclick = () => this.openLightbox(media.data);
            container.appendChild(img);
            return container;
        }
        
        // Handle video with data
        if (media.type === 'video' && media.hasData) {
            const video = document.createElement('video');
            video.src = media.data;
            video.controls = true;
            video.preload = 'metadata';
            container.appendChild(video);
            return container;
        }
        
        // Handle audio with data
        if (media.type === 'audio' && media.hasData) {
            const audio = document.createElement('audio');
            audio.src = media.data;
            audio.controls = true;
            container.appendChild(audio);
            return container;
        }
        
        // Handle documents with data (PDF, etc.)
        if (media.type === 'document' && media.hasData) {
            container.innerHTML = `
                <div class="media-placeholder" style="cursor: pointer;" onclick="window.open('${media.data}', '_blank')">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                    <span>📄 ${this.escapeHtml(media.filename || 'Document')} (click to view)</span>
                </div>
            `;
            return container;
        }
        
        // Fallback: Media referenced but not loaded
        const icon = media.type === 'image' ? '🖼️' : 
                     media.type === 'video' ? '🎥' : 
                     media.type === 'audio' ? '🎵' : 
                     media.type === 'document' ? '📄' : '📎';
        
        const statusText = media.hasData ? '' : ' (file not found in archive)';
        
        container.innerHTML = `
            <div class="media-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                <span>${icon} ${this.escapeHtml(media.filename || 'File')}${statusText}</span>
            </div>
        `;
        
        return container;
    },

    /**
     * Format message text with links and special formatting
     */
    formatMessageText(message) {
        let text = message.text || '';
        
        // Clean any remaining timestamp patterns from the text
        text = text.replace(/\[\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\]\s*~?[^:]*:\s*/gi, '');
        text = text.replace(/^\[\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\]\s*/gm, '');
        text = text.trim();
        
        // Handle special message types
        if (message.type === 'call') {
            // Extract just the call info, remove any attached timestamps
            const callMatch = text.match(/(Voice call|Video call)[,\s]*([\d\s]+(?:min|sec|hr)?)?/i);
            if (callMatch) {
                const duration = callMatch[2] ? `, ${callMatch[2].trim()}` : '';
                return `<span style="color: #f97316">${callMatch[1]}${duration}</span>`;
            }
            return `<span style="color: #f97316">${this.escapeHtml(text)}</span>`;
        }
        
        if (message.type === 'missed_call') {
            return `<span style="opacity: 0.7">📵 ${this.escapeHtml(text)}</span>`;
        }
        
        if (message.type === 'deleted') {
            return `<span style="opacity: 0.5; font-style: italic">🚫 This message was deleted</span>`;
        }
        
        if (message.type === 'document_omitted') {
            return `<span style="opacity: 0.7">📄 Document not included in export</span>`;
        }
        
        // Escape HTML first
        text = this.escapeHtml(text);
        
        // Convert URLs to clickable links
        text = text.replace(
            /(https?:\/\/[^\s<]+)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Convert newlines to <br>
        text = text.replace(/\n/g, '<br>');
        
        // Basic WhatsApp formatting
        // Bold: *text*
        text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
        // Italic: _text_
        text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
        // Strikethrough: ~text~
        text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
        // Monospace: ```text```
        text = text.replace(/```([^`]+)```/g, '<code>$1</code>');
        
        return text;
    },

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Open image in lightbox
     */
    openLightbox(src) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `<img src="${src}" alt="Full size image">`;
        lightbox.onclick = () => lightbox.remove();
        document.body.appendChild(lightbox);
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                lightbox.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    },

    /**
     * Update chat info sidebar (stats and title only)
     * Note: Participants list is handled separately by populateParticipantSelector in app.js
     */
    updateChatInfo(chatData, chatName) {
        // Update stats
        document.getElementById('msgCount').textContent = chatData.stats.totalMessages.toLocaleString();
        document.getElementById('mediaCount').textContent = chatData.stats.mediaMessages.toLocaleString();
        document.getElementById('dateRange').textContent = chatData.stats.dateRange;
        
        // Update title
        document.getElementById('chatTitle').textContent = chatName;
        document.getElementById('chatSubtitle').textContent = 
            `${chatData.stats.totalMessages} messages, ${chatData.participants.length} participants`;
        
        // Note: Don't update participants list here - it's handled by populateParticipantSelector
        // which sets up click handlers for POV switching
    },

    /**
     * Get initials from name
     */
    getInitials(name) {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    },

    /**
     * Get consistent color for participant
     */
    getParticipantColor(index) {
        const colors = [
            '#00a884', '#7c3aed', '#ea580c', '#0891b2', 
            '#be185d', '#4f46e5', '#059669', '#dc2626'
        ];
        return colors[index % colors.length];
    },

    /**
     * Search messages and highlight results
     */
    searchMessages(query) {
        if (!query.trim()) {
            // Reset search - show all messages normally
            this.renderMessages('messagesList', { messages: this.allMessages });
            return [];
        }
        
        const lowerQuery = query.toLowerCase();
        const results = [];
        
        this.allMessages.forEach(msg => {
            const msgText = (msg.text || '').toLowerCase();
            const msgSender = (msg.sender || '').toLowerCase();
            if (msgText.includes(lowerQuery) || msgSender.includes(lowerQuery)) {
                results.push(msg);
            }
        });
        
        // Re-render with only matching messages
        this.renderMessages('messagesList', { messages: results });
        
        // Highlight matches in the UI after rendering
        setTimeout(() => {
            this.highlightSearchResults(query);
        }, 50);
        
        return results;
    },

    /**
     * Highlight search results in the message list
     */
    highlightSearchResults(query) {
        const messages = document.querySelectorAll('.message-text');
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        
        messages.forEach(msgEl => {
            // Get original text (stored in data attribute or recompute)
            const originalHtml = msgEl.innerHTML;
            
            // Remove existing highlights
            const cleanHtml = originalHtml.replace(/<span class="highlight">([^<]+)<\/span>/gi, '$1');
            
            // Add new highlights
            if (query.trim()) {
                msgEl.innerHTML = cleanHtml.replace(regex, '<span class="highlight">$1</span>');
            } else {
                msgEl.innerHTML = cleanHtml;
            }
        });
    },

    /**
     * Escape special regex characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Jump to a specific date in the chat
     */
    jumpToDate(date) {
        const targetDate = new Date(date);
        const targetDateStr = targetDate.toDateString();
        
        // Find the first message on that date
        const messageEl = document.querySelector(`.message[data-timestamp]`);
        const allMessages = document.querySelectorAll('.message[data-timestamp]');
        
        for (const msg of allMessages) {
            const msgDate = new Date(parseInt(msg.dataset.timestamp));
            if (msgDate.toDateString() === targetDateStr) {
                msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                msg.style.animation = 'none';
                msg.offsetHeight; // Trigger reflow
                msg.style.animation = 'messageIn 0.3s ease';
                return true;
            }
        }
        
        return false;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatRenderer;
}

