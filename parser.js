/**
 * WhatsApp2PDF - Chat Parser
 * Parses WhatsApp export format into structured data
 * 
 * WhatsApp Export Format (iOS):
 * - Normal message: [MM/DD/YY, HH:MM:SS AM/PM] Sender: Message text
 * - Attachment: ‎[MM/DD/YY, HH:MM:SS AM/PM] Sender: ‎<attached: filename>
 * - Media omitted: ‎[MM/DD/YY, HH:MM:SS AM/PM] Sender: ‎image omitted
 * - System message: [MM/DD/YY, HH:MM:SS AM/PM] System text (no colon separator)
 * 
 * Special characters:
 * - U+200E (LRM) appears at start of lines and before certain content
 * - U+202F (Narrow No-Break Space) appears between time and AM/PM
 * - \r\n (CRLF) line endings on iOS exports
 */

const WhatsAppParser = {
    /**
     * Remove ALL invisible Unicode characters and normalize text
     */
    cleanText(text) {
        if (!text) return '';
        return text
            // Remove various invisible/formatting Unicode characters
            .replace(/[\u200e\u200f\u200b-\u200d\u2060-\u206f\u2028\u2029\ufeff]/g, '')
            // Replace narrow no-break space and other special spaces with regular space
            .replace(/[\u00a0\u202f\u2007\u2008\u2009\u200a]/g, ' ')
            // Remove left-to-right and right-to-left marks
            .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
            // Remove carriage returns
            .replace(/\r/g, '')
            // Normalize multiple spaces
            .replace(/  +/g, ' ')
            .trim();
    },

    /**
     * Parse the chat text content
     * @param {string} content - Raw chat text content
     * @param {Map} mediaFiles - Map of filename -> blob/dataURL
     * @returns {Object} Parsed chat data
     */
    parse(content, mediaFiles = new Map()) {
        // Normalize line endings and split
        const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        const messages = [];
        const participants = new Map();
        
        // WhatsApp message pattern - more flexible to handle various formats
        // Matches: [MM/DD/YY, HH:MM:SS AM/PM] Sender: Message
        const messagePattern = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s*([^:]+):\s*(.*)/;
        
        let currentMessage = null;
        let lastTimestamp = null;
        
        for (let i = 0; i < rawLines.length; i++) {
            // Clean the line of invisible characters
            const line = this.cleanText(rawLines[i]);
            
            // Skip empty lines
            if (!line) continue;
            
            // Try to match as a new message
            const match = line.match(messagePattern);
            
            if (match) {
                const [, dateStr, timeStr, sender, text] = match;
                const timestamp = this.parseDateTime(dateStr, timeStr);
                const cleanSender = this.cleanSenderName(sender);
                
                // Detect quoted/reply messages:
                // If this message's timestamp is EARLIER than the last message,
                // AND the previous message has empty/minimal text,
                // this is likely a quoted message being replied to
                const isQuotedMessage = lastTimestamp && 
                    timestamp < lastTimestamp && 
                    currentMessage && 
                    (!currentMessage.rawText || currentMessage.rawText.trim() === '');
                
                if (isQuotedMessage) {
                    // This is a quoted message - merge it into the previous message
                    currentMessage.quotedMessage = {
                        timestamp,
                        sender: cleanSender,
                        text: text
                    };
                    currentMessage.rawText = ''; // Clear the empty text
                    currentMessage.hasQuote = true;
                    continue;
                }
                
                // Check if this is a standalone empty message followed by what looks like quoted content
                // Skip empty messages that are just quote containers
                if (!text.trim() && currentMessage) {
                    // Look ahead to see if next line is a quoted message
                    const nextLine = i + 1 < rawLines.length ? this.cleanText(rawLines[i + 1]) : '';
                    const nextMatch = nextLine.match(messagePattern);
                    if (nextMatch) {
                        const nextTimestamp = this.parseDateTime(nextMatch[1], nextMatch[2]);
                        if (nextTimestamp < timestamp) {
                            // This empty message will contain a quote - save previous and continue
                            if (currentMessage) {
                                this.finalizeMessage(currentMessage, mediaFiles);
                                messages.push(currentMessage);
                            }
                            currentMessage = {
                                id: messages.length,
                                timestamp,
                                sender: cleanSender,
                                rawText: '',
                                text: '',
                                type: 'text',
                                media: null,
                                isSystem: false,
                                hasQuote: false
                            };
                            lastTimestamp = timestamp;
                            continue;
                        }
                    }
                }
                
                // Save previous message if exists
                if (currentMessage) {
                    this.finalizeMessage(currentMessage, mediaFiles);
                    messages.push(currentMessage);
                }
                
                // Track participant
                if (!this.isSystemSender(cleanSender)) {
                    const count = participants.get(cleanSender) || 0;
                    participants.set(cleanSender, count + 1);
                }
                
                currentMessage = {
                    id: messages.length,
                    timestamp,
                    sender: cleanSender,
                    rawText: text,
                    text: '',
                    type: 'text',
                    media: null,
                    isSystem: false,
                    hasQuote: false
                };
                
                lastTimestamp = timestamp;
            } else if (currentMessage) {
                // Continuation of previous message (multi-line)
                // If previous message was expecting a quote and got regular text, this is the reply
                if (currentMessage.hasQuote && currentMessage.rawText === '') {
                    currentMessage.rawText = line;
                } else {
                    currentMessage.rawText += '\n' + line;
                }
            } else {
                // Orphan line - might be a system message without sender
                const sysMatch = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s*(.+)/);
                if (sysMatch) {
                    if (currentMessage) {
                        this.finalizeMessage(currentMessage, mediaFiles);
                        messages.push(currentMessage);
                    }
                    
                    const [, dateStr, timeStr, text] = sysMatch;
                    currentMessage = {
                        id: messages.length,
                        timestamp: this.parseDateTime(dateStr, timeStr),
                        sender: 'System',
                        rawText: text,
                        text: '',
                        type: 'system',
                        media: null,
                        isSystem: true
                    };
                    lastTimestamp = currentMessage.timestamp;
                }
            }
        }
        
        // Don't forget the last message
        if (currentMessage) {
            this.finalizeMessage(currentMessage, mediaFiles);
            messages.push(currentMessage);
        }
        
        // Post-process: Remove empty messages and clean up
        const cleanedMessages = this.cleanupMessages(messages);
        
        // Process all messages for display
        const processedMessages = cleanedMessages.map(msg => ({
            ...msg,
            formattedTime: this.formatTime(msg.timestamp),
            formattedDate: this.formatDate(msg.timestamp)
        }));
        
        // Calculate statistics
        const stats = this.calculateStats(processedMessages, participants);
        
        return {
            messages: processedMessages,
            participants: Array.from(participants.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count),
            stats
        };
    },

    /**
     * Clean up messages - remove empty ones, handle edge cases
     */
    cleanupMessages(messages) {
        return messages.filter(msg => {
            // Keep messages with media
            if (msg.media) return true;
            
            // Keep messages with quoted content
            if (msg.quotedMessage) return true;
            
            // Keep messages with actual text
            if (msg.text && msg.text.trim()) return true;
            
            // Keep system messages
            if (msg.isSystem) return true;
            
            // Keep call messages
            if (msg.type === 'call' || msg.type === 'missed_call') return true;
            
            // Keep deleted messages
            if (msg.type === 'deleted') return true;
            
            // Filter out empty messages
            return false;
        });
    },

    /**
     * Finalize a message - determine type, extract media, clean text
     */
    finalizeMessage(message, mediaFiles) {
        const text = message.rawText || '';
        
        // Check for media attachment: <attached: filename>
        const attachMatch = text.match(/<\s*attached\s*:\s*([^>]+)>/i);
        if (attachMatch) {
            // Extra cleaning for filename - remove any non-printable characters
            let filename = attachMatch[1];
            filename = this.cleanText(filename);
            // Also remove any characters that aren't letters, numbers, dots, dashes, underscores
            filename = filename.replace(/[^\w\d.\-_]/g, '').trim();
            
            console.log(`📎 Attachment found in message: "${filename}" (raw: "${attachMatch[1]}")`);
            
            const extension = filename.split('.').pop().toLowerCase();
            
            // Find the media file
            let mediaData = this.findMediaFile(filename, mediaFiles);
            
            message.media = {
                filename,
                type: this.getMediaType(extension),
                extension,
                data: mediaData,
                hasData: !!mediaData
            };
            message.type = 'media';
            
            // Remove the attachment tag from text
            message.text = text.replace(/<\s*attached\s*:[^>]+>/gi, '').trim();
            return;
        }
        
        // Check for media omitted
        if (/(?:image|video|audio|sticker|document|GIF)\s*omitted/i.test(text)) {
            message.media = {
                filename: null,
                type: 'omitted',
                extension: null,
                data: null,
                hasData: false
            };
            message.type = 'media_omitted';
            message.text = '';
            return;
        }
        
        // Check for PDF document with attachment tag
        // Format: "filename.pdf • N pages <attached: actual-filename.pdf>"
        const pdfWithAttachMatch = text.match(/([^•]+\.pdf)\s*•\s*(\d+)\s*pages?\s*<\s*attached\s*:\s*([^>]+)>/i);
        if (pdfWithAttachMatch) {
            const displayName = pdfWithAttachMatch[1].trim();
            const pages = pdfWithAttachMatch[2];
            const actualFilename = this.cleanText(pdfWithAttachMatch[3]);
            
            // Find the PDF file
            let mediaData = this.findMediaFile(actualFilename, mediaFiles);
            
            message.media = {
                filename: actualFilename,
                displayName: displayName,
                type: 'document',
                extension: 'pdf',
                data: mediaData,
                hasData: !!mediaData,
                pages: pages
            };
            message.type = 'document';
            message.text = `${displayName} • ${pages} pages`;
            return;
        }
        
        // Check for document omitted (PDF, etc.) - no attachment tag
        const docMatch = text.match(/([^•]+\.pdf)\s*•\s*(\d+)\s*pages?\s*(?:document\s*omitted)?/i);
        if (docMatch || /•.*document\s*omitted/i.test(text)) {
            message.media = {
                filename: docMatch ? docMatch[1].trim() : null,
                type: 'document',
                extension: 'pdf',
                data: null,
                hasData: false,
                pages: docMatch ? docMatch[2] : null
            };
            message.type = 'document_omitted';
            message.text = docMatch ? `${docMatch[1]} • ${docMatch[2]} pages` : '';
            return;
        }
        
        // Check for voice/video call
        if (/Voice\s*call|Video\s*call/i.test(text)) {
            message.type = 'call';
            const callMatch = text.match(/(Voice\s*call|Video\s*call)(?:,?\s*(\d+\s*(?:min|sec|hr|hour|minute|second)s?))?/i);
            if (callMatch) {
                message.text = callMatch[1] + (callMatch[2] ? `, ${callMatch[2]}` : '');
            } else {
                message.text = text;
            }
            return;
        }
        
        // Check for missed call
        if (/Missed.*call/i.test(text)) {
            message.type = 'missed_call';
            message.text = text;
            return;
        }
        
        // Check for deleted message
        if (/This message was deleted|You deleted this message/i.test(text)) {
            message.type = 'deleted';
            message.text = 'This message was deleted';
            return;
        }
        
        // Check for system message content
        if (/Messages and calls are end-to-end encrypted/i.test(text) ||
            /created group|added|left|removed|changed the subject|changed this group/i.test(text)) {
            message.isSystem = true;
            message.type = 'system';
        }
        
        // Regular text message - clean it up
        message.text = this.cleanMessageText(text);
    },

    /**
     * Find media file with flexible matching
     */
    findMediaFile(filename, mediaFiles) {
        if (!filename || mediaFiles.size === 0) {
            console.log(`✗ Media search skipped: filename="${filename}", mediaFiles.size=${mediaFiles.size}`);
            return null;
        }
        
        console.log(`🔍 Searching for media: "${filename}" (length: ${filename.length})`);
        console.log(`   Available files: ${Array.from(mediaFiles.keys()).map(k => `"${k}"`).join(', ')}`);
        
        // Exact match
        if (mediaFiles.has(filename)) {
            console.log(`✓ Media found (exact match): ${filename}`);
            return mediaFiles.get(filename);
        }
        
        // Case-insensitive match
        const filenameLower = filename.toLowerCase();
        for (const [key, value] of mediaFiles) {
            if (key.toLowerCase() === filenameLower) {
                console.log(`✓ Media found (case-insensitive): ${filename} -> ${key}`);
                return value;
            }
        }
        
        // Try without any extra characters - extract just the core filename
        const coreMatch = filename.match(/(\d{5,}[-_](?:PHOTO|VIDEO|AUDIO|DOCUMENT|FILE)[-_\d]+\.\w+)/i);
        if (coreMatch) {
            const coreFilename = coreMatch[1];
            console.log(`   Trying core filename: "${coreFilename}"`);
            for (const [key, value] of mediaFiles) {
                if (key.includes(coreFilename) || coreFilename.includes(key)) {
                    console.log(`✓ Media found (core match): ${filename} -> ${key}`);
                    return value;
                }
            }
        }
        
        // Last resort: fuzzy match on numeric part
        const numericPart = filename.match(/(\d{8,})/);
        if (numericPart) {
            console.log(`   Trying numeric part: "${numericPart[1]}"`);
            for (const [key, value] of mediaFiles) {
                if (key.includes(numericPart[1])) {
                    console.log(`✓ Media found (numeric match): ${filename} -> ${key}`);
                    return value;
                }
            }
        }
        
        console.log(`✗ Media NOT found: "${filename}"`);
        return null;
    },

    /**
     * Clean message text for display
     */
    cleanMessageText(text) {
        if (!text) return '';
        
        // Remove any leftover attachment tags
        text = text.replace(/<\s*attached\s*:[^>]+>/gi, '');
        
        // Remove "omitted" text
        text = text.replace(/(?:image|video|audio|sticker|document|GIF)\s*omitted/gi, '');
        text = text.replace(/•.*document\s*omitted/gi, '');
        
        // Clean and normalize
        text = this.cleanText(text);
        
        return text;
    },

    /**
     * Clean sender name
     */
    cleanSenderName(sender) {
        if (!sender) return 'Unknown';
        return this.cleanText(sender).replace(/^~+/, '').trim() || 'Unknown';
    },

    /**
     * Check if sender is a system sender
     */
    isSystemSender(sender) {
        const s = sender.toLowerCase();
        return s === 'system' || s.includes('whatsapp');
    },

    /**
     * Parse date and time into a Date object
     */
    parseDateTime(dateStr, timeStr) {
        try {
            // Clean the strings
            dateStr = this.cleanText(dateStr);
            timeStr = this.cleanText(timeStr);
            
            // Parse date (MM/DD/YY or DD/MM/YY)
            const dateParts = dateStr.split('/').map(p => parseInt(p, 10));
            if (dateParts.length !== 3) return new Date();
            
            let [month, day, year] = dateParts;
            
            // Handle 2-digit year
            if (year < 100) {
                year += year < 50 ? 2000 : 1900;
            }
            
            // If month > 12, swap (DD/MM/YY format)
            if (month > 12) {
                [month, day] = [day, month];
            }
            
            // Parse time
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
            if (!timeMatch) return new Date(year, month - 1, day);
            
            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
            const period = timeMatch[4];
            
            if (period) {
                if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                else if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
            }
            
            return new Date(year, month - 1, day, hours, minutes, seconds);
        } catch (e) {
            console.error('Date parse error:', e);
            return new Date();
        }
    },

    /**
     * Get media type from extension
     */
    getMediaType(extension) {
        const ext = (extension || '').toLowerCase();
        const types = {
            jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', heic: 'image',
            mp4: 'video', mov: 'video', avi: 'video', '3gp': 'video', mkv: 'video',
            mp3: 'audio', ogg: 'audio', opus: 'audio', m4a: 'audio', wav: 'audio', aac: 'audio',
            pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document'
        };
        return types[ext] || 'file';
    },

    /**
     * Format time for display
     */
    formatTime(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    },

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    },

    /**
     * Calculate chat statistics
     */
    calculateStats(messages, participants) {
        const mediaMessages = messages.filter(m => 
            m.type === 'media' || m.type === 'media_omitted' || m.type === 'document_omitted'
        );
        
        const dates = messages
            .map(m => m.timestamp)
            .filter(d => d instanceof Date && !isNaN(d))
            .sort((a, b) => a - b);
        
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        
        return {
            totalMessages: messages.length,
            mediaMessages: mediaMessages.length,
            participants: participants.size,
            firstDate,
            lastDate,
            dateRange: this.formatDateRange(firstDate, lastDate)
        };
    },

    /**
     * Format date range for display
     */
    formatDateRange(start, end) {
        if (!start || !end) return '-';
        const opts = { month: 'short', day: 'numeric', year: 'numeric' };
        const startStr = start.toLocaleDateString('en-US', opts);
        const endStr = end.toLocaleDateString('en-US', opts);
        return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhatsAppParser;
}
