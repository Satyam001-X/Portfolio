/**
 * STUD-X Vault & Class Repository Engine
 * Powered by IndexedDB for storing Class PPTs, Assignments, Notes, and PDFs offline
 */
class StudxVault {
    constructor() {
        this.dbName = 'StudxVaultDB';
        this.dbVersion = 1;
        this.db = null;
        this.items = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('vault_items')) {
                    const store = db.createObjectStore('vault_items', { keyPath: 'id' });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('subject', 'subject', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = async (e) => {
                this.db = e.target.result;
                await this.loadItems();
                resolve(this.db);
            };

            request.onerror = (e) => {
                console.error('IndexedDB init error:', e);
                // Fallback to local storage
                this.loadFromLocalStorage();
                resolve(null);
            };
        });
    }

    async loadItems() {
        const currentUserId = window.authManager ? window.authManager.getCurrentUserId() : 'default';

        if (!this.db) {
            this.loadFromLocalStorage();
            return;
        }

        return new Promise((resolve) => {
            const tx = this.db.transaction('vault_items', 'readonly');
            const store = tx.objectStore('vault_items');
            const req = store.getAll();

            req.onsuccess = () => {
                const allItems = req.result || [];
                // Filter items for current active user (or items created before user accounts)
                this.items = allItems.filter(item => !item.userId || item.userId === currentUserId);
                if (this.items.length === 0) {
                    this.seedSampleVaultData();
                } else {
                    this.render();
                }
                resolve(this.items);
            };

            req.onerror = () => {
                this.loadFromLocalStorage();
                resolve([]);
            };
        });
    }

    loadFromLocalStorage() {
        const key = window.authManager ? window.authManager.getScopedKey('studx_vault_items') : 'studx_vault_items';
        let saved = localStorage.getItem(key);
        if (!saved && localStorage.getItem('studx_vault_items')) {
            saved = localStorage.getItem('studx_vault_items');
        }

        if (saved) {
            try {
                this.items = JSON.parse(saved);
            } catch (e) {
                this.items = [];
            }
        }
        if (this.items.length === 0) {
            this.seedSampleVaultData();
        } else {
            this.render();
        }
    }

    saveToLocalStorage() {
        try {
            const key = window.authManager ? window.authManager.getScopedKey('studx_vault_items') : 'studx_vault_items';
            const currentUserId = window.authManager ? window.authManager.getCurrentUserId() : 'default';
            // Save lightweight metadata to localStorage
            const meta = this.items.map(item => ({
                id: item.id,
                userId: item.userId || currentUserId,
                title: item.title,
                subject: item.subject,
                category: item.category,
                dueDate: item.dueDate,
                isCompleted: item.isCompleted,
                fileName: item.fileName,
                fileSize: item.fileSize,
                fileType: item.fileType,
                notesText: item.notesText,
                createdAt: item.createdAt
            }));
            localStorage.setItem(key, JSON.stringify(meta));
        } catch (e) {}
    }

    async reloadForUser() {
        await this.loadItems();
    }

    async seedSampleVaultData() {
        const samples = [
            {
                id: 'vault_' + Date.now() + '_1',
                title: 'Quantum Mechanics & Wave Equations Lecture 04',
                subject: 'Physics',
                category: 'Class PPTs',
                dueDate: '',
                isCompleted: false,
                fileName: 'Lecture04_Schrodinger_Wave.pptx',
                fileSize: '4.8 MB',
                fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                fileData: null,
                notesText: 'Covers 1D Infinite Potential Well, boundary conditions, and eigenenergies.',
                createdAt: Date.now() - 86400000
            },
            {
                id: 'vault_' + Date.now() + '_2',
                title: 'Assignment 3: Electromagnetic Induction & Eddy Currents',
                subject: 'Electrodynamics',
                category: 'Assignments',
                dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                isCompleted: false,
                fileName: 'Assignment_03_EM_Induction.pdf',
                fileSize: '1.2 MB',
                fileType: 'application/pdf',
                fileData: null,
                notesText: 'Solve questions 1 through 15. Submit step derivations on graph paper.',
                createdAt: Date.now() - 172800000
            },
            {
                id: 'vault_' + Date.now() + '_3',
                title: 'Calculus & Multivariable Vectors Cheat Sheet',
                subject: 'Mathematics',
                category: 'Notes / Formulas',
                dueDate: '',
                isCompleted: true,
                fileName: 'Vector_Calculus_CheatSheet.pdf',
                fileSize: '850 KB',
                fileType: 'application/pdf',
                fileData: null,
                notesText: 'Stokes Theorem, Divergence Theorem, Green Theorem with standard coordinate transformations.',
                createdAt: Date.now() - 259200000
            }
        ];

        for (const item of samples) {
            await this.addItemDirect(item);
        }
        this.render();
    }

    async addItem(title, subject, category, dueDate, notesText, file) {
        if (!title.trim()) return;

        const currentUserId = window.authManager ? window.authManager.getCurrentUserId() : 'default';
        let fileData = null;
        let fileName = file ? file.name : '';
        let fileSize = file ? this.formatFileSize(file.size) : '';
        let fileType = file ? file.type : '';

        if (file) {
            fileData = await this.readFileAsDataUrl(file);
        }

        const newItem = {
            id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            userId: currentUserId,
            title: title.trim(),
            subject: subject.trim() || 'General',
            category: category || 'Notes / Formulas',
            dueDate: dueDate || '',
            isCompleted: false,
            fileName: fileName,
            fileSize: fileSize,
            fileType: fileType,
            fileData: fileData,
            notesText: notesText || '',
            createdAt: Date.now()
        };

        await this.addItemDirect(newItem);
        if (window.authManager) window.authManager.awardXP(15, 'Document Archived to Vault');
        if (window.soundFX) window.soundFX.playSuccess();
        this.render();
        return newItem;
    }

    async addItemDirect(item) {
        if (!item.userId && window.authManager) {
            item.userId = window.authManager.getCurrentUserId();
        }
        this.items.unshift(item);

        if (this.db) {
            try {
                const tx = this.db.transaction('vault_items', 'readwrite');
                const store = tx.objectStore('vault_items');
                store.put(item);
            } catch (e) {
                console.error('IndexedDB put error:', e);
            }
        }
        this.saveToLocalStorage();
    }

    async toggleAssignment(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        item.isCompleted = !item.isCompleted;

        if (this.db) {
            try {
                const tx = this.db.transaction('vault_items', 'readwrite');
                const store = tx.objectStore('vault_items');
                store.put(item);
            } catch (e) {}
        }
        this.saveToLocalStorage();
        if (window.soundFX) {
            if (item.isCompleted) {
                window.soundFX.playSuccess();
                if (window.authManager) window.authManager.awardXP(20, 'Assignment Completed');
            } else {
                window.soundFX.playClick();
            }
        }
        this.render();
    }

    async deleteItem(id) {
        this.items = this.items.filter(i => i.id !== id);

        if (this.db) {
            try {
                const tx = this.db.transaction('vault_items', 'readwrite');
                const store = tx.objectStore('vault_items');
                store.delete(id);
            } catch (e) {}
        }
        this.saveToLocalStorage();
        if (window.soundFX) window.soundFX.playClick();
        this.render();
    }

    downloadFile(id) {
        const item = this.items.find(i => i.id === id);
        if (!item || !item.fileData) {
            alert('This item contains notes and metadata without an attached binary file.');
            return;
        }

        const a = document.createElement('a');
        a.href = item.fileData;
        a.download = item.fileName || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (window.soundFX) window.soundFX.playSuccess();
    }

    previewItem(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        const modal = document.getElementById('vaultPreviewModal');
        const modalTitle = document.getElementById('vaultModalTitle');
        const modalContent = document.getElementById('vaultModalContent');

        if (!modal || !modalTitle || !modalContent) return;

        modalTitle.textContent = item.title;

        let previewHtml = `
            <div class="vault-modal-meta">
                <span class="meta-tag"><i data-lucide="tag"></i> ${item.category}</span>
                <span class="meta-tag"><i data-lucide="book-open"></i> ${item.subject}</span>
                ${item.fileName ? `<span class="meta-tag"><i data-lucide="file"></i> ${item.fileName} (${item.fileSize})</span>` : ''}
                ${item.dueDate ? `<span class="meta-tag"><i data-lucide="calendar"></i> Due: ${item.dueDate}</span>` : ''}
            </div>
            ${item.notesText ? `<div class="vault-modal-notes"><strong>Notes & Summary:</strong><p>${this.escapeHtml(item.notesText)}</p></div>` : ''}
        `;

        if (item.fileData) {
            if (item.fileType && item.fileType.startsWith('image/')) {
                previewHtml += `
                    <div class="vault-modal-img-wrap">
                        <img src="${item.fileData}" alt="${this.escapeHtml(item.title)}">
                    </div>
                `;
            } else if (item.fileType === 'application/pdf') {
                previewHtml += `
                    <div class="vault-modal-embed-wrap">
                        <iframe src="${item.fileData}" width="100%" height="450px" style="border: 1px solid var(--border-hud); border-radius: 8px;"></iframe>
                    </div>
                `;
            } else {
                previewHtml += `
                    <div style="text-align: center; padding: 24px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-top: 14px;">
                        <i data-lucide="file-text" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 8px;"></i>
                        <p style="color: var(--text-main); font-size: 0.95rem;">${item.fileName} (${item.fileSize})</p>
                        <button class="btn-hud-primary" style="margin-top: 12px; display: inline-flex;" onclick="studxVault.downloadFile('${item.id}')">
                            <i data-lucide="download"></i> Download / Open File
                        </button>
                    </div>
                `;
            }
        }

        modalContent.innerHTML = previewHtml;
        modal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons();
        if (window.soundFX) window.soundFX.playBoot();
    }

    closeModal() {
        const modal = document.getElementById('vaultPreviewModal');
        if (modal) modal.style.display = 'none';
        if (window.soundFX) window.soundFX.playClick();
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
        if (window.soundFX) window.soundFX.playClick();
    }

    setSearchQuery(q) {
        this.searchQuery = (q || '').toLowerCase().trim();
        this.render();
    }

    getFilteredItems() {
        return this.items.filter(item => {
            if (this.currentFilter !== 'all' && item.category !== this.currentFilter) {
                return false;
            }
            if (this.searchQuery) {
                const titleMatch = item.title.toLowerCase().includes(this.searchQuery);
                const subMatch = item.subject.toLowerCase().includes(this.searchQuery);
                const noteMatch = (item.notesText || '').toLowerCase().includes(this.searchQuery);
                const fileMatch = (item.fileName || '').toLowerCase().includes(this.searchQuery);
                return titleMatch || subMatch || noteMatch || fileMatch;
            }
            return true;
        });
    }

    render() {
        const container = document.getElementById('vaultItemsGrid');
        if (!container) return;

        const filtered = this.getFilteredItems();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon"><i data-lucide="folder-open"></i></div>
                    <h3>STUD-X VAULT ARCHIVE EMPTY</h3>
                    <p>No documents, PPTs, or assignments found in this view. Upload class files using the directive panel.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = filtered.map(item => {
            const isAssignment = item.category === 'Assignments';
            let iconName = 'file-text';
            let catClass = 'cat-note';

            if (item.category === 'Class PPTs') {
                iconName = 'presentation';
                catClass = 'cat-ppt';
            } else if (item.category === 'Assignments') {
                iconName = 'clipboard-check';
                catClass = 'cat-assignment';
            } else if (item.category === 'Question Banks') {
                iconName = 'help-circle';
                catClass = 'cat-qbank';
            }

            return `
                <div class="vault-card ${catClass} ${item.isCompleted ? 'assignment-done' : ''}">
                    <div class="vault-card-header">
                        <div class="vault-icon-badge"><i data-lucide="${iconName}"></i></div>
                        <span class="vault-cat-badge">${item.category.toUpperCase()}</span>
                    </div>

                    <h4 class="vault-title" onclick="studxVault.previewItem('${item.id}')">${this.escapeHtml(item.title)}</h4>
                    
                    <div class="vault-subject-tag">
                        <i data-lucide="book"></i> ${this.escapeHtml(item.subject)}
                    </div>

                    ${item.notesText ? `
                        <p class="vault-notes-snippet">${this.escapeHtml(item.notesText)}</p>
                    ` : ''}

                    ${item.fileName ? `
                        <div class="vault-file-pill" onclick="studxVault.downloadFile('${item.id}')" title="Click to Download">
                            <i data-lucide="paperclip"></i>
                            <span class="file-name-text">${this.escapeHtml(item.fileName)}</span>
                            <span class="file-size-text">${item.fileSize}</span>
                        </div>
                    ` : ''}

                    ${isAssignment ? `
                        <div class="vault-assignment-row">
                            <span class="due-badge ${item.dueDate ? '' : 'no-due'}">
                                <i data-lucide="calendar"></i> Due: ${item.dueDate || 'No Date'}
                            </span>
                            <button class="btn-check-assignment ${item.isCompleted ? 'checked' : ''}" 
                                    onclick="studxVault.toggleAssignment('${item.id}')">
                                <i data-lucide="${item.isCompleted ? 'check-circle' : 'circle'}"></i> 
                                ${item.isCompleted ? 'Submitted' : 'Pending'}
                            </button>
                        </div>
                    ` : ''}

                    <div class="vault-card-footer">
                        <button class="btn-icon-hud" title="View / Read" onclick="studxVault.previewItem('${item.id}')">
                            <i data-lucide="eye"></i>
                        </button>
                        ${item.fileData ? `
                            <button class="btn-icon-hud" title="Download File" onclick="studxVault.downloadFile('${item.id}')">
                                <i data-lucide="download"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon-hud btn-delete" title="Delete from Vault" onclick="studxVault.deleteItem('${item.id}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.StudxVault = StudxVault;
