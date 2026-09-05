/**
 * CyberHUD PDF Question Paper Parser Engine
 * Powered by PDF.js with custom Page-Range extraction & smart question tokenization
 */
class PdfQuestionParser {
    constructor() {
        this.pdfDoc = null;
        this.rawText = '';
        this.totalPages = 0;
        this.selectedPageNumbers = [];
        this.extractedQuestions = [];
        this.renderedCanvases = [];
    }

    /**
     * Parse page range string into an array of 1-based page numbers
     * Supports: "1-4", "3-9", "1, 3, 5-8", "all", "2"
     */
    parsePageRange(rangeStr, totalPages) {
        if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages = new Set();
        const parts = rangeStr.split(/[,;\s]+/);

        for (const part of parts) {
            const clean = part.trim();
            if (!clean) continue;

            if (clean.includes('-')) {
                const [startStr, endStr] = clean.split('-');
                let start = parseInt(startStr, 10);
                let end = parseInt(endStr, 10);

                if (!isNaN(start) && !isNaN(end)) {
                    start = Math.max(1, Math.min(start, totalPages));
                    end = Math.max(1, Math.min(end, totalPages));
                    for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
                        pages.add(p);
                    }
                }
            } else {
                const p = parseInt(clean, 10);
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                    pages.add(p);
                }
            }
        }

        const result = Array.from(pages).sort((a, b) => a - b);
        return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    /**
     * Load PDF from File object or ArrayBuffer/URL
     */
    async loadPdf(source) {
        if (!window.pdfjsLib) {
            throw new Error('PDF.js library is not loaded.');
        }

        // Set worker src
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        let loadingTask;
        if (source instanceof File) {
            const arrayBuffer = await source.arrayBuffer();
            loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        } else if (typeof source === 'string') {
            loadingTask = window.pdfjsLib.getDocument(source);
        } else {
            loadingTask = window.pdfjsLib.getDocument({ data: source });
        }

        this.pdfDoc = await loadingTask.promise;
        this.totalPages = this.pdfDoc.numPages;
        return this.totalPages;
    }

    /**
     * Extract text and render pages for given range
     */
    async processRange(rangeStr, progressCallback = null) {
        if (!this.pdfDoc) throw new Error('No PDF document loaded.');

        this.selectedPageNumbers = this.parsePageRange(rangeStr, this.totalPages);
        this.rawText = '';
        this.renderedCanvases = [];
        const pageTexts = [];

        for (let i = 0; i < this.selectedPageNumbers.length; i++) {
            const pageNum = this.selectedPageNumbers[i];
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: this.selectedPageNumbers.length,
                    page: pageNum
                });
            }

            const page = await this.pdfDoc.getPage(pageNum);
            
            // Extract text
            const textContent = await page.getTextContent();
            let lastY, text = '';
            for (let item of textContent.items) {
                if (lastY !== item.transform[5] && lastY !== undefined) {
                    text += '\n';
                }
                text += item.str + ' ';
                lastY = item.transform[5];
            }

            pageTexts.push({ pageNum, text });
            this.rawText += `\n--- PAGE ${pageNum} ---\n` + text;

            // Render high-res canvas for Split View mode
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            this.renderedCanvases.push({ pageNum, canvas });
        }

        // Smart parse questions from extracted text
        this.extractedQuestions = this.smartParseQuestions(pageTexts);

        return {
            totalPages: this.totalPages,
            selectedPages: this.selectedPageNumbers,
            questions: this.extractedQuestions,
            renderedCanvases: this.renderedCanvases,
            rawText: this.rawText
        };
    }

    /**
     * Smart question and MCQ parser from text stream
     */
    smartParseQuestions(pageTexts) {
        const fullText = pageTexts.map(p => p.text).join('\n\n');
        const questions = [];

        // Question header regex matches: "1.", "Q1.", "Question 1:", "1)", "Prob 1:", "[1]"
        const qRegex = /(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*(\d+)|(\d+)[\.\)]|Problem\s*(\d+)|\[(\d+)\])\s*[:\.\-]?\s*/gim;
        
        const matches = [];
        let match;
        while ((match = qRegex.exec(fullText)) !== null) {
            const qNum = parseInt(match[1] || match[2] || match[3] || match[4], 10);
            matches.push({
                qNum: isNaN(qNum) ? matches.length + 1 : qNum,
                index: match.index,
                headerLength: match[0].length
            });
        }

        if (matches.length === 0) {
            // Fallback: split by double newlines or create structured questions
            const paragraphs = fullText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);
            paragraphs.forEach((p, idx) => {
                questions.push(this.parseSingleQuestionBlock(p, idx + 1));
            });
        } else {
            for (let i = 0; i < matches.length; i++) {
                const current = matches[i];
                const next = matches[i + 1];
                const blockStart = current.index + current.headerLength;
                const blockEnd = next ? next.index : fullText.length;
                const blockText = fullText.substring(blockStart, blockEnd).trim();

                questions.push(this.parseSingleQuestionBlock(blockText, current.qNum || (i + 1)));
            }
        }

        // If no questions found or very short, generate at least default template
        if (questions.length === 0) {
            for (let i = 1; i <= Math.max(5, this.selectedPageNumbers.length * 5); i++) {
                questions.push({
                    id: i,
                    number: i,
                    text: `Question ${i} (Refer to PDF Page viewer for visual diagrams/text)`,
                    options: [
                        { key: 'A', text: 'Option A' },
                        { key: 'B', text: 'Option B' },
                        { key: 'C', text: 'Option C' },
                        { key: 'D', text: 'Option D' }
                    ],
                    correctAnswer: null
                });
            }
        }

        return questions;
    }

    /**
     * Parse single question text into Question Prompt + MCQ Options (A, B, C, D)
     */
    parseSingleQuestionBlock(rawBlock, qNumber) {
        // Look for options like (A), (B), (C), (D) or A), B), C), D) or A., B., C., D.
        const optRegex = /(?:^|\n|\s+)(?:\(([A-Da-d1-4])\)|([A-Da-d1-4])[\.\)])\s+/g;
        const optMatches = [];
        let optMatch;

        while ((optMatch = optRegex.exec(rawBlock)) !== null) {
            let key = (optMatch[1] || optMatch[2]).toUpperCase();
            // Map 1, 2, 3, 4 to A, B, C, D
            if (key === '1') key = 'A';
            if (key === '2') key = 'B';
            if (key === '3') key = 'C';
            if (key === '4') key = 'D';

            optMatches.push({
                key,
                index: optMatch.index,
                length: optMatch[0].length
            });
        }

        let questionText = rawBlock;
        let options = [];

        if (optMatches.length >= 2) {
            // First option marks the end of question prompt
            questionText = rawBlock.substring(0, optMatches[0].index).trim();
            for (let i = 0; i < optMatches.length; i++) {
                const currentOpt = optMatches[i];
                const nextOpt = optMatches[i + 1];
                const optTextStart = currentOpt.index + currentOpt.length;
                const optTextEnd = nextOpt ? nextOpt.index : rawBlock.length;
                const optText = rawBlock.substring(optTextStart, optTextEnd).trim();

                options.push({
                    key: currentOpt.key,
                    text: optText || `Option ${currentOpt.key}`
                });
            }
        } else {
            // Default 4 choices if not clearly parsed
            options = [
                { key: 'A', text: 'Option A' },
                { key: 'B', text: 'Option B' },
                { key: 'C', text: 'Option C' },
                { key: 'D', text: 'Option D' }
            ];
        }

        return {
            id: qNumber,
            number: qNumber,
            text: questionText || `Question ${qNumber}`,
            options: options,
            correctAnswer: null,
            userAnswer: null,
            status: 'not_visited', // 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'marked_answered'
            timeSpent: 0
        };
    }
}

window.PdfQuestionParser = PdfQuestionParser;
