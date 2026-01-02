/**
 * WhatsApp2PDF Exporter
 * Handles exporting chat data to various formats (PDF, HTML)
 * Optimized for printing with compact layout
 */

const ChatExporter = {
    // Export options (can be modified before export)
    exportOptions: {
        includeAttachments: true,
        includeImageGallery: true
    },

    /**
     * Export chat to PDF with proper formatting
     * @param {Object} chatData - Parsed chat data
     * @param {string} chatName - Name of the chat
     * @param {Map} mediaFiles - Map of media files
     * @param {Function} onProgress - Progress callback
     * @param {Object} exporterInfo - Info about who exported (IP, location, etc.)
     */
    async exportToPDF(chatData, chatName, mediaFiles = new Map(), onProgress = () => {}, exporterInfo = null) {
        onProgress('Preparing document...');
        
        const { jsPDF } = window.jspdf;
        
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const PAGE_WIDTH = doc.internal.pageSize.getWidth();
        const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
        const MARGIN = 10;
        const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
        const MAX_BUBBLE_WIDTH = CONTENT_WIDTH * 0.70;
        const LINE_HEIGHT = 3.8;
        const FONT_SIZE = 8.5;
        const SMALL_FONT = 6.5;
        
        let y = MARGIN;
        
        // Colors
        const COLORS = {
            headerBg: [0, 128, 105],
            outgoingBg: [217, 253, 211],
            incomingBg: [255, 255, 255],
            systemBg: [242, 242, 242],
            textDark: [17, 27, 33],
            textGray: [102, 119, 129],
            accent: [0, 168, 132],
            border: [200, 200, 200],
            warningBg: [255, 243, 205],
            warningText: [180, 83, 9]
        };
        
        // Helper: Add new page if needed
        const ensureSpace = (needed) => {
            if (y + needed > PAGE_HEIGHT - MARGIN) {
                doc.addPage();
                y = MARGIN;
                return true;
            }
            return false;
        };
        
        // Helper: Draw rounded rectangle
        const drawRect = (x, yPos, w, h, radius, color, stroke = false) => {
            doc.setFillColor(...color);
            if (radius > 0) {
                doc.roundedRect(x, yPos, w, h, radius, radius, 'F');
            } else {
                doc.rect(x, yPos, w, h, 'F');
            }
            if (stroke) {
                doc.setDrawColor(...COLORS.border);
                doc.setLineWidth(0.2);
                if (radius > 0) {
                    doc.roundedRect(x, yPos, w, h, radius, radius, 'S');
                } else {
                    doc.rect(x, yPos, w, h, 'S');
                }
            }
        };
        
        // Helper: Wrap text and calculate dimensions
        const wrapText = (text, maxWidth, fontSize) => {
            doc.setFontSize(fontSize);
            return doc.splitTextToSize(text || '', maxWidth);
        };
        
        // Helper: Get text width
        const getTextWidth = (text, fontSize) => {
            doc.setFontSize(fontSize);
            return doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
        };
        
        // Get current user POV
        const currentUser = ChatRenderer?.currentUser || chatData.participants[0]?.name || 'Unknown';
        
        // ========== COVER PAGE ==========
        // Header background - compact
        drawRect(0, 0, PAGE_WIDTH, 48, 0, COLORS.headerBg);
        
        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('WhatsApp Chat Export', PAGE_WIDTH / 2, 18, { align: 'center' });
        
        // Chat name
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const chatNameWrapped = wrapText(chatName, PAGE_WIDTH - 40, 11);
        doc.text(chatNameWrapped, PAGE_WIDTH / 2, 30, { align: 'center' });
        
        // POV indicator
        doc.setFontSize(9);
        doc.text(`Viewing as: ${this.cleanTextForPDF(currentUser)}`, PAGE_WIDTH / 2, 42, { align: 'center' });
        
        y = 55;
        
        // ========== DISCLAIMER BOX (FIRST PAGE) ==========
        const disclaimerY = y;
        drawRect(MARGIN, disclaimerY, CONTENT_WIDTH, 38, 3, COLORS.warningBg);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.warningText);
        doc.text('Document Disclaimer', MARGIN + 4, disclaimerY + 6);
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textDark);
        const disclaimerText = [
            'This PDF was generated from a WhatsApp chat export. All processing occurred locally - no data was transmitted externally.',
            'The original export file can be modified before processing. For legal/evidentiary purposes, retain the original .zip file.',
            'WhatsApp Limitations: Reply context is not included in exports. Image captions and message edits are not preserved.'
        ];
        
        let disclaimerTextY = disclaimerY + 12;
        disclaimerText.forEach(line => {
            const wrapped = wrapText('• ' + line, CONTENT_WIDTH - 8, 7);
            wrapped.forEach(wline => {
                doc.text(wline, MARGIN + 4, disclaimerTextY);
                disclaimerTextY += 3.2;
            });
        });
        
        y = disclaimerY + 42;
        
        // ========== EXPORT INFO ==========
        drawRect(MARGIN, y, CONTENT_WIDTH, 18, 2, [245, 247, 250]);
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.textGray);
        doc.text(`Generated: ${new Date().toLocaleString()}`, MARGIN + 4, y + 5);
        doc.text(`POV: ${this.cleanTextForPDF(currentUser)} (messages on right side)`, MARGIN + 4, y + 10);
        
        if (exporterInfo) {
            let exporterText = 'Exported by: ';
            if (exporterInfo.ip) exporterText += `IP ${exporterInfo.ip}`;
            if (exporterInfo.location) exporterText += ` | ${exporterInfo.location}`;
            doc.text(exporterText, MARGIN + 4, y + 15);
        } else {
            doc.text('Exported by: WhatsApp2PDF (client-side processing)', MARGIN + 4, y + 15);
        }
        
        y += 22;
        
        // ========== STATS (compact two-column layout) ==========
        const stats = [
            ['Messages', chatData.stats.totalMessages.toLocaleString()],
            ['Media', chatData.stats.mediaMessages.toLocaleString()],
            ['Participants', chatData.participants.length.toString()],
            ['Period', chatData.stats.dateRange || '-']
        ];
        
        doc.setFontSize(8);
        const colWidth = (CONTENT_WIDTH - 5) / 2;
        
        stats.forEach(([label, value], index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const xPos = MARGIN + (col * colWidth);
            const yPos = y + (row * 8);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.textGray);
            doc.text(label + ':', xPos, yPos);
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.textDark);
            doc.text(value, xPos + 28, yPos);
        });
        
        y += 20;
        
        // ========== PARTICIPANTS (compact multi-column layout) ==========
        drawRect(MARGIN, y, CONTENT_WIDTH, 1, 0, COLORS.border);
        y += 4;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.textDark);
        doc.text('Participants:', MARGIN, y);
        y += 4;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        
        // Calculate how many participants can fit - use 3 columns for more space efficiency
        const maxParticipantsY = PAGE_HEIGHT - 25;
        const participantLineHeight = 3.5;
        const numColumns = 3;
        const colWidthParticipants = (CONTENT_WIDTH - 10) / numColumns;
        
        const maxRows = Math.floor((maxParticipantsY - y) / participantLineHeight);
        const maxParticipants = Math.min(maxRows * numColumns, chatData.participants.length);
        const participantsToShow = chatData.participants.slice(0, maxParticipants);
        
        participantsToShow.forEach((p, index) => {
            const col = index % numColumns;
            const row = Math.floor(index / numColumns);
            const xPos = MARGIN + 2 + (col * colWidthParticipants);
            const yPos = y + (row * participantLineHeight);
            
            // Highlight current user
            if (p.name === currentUser) {
                doc.setTextColor(...COLORS.accent);
                doc.setFont('helvetica', 'bold');
            } else {
                doc.setTextColor(...COLORS.textGray);
                doc.setFont('helvetica', 'normal');
            }
            
            const participantText = `• ${this.cleanTextForPDF(p.name)} (${p.count})`;
            const truncatedText = participantText.length > 25 
                ? participantText.substring(0, 22) + '...' 
                : participantText;
            doc.text(truncatedText, xPos, yPos);
        });
        
        // Calculate rows used
        const rowsUsed = Math.ceil(participantsToShow.length / numColumns);
        y += (rowsUsed * participantLineHeight) + 2;
        
        if (chatData.participants.length > participantsToShow.length) {
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.textGray);
            doc.setFont('helvetica', 'italic');
            doc.text(`... and ${chatData.participants.length - participantsToShow.length} more participants`, MARGIN + 2, y);
            y += 4;
        }
        
        // Footer
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.textGray);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by WhatsApp2PDF • whatsapp2pdf.com • Your data never left your device', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' });
        
        // ========== MESSAGE PAGES ==========
        doc.addPage();
        y = MARGIN;
        
        let lastDate = null;
        const totalMessages = chatData.messages.length;
        
        for (let i = 0; i < totalMessages; i++) {
            const msg = chatData.messages[i];
            
            if (i % 100 === 0) {
                onProgress(`Processing message ${i + 1} of ${totalMessages}...`);
                await new Promise(r => setTimeout(r, 0));
            }
            
            // ===== DATE SEPARATOR =====
            if (msg.formattedDate !== lastDate) {
                ensureSpace(10);
                
                const dateText = msg.formattedDate || 'Unknown Date';
                const dateWidth = getTextWidth(dateText, 7) + 10;
                const dateX = (PAGE_WIDTH - dateWidth) / 2;
                
                drawRect(dateX, y, dateWidth, 5, 2, COLORS.systemBg);
                doc.setFontSize(7);
                doc.setTextColor(...COLORS.textGray);
                doc.setFont('helvetica', 'normal');
                doc.text(dateText, PAGE_WIDTH / 2, y + 3.5, { align: 'center' });
                
                y += 8;
                lastDate = msg.formattedDate;
            }
            
            // ===== SYSTEM MESSAGE =====
            if (msg.isSystem) {
                const sysTextClean = this.cleanTextForPDF(msg.text || 'System message');
                const sysText = wrapText(sysTextClean, CONTENT_WIDTH - 30, 7);
                const sysHeight = sysText.length * 3 + 3;
                
                ensureSpace(sysHeight + 3);
                
                const sysWidth = Math.min(
                    CONTENT_WIDTH - 20,
                    Math.max(...sysText.map(line => getTextWidth(line, 7))) + 10
                );
                const sysX = (PAGE_WIDTH - sysWidth) / 2;
                
                drawRect(sysX, y, sysWidth, sysHeight, 2, COLORS.systemBg);
                doc.setFontSize(7);
                doc.setTextColor(...COLORS.textGray);
                doc.text(sysText, PAGE_WIDTH / 2, y + 3, { align: 'center' });
                
                y += sysHeight + 2;
                continue;
            }
            
            // ===== REGULAR MESSAGE =====
            const isOutgoing = msg.sender === currentUser;
            const bubbleColor = isOutgoing ? COLORS.outgoingBg : COLORS.incomingBg;
            
            // Prepare content
            const sender = this.cleanTextForPDF(msg.sender || 'Unknown');
            const text = this.cleanTextForPDF(msg.text || '');
            const time = msg.formattedTime || '';
            const hasMedia = msg.media && (msg.media.hasData || msg.media.type === 'omitted' || msg.media.filename);
            
            // Calculate wrapped text
            const textPadding = 4;
            const innerWidth = MAX_BUBBLE_WIDTH - (textPadding * 2);
            const wrappedText = text ? wrapText(text, innerWidth, FONT_SIZE) : [];
            
            // Check if we should embed image thumbnail
            const embedImage = this.exportOptions.includeAttachments && hasMedia && msg.media.hasData && msg.media.type === 'image' && msg.media.data;
            const thumbnailHeight = embedImage ? 35 : 0;
            
            // Calculate bubble dimensions - COMPACT layout
            // Don't add base padding separately - it will be accounted for in top/bottom positioning
            let bubbleHeight = 0;
            const heightBreakdown = {};
            
            // Top padding for outgoing messages, sender name for incoming
            if (isOutgoing) {
                bubbleHeight += 3.5; // Top padding for outgoing messages (enough space from border)
                heightBreakdown.topPadding = 3.5;
            } else {
                bubbleHeight += 4; // Sender name space for incoming
                heightBreakdown.senderSpace = 4;
            }
            
            // Media placeholder or embedded image
            if (hasMedia) {
                if (embedImage) {
                    bubbleHeight += thumbnailHeight + 2;
                    heightBreakdown.media = thumbnailHeight + 2;
                } else {
                    bubbleHeight += 8;
                    heightBreakdown.media = 8;
                }
            }
            
            // Message text
            if (wrappedText.length > 0) {
                const textHeight = wrappedText.length * LINE_HEIGHT + 1;
                bubbleHeight += textHeight;
                heightBreakdown.text = textHeight;
            }
            
            // Time footer - only add space for time text height (2.5mm) + small gap (0.5mm)
            const timeTextHeightCalc = SMALL_FONT * 0.35; // ~2.27mm
            bubbleHeight += timeTextHeightCalc + 0.5; // Time height + minimal gap
            heightBreakdown.timeFooter = timeTextHeightCalc + 0.5;
            
            // Calculate bubble width
            let maxLineWidth = 0;
            if (!isOutgoing) {
                maxLineWidth = Math.max(maxLineWidth, getTextWidth(sender, SMALL_FONT));
            }
            wrappedText.forEach(line => {
                maxLineWidth = Math.max(maxLineWidth, getTextWidth(line, FONT_SIZE));
            });
            maxLineWidth = Math.max(maxLineWidth, getTextWidth(time, SMALL_FONT) + 4);
            if (hasMedia) {
                maxLineWidth = Math.max(maxLineWidth, 50);
            }
            
            const bubbleWidth = Math.min(MAX_BUBBLE_WIDTH, Math.max(maxLineWidth + textPadding * 2 + 3, 40));
            
            ensureSpace(bubbleHeight + 2);
            
            // Position bubble
            const bubbleX = isOutgoing ? PAGE_WIDTH - MARGIN - bubbleWidth : MARGIN;
            
            // Draw bubble
            drawRect(bubbleX, y, bubbleWidth, bubbleHeight, 2, bubbleColor, true);
            
            // Different top padding for outgoing vs incoming - match the calculated space
            let textY = isOutgoing ? y + 3.5 : y + 2;
            
            // DIAGNOSTIC LOGGING - Track padding calculations
            if (i < 5 || (i % 50 === 0)) { // Log first 5 messages and every 50th
                const actualTopPadding = textY - y;
                const calculatedTopSpace = heightBreakdown.base + (heightBreakdown.topPadding || heightBreakdown.senderSpace || 0);
                const logData = {
                    bubbleHeight: bubbleHeight.toFixed(2),
                    bubbleTop: y.toFixed(2),
                    bubbleBottom: (y + bubbleHeight).toFixed(2),
                    textY: textY.toFixed(2),
                    actualTopPadding: actualTopPadding.toFixed(2),
                    calculatedTopSpace: calculatedTopSpace.toFixed(2),
                    topPaddingDiff: (calculatedTopSpace - actualTopPadding).toFixed(2),
                    heightBreakdown: JSON.parse(JSON.stringify(heightBreakdown))
                };
                console.log(`[MSG ${i}] ${isOutgoing ? 'OUTGOING' : 'INCOMING'}:`, JSON.stringify(logData, null, 2));
            }
            
            // Sender name (only for incoming)
            if (!isOutgoing) {
                doc.setFontSize(SMALL_FONT);
                doc.setTextColor(...COLORS.accent);
                doc.setFont('helvetica', 'bold');
                const senderTrunc = sender.length > 25 ? sender.substring(0, 22) + '...' : sender;
                doc.text(senderTrunc, bubbleX + textPadding, textY);
                textY += 3.5;
            }
            
            // Media handling
            if (hasMedia) {
                if (embedImage) {
                    try {
                        const imgWidth = bubbleWidth - (textPadding * 2);
                        doc.addImage(msg.media.data, 'JPEG', bubbleX + textPadding, textY, imgWidth, thumbnailHeight, undefined, 'MEDIUM');
                        textY += thumbnailHeight + 2;
                    } catch (e) {
                        doc.setFontSize(SMALL_FONT);
                        doc.setTextColor(...COLORS.textGray);
                        doc.setFont('helvetica', 'italic');
                        doc.text('[Image]', bubbleX + textPadding, textY + 3);
                        textY += 7;
                    }
                } else {
                    doc.setFontSize(SMALL_FONT);
                    doc.setTextColor(...COLORS.textGray);
                    doc.setFont('helvetica', 'italic');
                    
                    let mediaLabel = '[Attachment]';
                    if (msg.media.type === 'omitted') {
                        mediaLabel = '[Media omitted]';
                    } else if (msg.media.type === 'image') {
                        mediaLabel = '[Image]';
                    } else if (msg.media.type === 'video') {
                        mediaLabel = '[Video]';
                    } else if (msg.media.type === 'audio') {
                        mediaLabel = '[Audio]';
                    } else if (msg.media.type === 'document') {
                        mediaLabel = '[Document]';
                    }
                    
                    drawRect(bubbleX + textPadding - 1, textY - 1, bubbleWidth - textPadding * 2 + 2, 7, 1.5, [245, 245, 245]);
                    doc.text(mediaLabel, bubbleX + textPadding + 1, textY + 3.5);
                    textY += 8;
                }
            }
            
            // Message text
            if (wrappedText.length > 0) {
                doc.setFontSize(FONT_SIZE);
                doc.setTextColor(...COLORS.textDark);
                doc.setFont('helvetica', 'normal');
                
                wrappedText.forEach(line => {
                    doc.text(line, bubbleX + textPadding, textY);
                    textY += LINE_HEIGHT;
                });
            }
            
            // Track where content actually ends
            const contentEndY = textY;
            
            // Time (bottom right)
            doc.setFontSize(SMALL_FONT);
            doc.setTextColor(...COLORS.textGray);
            doc.setFont('helvetica', 'normal');
            
            const timeWidth = getTextWidth(time, SMALL_FONT);
            const timeX = bubbleX + bubbleWidth - textPadding - timeWidth - 1;
            // Position time so its baseline is at bubble bottom minus time text height minus small gap
            const timeTextHeightPos = SMALL_FONT * 0.35; // ~2.27mm
            const timeY = y + bubbleHeight - timeTextHeightPos - 0.5; // Time baseline position
            doc.text(time, timeX, timeY);
            
            // DIAGNOSTIC LOGGING - Track bottom padding
            if (i < 5 || (i % 50 === 0)) { // Log first 5 messages and every 50th
                const timeTextHeight = SMALL_FONT * 0.35; // Approximate text height (font size * 0.35 is typical)
                const actualBottomPadding = (y + bubbleHeight) - (timeY + timeTextHeight);
                const calculatedBottomSpace = heightBreakdown.timeFooter;
                const spaceFromContentToTime = timeY - contentEndY;
                
                const logData = {
                    bubbleBottom: (y + bubbleHeight).toFixed(2),
                    timeY: timeY.toFixed(2),
                    timeTextHeight: timeTextHeight.toFixed(2),
                    timeBottom: (timeY + timeTextHeight).toFixed(2),
                    contentEndY: contentEndY.toFixed(2),
                    spaceFromContentToTime: spaceFromContentToTime.toFixed(2),
                    actualBottomPadding: actualBottomPadding.toFixed(2),
                    calculatedBottomSpace: calculatedBottomSpace.toFixed(2),
                    bottomPaddingDiff: (actualBottomPadding - calculatedBottomSpace).toFixed(2),
                    ISSUE: actualBottomPadding > 1.5 ? 'TOO MUCH BOTTOM PADDING' : 'OK'
                };
                console.log(`[MSG ${i}] BOTTOM PADDING:`, JSON.stringify(logData, null, 2));
            }
            
            y += bubbleHeight + 1.5; // Reduced gap between messages
        }
        
        // ========== PDF ATTACHMENTS SECTION ==========
        if (this.exportOptions.includeAttachments) {
            const pdfAttachments = [];
            const pdfFilesFound = new Set();
            
            chatData.messages.forEach(msg => {
                if (msg.media && msg.media.type === 'document' && msg.media.extension === 'pdf' && msg.media.filename) {
                    let pdfData = mediaFiles.get(msg.media.filename);
                    let actualFilename = msg.media.filename;
                    
                    if (!pdfData) {
                        for (const [key, value] of mediaFiles) {
                            if (key.toLowerCase() === msg.media.filename.toLowerCase() && key.toLowerCase().endsWith('.pdf')) {
                                pdfData = value;
                                actualFilename = key;
                                break;
                            }
                        }
                    }
                    
                    if (!pdfData) {
                        const baseName = msg.media.filename.replace(/^.*?(\d{5,}[-_].*)$/, '$1');
                        for (const [key, value] of mediaFiles) {
                            if (key.includes(baseName) && key.toLowerCase().endsWith('.pdf')) {
                                pdfData = value;
                                actualFilename = key;
                                break;
                            }
                        }
                    }
                    
                    if (!pdfData) {
                        for (const [key, value] of mediaFiles) {
                            if (key.toLowerCase().endsWith('.pdf')) {
                                const msgNumeric = msg.media.filename.match(/(\d{5,})/);
                                const keyNumeric = key.match(/(\d{5,})/);
                                if (msgNumeric && keyNumeric && msgNumeric[1] === keyNumeric[1]) {
                                    pdfData = value;
                                    actualFilename = key;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!pdfFilesFound.has(actualFilename)) {
                        pdfAttachments.push({
                            filename: actualFilename,
                            displayName: msg.media.displayName || msg.media.filename,
                            pages: msg.media.pages || null,
                            data: pdfData || null,
                            hasData: !!pdfData,
                            timestamp: msg.timestamp,
                            sender: msg.sender,
                            formattedTime: msg.formattedTime || ''
                        });
                        pdfFilesFound.add(actualFilename);
                    }
                }
            });
            
            for (const [filename, data] of mediaFiles) {
                if (filename.toLowerCase().endsWith('.pdf') && !pdfFilesFound.has(filename)) {
                    pdfAttachments.push({
                        filename: filename,
                        displayName: filename,
                        pages: null,
                        data: data,
                        hasData: true,
                        timestamp: null,
                        sender: 'Unknown',
                        formattedTime: ''
                    });
                }
            }
            
            if (pdfAttachments.length > 0) {
                onProgress(`Rendering ${pdfAttachments.length} PDF attachment(s)...`);
                
                doc.addPage();
                y = MARGIN;
                
                drawRect(0, 0, PAGE_WIDTH, 35, 0, COLORS.headerBg);
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('PDF Document Attachments', PAGE_WIDTH / 2, 16, { align: 'center' });
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`${pdfAttachments.length} PDF file(s) shared in this conversation`, PAGE_WIDTH / 2, 26, { align: 'center' });
                y = 42;
                
                doc.setFontSize(7);
                doc.setTextColor(...COLORS.textGray);
                doc.text('PDF documents are rendered as images. For editable versions, refer to the original export.', MARGIN, y);
                y += 6;
                
                for (let i = 0; i < pdfAttachments.length; i++) {
                    const attachment = pdfAttachments[i];
                    onProgress(`Processing PDF ${i + 1} of ${pdfAttachments.length}: ${attachment.displayName}`);
                    
                    ensureSpace(20);
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...COLORS.accent);
                    doc.text(`Attachment ${i + 1} of ${pdfAttachments.length}`, MARGIN, y);
                    y += 5;
                    
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...COLORS.textDark);
                    const filenameText = `File: ${this.cleanTextForPDF(attachment.displayName)}`;
                    const filenameLines = wrapText(filenameText, CONTENT_WIDTH, 9);
                    doc.text(filenameLines, MARGIN, y);
                    y += filenameLines.length * 4 + 2;
                    
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...COLORS.textGray);
                    const metadata = [];
                    if (attachment.pages) metadata.push(`${attachment.pages} pages`);
                    metadata.push(`From: ${this.cleanTextForPDF(attachment.sender)}`);
                    if (attachment.formattedTime) metadata.push(`Time: ${attachment.formattedTime}`);
                    doc.text(metadata.join(' | '), MARGIN, y);
                    y += 6;
                    
                    if (attachment.hasData && window.pdfjsLib) {
                        try {
                            const base64Data = attachment.data.split(',')[1];
                            const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                            const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
                            const numPages = pdfDoc.numPages;
                            
                            onProgress(`Rendering ${numPages} page(s) from ${attachment.displayName}...`);
                            
                            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                                const page = await pdfDoc.getPage(pageNum);
                                const viewport = page.getViewport({ scale: 1 });
                                const scale = (CONTENT_WIDTH * 2.83) / viewport.width;
                                const scaledViewport = page.getViewport({ scale: scale });
                                
                                const canvas = document.createElement('canvas');
                                const context = canvas.getContext('2d');
                                canvas.width = scaledViewport.width;
                                canvas.height = scaledViewport.height;
                                
                                await page.render({
                                    canvasContext: context,
                                    viewport: scaledViewport
                                }).promise;
                                
                                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                                const imgWidth = CONTENT_WIDTH;
                                const imgHeight = (scaledViewport.height / scaledViewport.width) * imgWidth;
                                
                                if (y + imgHeight + 12 > PAGE_HEIGHT - MARGIN) {
                                    doc.addPage();
                                    y = MARGIN;
                                }
                                
                                doc.setFontSize(7);
                                doc.setTextColor(...COLORS.textGray);
                                doc.text(`Page ${pageNum} of ${numPages}`, MARGIN, y);
                                y += 3;
                                
                                doc.setDrawColor(...COLORS.border);
                                doc.setLineWidth(0.3);
                                doc.rect(MARGIN, y, imgWidth, imgHeight, 'S');
                                doc.addImage(imgData, 'JPEG', MARGIN, y, imgWidth, imgHeight);
                                
                                y += imgHeight + 6;
                            }
                            
                            pdfDoc.destroy();
                            
                        } catch (pdfError) {
                            console.error('Error rendering PDF:', pdfError);
                            doc.setFontSize(8);
                            doc.setFont('helvetica', 'italic');
                            doc.setTextColor(...COLORS.textGray);
                            doc.text('Note: Could not render PDF preview.', MARGIN, y);
                            y += 6;
                        }
                    } else if (!attachment.hasData) {
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'italic');
                        doc.setTextColor(...COLORS.textGray);
                        doc.text('Note: This PDF was not included in the export.', MARGIN, y);
                        y += 6;
                    }
                    
                    if (i < pdfAttachments.length - 1) {
                        ensureSpace(12);
                        doc.setDrawColor(...COLORS.border);
                        doc.setLineWidth(0.5);
                        doc.line(MARGIN + 20, y, PAGE_WIDTH - MARGIN - 20, y);
                        y += 8;
                    }
                }
            }
        }
        
        // ========== IMAGE GALLERY SECTION ==========
        if (this.exportOptions.includeImageGallery) {
            const imageAttachments = [];
            
            chatData.messages.forEach(msg => {
                if (msg.media && msg.media.hasData && msg.media.type === 'image' && msg.media.data) {
                    imageAttachments.push({
                        filename: msg.media.filename || 'image',
                        data: msg.media.data,
                        sender: msg.sender,
                        formattedDate: msg.formattedDate || '',
                        formattedTime: msg.formattedTime || ''
                    });
                }
            });
            
            if (imageAttachments.length > 0) {
                onProgress(`Adding ${imageAttachments.length} image(s) to gallery...`);
                
                doc.addPage();
                y = MARGIN;
                
                drawRect(0, 0, PAGE_WIDTH, 32, 0, COLORS.headerBg);
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('Image Gallery', PAGE_WIDTH / 2, 15, { align: 'center' });
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`${imageAttachments.length} image(s) from this conversation`, PAGE_WIDTH / 2, 25, { align: 'center' });
                y = 38;
                
                doc.setFontSize(8);
                doc.setTextColor(...COLORS.textGray);
                doc.text('Images displayed at full width for print visibility.', MARGIN, y);
                y += 8;
                
                for (let i = 0; i < imageAttachments.length; i++) {
                    const img = imageAttachments[i];
                    onProgress(`Rendering image ${i + 1} of ${imageAttachments.length}...`);
                    
                    try {
                        const imgElement = new Image();
                        const imgLoaded = new Promise((resolve) => {
                            imgElement.onload = () => resolve(true);
                            imgElement.onerror = () => resolve(false);
                            imgElement.src = img.data;
                        });
                        
                        await imgLoaded;
                        
                        const aspectRatio = imgElement.naturalHeight / imgElement.naturalWidth;
                        const imgWidth = CONTENT_WIDTH;
                        let imgHeight = imgWidth * aspectRatio;
                        
                        const maxImgHeight = PAGE_HEIGHT - MARGIN * 2 - 20;
                        if (imgHeight > maxImgHeight) {
                            imgHeight = maxImgHeight;
                        }
                        
                        if (y + imgHeight + 16 > PAGE_HEIGHT - MARGIN) {
                            doc.addPage();
                            y = MARGIN;
                        }
                        
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(...COLORS.accent);
                        doc.text(`Image ${i + 1} of ${imageAttachments.length}`, MARGIN, y);
                        
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(...COLORS.textGray);
                        const metaText = `From: ${this.cleanTextForPDF(img.sender)} | ${img.formattedDate} ${img.formattedTime}`;
                        doc.text(metaText, MARGIN, y + 4);
                        y += 8;
                        
                        doc.setDrawColor(...COLORS.border);
                        doc.setLineWidth(0.3);
                        doc.rect(MARGIN, y, imgWidth, imgHeight, 'S');
                        doc.addImage(img.data, 'JPEG', MARGIN, y, imgWidth, imgHeight, undefined, 'MEDIUM');
                        
                        y += imgHeight + 4;
                        
                        doc.setFontSize(6);
                        doc.setTextColor(...COLORS.textGray);
                        const cleanFilename = this.cleanTextForPDF(img.filename);
                        doc.text(cleanFilename.length > 60 ? cleanFilename.substring(0, 57) + '...' : cleanFilename, MARGIN, y);
                        
                        y += 8;
                        
                    } catch (imgError) {
                        console.error('Error rendering gallery image:', imgError);
                        ensureSpace(12);
                        doc.setFontSize(8);
                        doc.setTextColor(...COLORS.textGray);
                        doc.text(`[Image ${i + 1}: Could not render - ${this.cleanTextForPDF(img.filename)}]`, MARGIN, y);
                        y += 8;
                    }
                }
            }
        }
        
        // ========== SAVE ==========
        onProgress('Generating PDF file...');
        
        const filename = `${chatName.replace(/[^a-z0-9]/gi, '_')}_whatsapp2pdf.pdf`;
        doc.save(filename);
        
        onProgress('Complete!');
        return filename;
    },

    /**
     * Export chat to standalone HTML file
     */
    async exportToHTML(chatData, chatName, mediaFiles = new Map()) {
        const html = this.generateHTMLExport(chatData, chatName, mediaFiles);
        
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chatName.replace(/[^a-z0-9]/gi, '_')}_whatsapp2pdf.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        return a.download;
    },

    /**
     * Generate standalone HTML export with embedded media
     */
    generateHTMLExport(chatData, chatName, mediaFiles) {
        const currentUser = ChatRenderer?.currentUser || chatData.participants[0]?.name;
        
        let messagesHtml = '';
        let lastDate = null;
        
        chatData.messages.forEach(message => {
            if (message.formattedDate !== lastDate) {
                messagesHtml += `<div class="date-sep"><span>${this.escapeHtml(message.formattedDate)}</span></div>`;
                lastDate = message.formattedDate;
            }
            
            const msgClass = message.isSystem ? 'system' : 
                (message.sender === currentUser ? 'outgoing' : 'incoming');
            
            let mediaHtml = '';
            if (message.media) {
                if (message.media.type === 'image' && message.media.hasData) {
                    mediaHtml = `<div class="media"><img src="${message.media.data}" alt="Image" loading="lazy"></div>`;
                } else if (message.media.type === 'video' && message.media.hasData) {
                    mediaHtml = `<div class="media"><video src="${message.media.data}" controls preload="metadata"></video></div>`;
                } else if (message.media.type === 'audio' && message.media.hasData) {
                    mediaHtml = `<div class="media"><audio src="${message.media.data}" controls></audio></div>`;
                } else if (message.media.type === 'omitted') {
                    mediaHtml = `<div class="media-placeholder">📷 Media not included in export</div>`;
                } else if (message.media.hasData) {
                    mediaHtml = `<div class="media-placeholder">📎 ${this.escapeHtml(message.media.filename || 'File')}</div>`;
                } else {
                    mediaHtml = `<div class="media-placeholder">📎 ${this.escapeHtml(message.media.filename || 'Media')} (not loaded)</div>`;
                }
            }
            
            const senderHtml = msgClass === 'incoming' && !message.isSystem 
                ? `<div class="sender">${this.escapeHtml(message.sender)}</div>` 
                : '';
            
            const textHtml = message.text 
                ? `<div class="text">${this.formatTextForExport(message.text)}</div>` 
                : '';
            
            const timeHtml = !message.isSystem 
                ? `<div class="time">${this.escapeHtml(message.formattedTime)}</div>` 
                : '';
            
            messagesHtml += `
                <div class="msg ${msgClass}">
                    <div class="bubble">
                        ${senderHtml}
                        ${mediaHtml}
                        ${textHtml}
                        ${timeHtml}
                    </div>
                </div>
            `;
        });
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(chatName)} - WhatsApp2PDF Export</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: #efeae2;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d7db' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            min-height: 100vh;
            line-height: 1.4;
        }
        .header {
            background: linear-gradient(135deg, #008069 0%, #00a884 100%);
            color: white;
            padding: 16px 20px;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .header h1 { font-size: 18px; font-weight: 600; }
        .header p { font-size: 13px; opacity: 0.9; margin-top: 4px; }
        .container {
            max-width: 850px;
            margin: 0 auto;
            padding: 16px;
        }
        .msg {
            display: flex;
            margin-bottom: 2px;
            animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .msg.outgoing { justify-content: flex-end; }
        .msg.incoming { justify-content: flex-start; }
        .msg.system { justify-content: center; }
        .bubble {
            max-width: 65%;
            padding: 4px 8px 6px;
            border-radius: 7.5px;
            box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
            position: relative;
        }
        .msg.outgoing .bubble {
            background: #d9fdd3;
            border-top-right-radius: 0;
        }
        .msg.incoming .bubble {
            background: white;
            border-top-left-radius: 0;
        }
        .msg.system .bubble {
            background: rgba(255,255,255,0.95);
            font-size: 12.5px;
            color: #54656f;
            padding: 4px 12px;
            border-radius: 7.5px;
            max-width: 85%;
            box-shadow: 0 1px 0.5px rgba(0,0,0,0.1);
        }
        .sender {
            font-size: 12px;
            font-weight: 500;
            color: #00a884;
            margin-bottom: 1px;
        }
        .text {
            font-size: 14px;
            line-height: 1.3;
            word-wrap: break-word;
            color: #111b21;
            white-space: pre-wrap;
        }
        .text a { color: #039be5; text-decoration: none; }
        .text a:hover { text-decoration: underline; }
        .time {
            font-size: 11px;
            color: #667781;
            text-align: right;
            margin-top: 1px;
            float: right;
            margin-left: 8px;
        }
        .media {
            margin: 3px 0;
            border-radius: 6px;
            overflow: hidden;
        }
        .media img, .media video {
            max-width: 100%;
            max-height: 300px;
            display: block;
            border-radius: 6px;
            cursor: pointer;
        }
        .media audio {
            width: 100%;
            max-width: 280px;
        }
        .media-placeholder {
            background: #f0f2f5;
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 13px;
            color: #667781;
            margin: 3px 0;
        }
        .date-sep {
            display: flex;
            justify-content: center;
            margin: 10px 0;
        }
        .date-sep span {
            background: rgba(255,255,255,0.95);
            padding: 4px 12px;
            border-radius: 7.5px;
            font-size: 12px;
            color: #54656f;
            box-shadow: 0 1px 0.5px rgba(0,0,0,0.1);
        }
        .footer {
            text-align: center;
            padding: 20px 16px;
            font-size: 12px;
            color: #667781;
        }
        .lightbox {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            cursor: pointer;
        }
        .lightbox img {
            max-width: 95%;
            max-height: 95%;
            object-fit: contain;
        }
        @media (max-width: 600px) {
            .bubble { max-width: 85%; }
            .container { padding: 8px; }
        }
        @media print {
            .header { position: static; }
            body { background: white; background-image: none; }
            .msg { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${this.escapeHtml(chatName)}</h1>
        <p>${chatData.stats.totalMessages.toLocaleString()} messages • ${chatData.stats.dateRange}</p>
    </div>
    <div class="container">
        ${messagesHtml}
    </div>
    <div class="footer">
        <p>Generated by WhatsApp2PDF</p>
        <p>${new Date().toLocaleString()}</p>
    </div>
    <script>
        document.querySelectorAll('.media img').forEach(img => {
            img.addEventListener('click', function() {
                const lb = document.createElement('div');
                lb.className = 'lightbox';
                lb.innerHTML = '<img src="' + this.src + '" alt="Full size">';
                lb.onclick = () => lb.remove();
                document.body.appendChild(lb);
            });
        });
    </script>
</body>
</html>`;
    },

    /**
     * Format text for HTML export
     */
    formatTextForExport(text) {
        text = this.escapeHtml(text);
        text = text.replace(
            /(https?:\/\/[^\s<]+)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
        text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
        text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
        text = text.replace(/```([^`]+)```/g, '<code>$1</code>');
        text = text.replace(/\n/g, '<br>');
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
     * Clean text for PDF output
     */
    cleanTextForPDF(text) {
        if (!text) return '';
        
        text = text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u200b-\u200d\ufeff]/g, '');
        
        const emojiMap = {
            '📷': '[Photo]',
            '🖼️': '[Image]',
            '🎥': '[Video]',
            '🎵': '[Audio]',
            '📄': '[Doc]',
            '📎': '[File]',
            '📞': '[Call]',
            '📵': '[Missed Call]',
            '🚫': '[Deleted]',
            '✓': '[check]',
            '✔': '[check]',
            '❌': '[x]',
            '👍': '[thumbs up]',
            '👎': '[thumbs down]',
            '❤️': '[heart]',
            '😀': ':)',
            '😂': ':D',
            '😊': ':)',
            '😢': ':(',
            '😡': '>:(',
            '🙏': '[thanks]'
        };
        
        for (const [emoji, replacement] of Object.entries(emojiMap)) {
            text = text.split(emoji).join(replacement);
        }
        
        text = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '');
        
        text = text.replace(/[^\x00-\x7F\u00A0-\u00FF\u0100-\u017F]/g, function(char) {
            return '';
        });
        
        text = text.replace(/\s+/g, ' ').trim();
        
        return text;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatExporter;
}
