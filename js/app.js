/**
 * STUD-X Main Application Controller
 * Handles Navigation, 12-Hour Clock Telemetry, Theme Management, Vault Events,
 * Pilot Authentication & Profile Management, and Keyboard Shortcuts
 */
class App {
    constructor() {
        this.currentTab = 'tasks'; // 'tasks' | 'timer' | 'exam' | 'vault' | 'history'
        this.currentAuthTab = 'dossier'; // 'dossier' | 'accounts' | 'register' | 'login' | 'backup'
        this.currentTheme = localStorage.getItem('studx_theme') || 'arc-cyan';
    }

    init() {
        // Initialize Core Engines
        window.hudBg = new window.HudBackground('bgCanvas');
        window.taskManager = new window.TaskManager();
        window.focusTimer = new window.FocusTimer();
        window.examEngine = new window.ExamEngine();
        window.studxVault = new window.StudxVault();

        // Apply saved theme
        this.setTheme(this.currentTheme, false);

        // Setup DOM Listeners & 12-Hour Real-Time Clock
        this.setupNavigation();
        this.setupEventListeners();
        this.setupVaultEventListeners();
        this.setupAuthEventListeners();
        this.setupKeyboardShortcuts();
        this.startTelemetryClock();

        // Listen for Pilot changes
        if (window.authManager) {
            window.authManager.onUserChange((user) => {
                if (window.taskManager) window.taskManager.reloadForUser();
                if (window.studxVault) window.studxVault.reloadForUser();
                if (window.examEngine) window.examEngine.reloadForUser();
                if (this.currentTab === 'history') this.renderHistoryView();
                window.authManager.updateHeaderBadge();
                this.renderAuthModal();
            });

            window.authManager.updateHeaderBadge();
        }

        // Initial renders
        window.taskManager.render();
        window.taskManager.updateTelemetry();
        window.focusTimer.updateDisplay();
        window.focusTimer.updateUiMode();

        // Auto load default sample exam in test engine
        window.examEngine.loadSampleExam('physics');

        // Check if lucide icons ready
        if (window.lucide) window.lucide.createIcons();

        // Sound state indicator
        const soundBtn = document.getElementById('toggleSoundBtn');
        if (soundBtn) {
            soundBtn.classList.toggle('sound-off', !window.soundFX.soundEnabled);
        }
    }

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const targetTab = link.dataset.tab;
                if (targetTab) {
                    this.switchTab(targetTab);
                }
            });
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        if (window.soundFX) window.soundFX.playClick();

        // Update active nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.tab === tabName);
        });

        // Hide all views, show active
        document.querySelectorAll('.app-view').forEach(view => {
            view.style.display = 'none';
        });

        const activeView = document.getElementById(`view-${tabName}`);
        if (activeView) {
            activeView.style.display = 'block';
        }

        // Special triggers per tab
        if (tabName === 'history') {
            this.renderHistoryView();
        } else if (tabName === 'tasks') {
            window.taskManager.render();
            window.taskManager.updateTelemetry();
        } else if (tabName === 'vault') {
            window.studxVault.render();
        }

        if (window.lucide) window.lucide.createIcons();
    }

    setupEventListeners() {
        // Task Form submit
        const taskForm = document.getElementById('addTaskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = document.getElementById('taskTitleInput').value;
                const category = document.getElementById('taskCategoryInput').value;
                const priority = document.getElementById('taskPriorityInput').value;
                const dueDate = document.getElementById('taskDueDateInput').value;
                const dueTime = document.getElementById('taskDueTimeInput').value;

                window.taskManager.addTask(title, category, priority, dueDate, dueTime);
                taskForm.reset();

                const dateInput = document.getElementById('taskDueDateInput');
                if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            });
        }

        // Task Filter Buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.taskManager.setFilter(btn.dataset.filter);
                if (window.soundFX) window.soundFX.playClick();
            });
        });

        // Category Filter
        const catSelect = document.getElementById('categoryFilterSelect');
        if (catSelect) {
            catSelect.addEventListener('change', (e) => {
                window.taskManager.setCategory(e.target.value);
            });
        }

        // Sound Toggle Button in Header
        const soundBtn = document.getElementById('toggleSoundBtn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const isEnabled = window.soundFX.toggleSound();
                soundBtn.classList.toggle('sound-off', !isEnabled);
                soundBtn.innerHTML = isEnabled ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-x"></i>';
                if (window.lucide) window.lucide.createIcons();
                if (isEnabled) window.soundFX.playClick();
            });
        }

        // Theme Switcher select
        const themeSelect = document.getElementById('themeSelector');
        if (themeSelect) {
            themeSelect.value = this.currentTheme;
            themeSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }

        // PDF Upload change listener
        const pdfInput = document.getElementById('examPdfFileInput');
        if (pdfInput) {
            pdfInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const previewEl = document.getElementById('pdfStatusPreview');
                    if (previewEl) {
                        previewEl.innerHTML = `
                            <div class="alert-box alert-info">
                                <i data-lucide="file-text"></i>
                                <div>
                                    <strong>Document Loaded:</strong> ${file.name} (${Math.round(file.size / 1024)} KB).<br>
                                    <small>Select target Page Range (e.g. 1-4, 3-9) or leave as 'all' and launch test.</small>
                                </div>
                            </div>
                        `;
                        if (window.lucide) window.lucide.createIcons();
                    }
                    if (window.soundFX) window.soundFX.playSuccess();
                }
            });
        }
    }

    setupVaultEventListeners() {
        // Vault Upload form
        const vaultForm = document.getElementById('addVaultItemForm');
        if (vaultForm) {
            vaultForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('vaultTitleInput').value;
                const subject = document.getElementById('vaultSubjectInput').value;
                const category = document.getElementById('vaultCategoryInput').value;
                const dueDate = document.getElementById('vaultDueDateInput').value;
                const notes = document.getElementById('vaultNotesInput').value;
                const fileInput = document.getElementById('vaultFileInput');
                const file = fileInput && fileInput.files && fileInput.files[0];

                await window.studxVault.addItem(title, subject, category, dueDate, notes, file);
                vaultForm.reset();
                const fileLabel = document.getElementById('vaultFileLabelText');
                if (fileLabel) fileLabel.textContent = 'Click to Select PPT / PDF / Notes File';
            });
        }

        // File label change display
        const vaultFileInput = document.getElementById('vaultFileInput');
        if (vaultFileInput) {
            vaultFileInput.addEventListener('change', (e) => {
                const label = document.getElementById('vaultFileLabelText');
                if (label && e.target.files && e.target.files.length > 0) {
                    label.textContent = `Attached: ${e.target.files[0].name}`;
                }
            });
        }

        // Vault Search Input
        const searchInput = document.getElementById('vaultSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                window.studxVault.setSearchQuery(e.target.value);
            });
        }

        // Vault Category Filter Buttons
        document.querySelectorAll('.vault-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.vault-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.studxVault.setFilter(btn.dataset.category);
            });
        });
    }

    setupAuthEventListeners() {
        // Pilot Badge in Header click opens Dossier Modal
        const pilotBadgeBtn = document.getElementById('pilotHudBtn');
        if (pilotBadgeBtn) {
            pilotBadgeBtn.addEventListener('click', () => {
                this.openAuthModal('dossier');
            });
        }

        // Modal Close Button
        const closeBtn = document.getElementById('closeAuthModalBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeAuthModal();
            });
        }

        // Close on backdrop click
        const modal = document.getElementById('pilotAuthModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAuthModal();
                }
            });
        }

        // Auth Subtab Navigation
        document.querySelectorAll('.auth-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.authTab;
                if (tab) this.switchAuthTab(tab);
            });
        });

        // Edit Profile Form Submit
        const editForm = document.getElementById('editProfileForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const callsign = document.getElementById('editCallsignInput').value;
                    const displayName = document.getElementById('editDisplayNameInput').value;
                    const role = document.getElementById('editRoleInput').value;
                    const department = document.getElementById('editDepartmentInput').value;
                    const newPassword = document.getElementById('editPasswordInput').value;

                    const selectedAvatarEl = document.querySelector('#editAvatarGrid .avatar-card.active');
                    const avatar = selectedAvatarEl ? selectedAvatarEl.dataset.avatarId : undefined;

                    await window.authManager.updateProfile({
                        callsign,
                        displayName,
                        role,
                        department,
                        newPassword,
                        avatar
                    });

                    alert('Pilot dossier updated successfully.');
                    this.renderAuthModal();
                } catch (err) {
                    alert(err.message || 'Failed to update profile.');
                }
            });
        }

        // Register Pilot Form Submit
        const regForm = document.getElementById('registerPilotForm');
        if (regForm) {
            regForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errBox = document.getElementById('regErrorAlert');
                if (errBox) errBox.style.display = 'none';

                try {
                    const username = document.getElementById('regUsernameInput').value;
                    const displayName = document.getElementById('regDisplayNameInput').value;
                    const callsign = document.getElementById('regCallsignInput').value;
                    const email = document.getElementById('regEmailInput').value;
                    const role = document.getElementById('regRoleInput').value;
                    const department = document.getElementById('regDepartmentInput').value;
                    const password = document.getElementById('regPasswordInput').value;
                    const confirmPass = document.getElementById('regPasswordConfirmInput').value;
                    const migrate = document.getElementById('regMigrateDataCheck')?.checked ?? true;

                    if (password !== confirmPass) {
                        throw new Error('Password / PIN and confirmation do not match.');
                    }

                    const selectedAvatarEl = document.querySelector('#regAvatarGrid .avatar-card.active');
                    const avatar = selectedAvatarEl ? selectedAvatarEl.dataset.avatarId : 'arc-reactor';

                    await window.authManager.register({
                        username,
                        displayName,
                        callsign,
                        email,
                        role,
                        department,
                        password,
                        avatar,
                        migrateCurrentData: migrate
                    });

                    regForm.reset();
                    this.switchAuthTab('dossier');
                    if (window.soundFX) window.soundFX.playSuccess();
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = err.message;
                        errBox.style.display = 'block';
                    } else {
                        alert(err.message);
                    }
                }
            });
        }

        // Login Pilot Form Submit
        const loginForm = document.getElementById('loginPilotForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errBox = document.getElementById('loginErrorAlert');
                if (errBox) errBox.style.display = 'none';

                try {
                    const identifier = document.getElementById('loginIdentifierInput').value;
                    const password = document.getElementById('loginPasswordInput').value;

                    await window.authManager.login(identifier, password);
                    loginForm.reset();
                    this.switchAuthTab('dossier');
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = err.message;
                        errBox.style.display = 'block';
                    } else {
                        alert(err.message);
                    }
                }
            });
        }

        // Quick register link in login view
        const goToRegBtn = document.getElementById('loginGoToRegisterBtn');
        if (goToRegBtn) {
            goToRegBtn.addEventListener('click', () => {
                this.switchAuthTab('register');
            });
        }

        // Logout button in Dossier
        const logoutBtn = document.getElementById('dossierLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('Log out active pilot session? Data will remain safely saved in local storage.')) {
                    await window.authManager.logout();
                    this.switchAuthTab('login');
                }
            });
        }

        // Export Pilot Archive
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                window.authManager.exportPilotData();
            });
        }

        // Import Pilot Archive
        const importTriggerBtn = document.getElementById('triggerImportBtn');
        const importInput = document.getElementById('importBackupFileInput');
        if (importTriggerBtn && importInput) {
            importTriggerBtn.addEventListener('click', () => {
                importInput.click();
            });

            importInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        try {
                            const contents = evt.target.result;
                            await window.authManager.importPilotData(contents);
                            alert(`Archive for "${file.name}" imported and restored successfully!`);
                            this.renderAuthModal();
                            this.switchAuthTab('dossier');
                        } catch (err) {
                            alert(err.message || 'Import failed. Corrupt archive file.');
                        }
                    };
                    reader.readAsText(file);
                }
            });
        }
    }

    openAuthModal(initialTab = 'dossier') {
        const modal = document.getElementById('pilotAuthModal');
        if (!modal) return;

        modal.style.display = 'flex';
        this.switchAuthTab(initialTab);
        this.renderAuthModal();
        if (window.soundFX) window.soundFX.playNav();
    }

    closeAuthModal() {
        const modal = document.getElementById('pilotAuthModal');
        if (modal) modal.style.display = 'none';
        if (window.soundFX) window.soundFX.playClick();
    }

    switchAuthTab(tabName) {
        this.currentAuthTab = tabName;
        if (window.soundFX) window.soundFX.playClick();

        document.querySelectorAll('.auth-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.authTab === tabName);
        });

        document.querySelectorAll('.auth-view-tab').forEach(v => {
            v.style.display = 'none';
        });

        const tabKey = tabName.charAt(0).toUpperCase() + tabName.slice(1);
        const targetView = document.getElementById(`authTab${tabKey}`);
        if (targetView) {
            targetView.style.display = 'block';
        }

        this.renderAuthModal();
        if (window.lucide) window.lucide.createIcons();
    }

    renderAuthModal() {
        const user = window.authManager.getCurrentUser();
        const avatarPresets = window.authManager.avatarPresets;

        // Render Active Dossier
        const heroContainer = document.getElementById('dossierHeroCard');
        if (heroContainer && user) {
            const avatarInfo = window.authManager.getAvatarPreset(user.avatar);
            const xpPercent = (user.xp % 250) / 2.5;

            heroContainer.innerHTML = `
                <div class="dossier-avatar-large" style="border-color: ${avatarInfo.color}; box-shadow: 0 0 25px ${avatarInfo.color}60;">
                    <i data-lucide="${avatarInfo.icon}" style="color: ${avatarInfo.color};"></i>
                </div>
                <div class="dossier-info">
                    <div class="dossier-top-line">
                        <h3>${this.escapeHtml(user.displayName)}</h3>
                        <span class="dossier-callsign-badge">${this.escapeHtml(user.callsign)}</span>
                        <span class="pilot-level-tag">LEVEL ${user.level || 1}</span>
                    </div>
                    <div class="dossier-meta">
                        <span><i data-lucide="shield"></i> ${this.escapeHtml(user.role)}</span>
                        <span><i data-lucide="map-pin"></i> ${this.escapeHtml(user.department)}</span>
                        <span><i data-lucide="mail"></i> ${user.email ? this.escapeHtml(user.email) : 'Telemetry Only'}</span>
                    </div>
                    <div class="dossier-xp-block">
                        <div class="dossier-xp-label">
                            <span>EXPERIENCE LEVEL PROTOCOL</span>
                            <span>${user.xp} XP (LVL ${user.level})</span>
                        </div>
                        <div class="pilot-xp-bar-bg" style="height: 10px;">
                            <div class="pilot-xp-bar-fill" style="width: ${xpPercent}%; background: ${avatarInfo.color};"></div>
                        </div>
                    </div>
                    ${user.isGuest ? `
                        <div class="alert-box alert-warning" style="margin-top: 12px; padding: 8px 12px;">
                            <i data-lucide="alert-circle"></i>
                            <div><strong>Simulation Guest Profile:</strong> Create or link a permanent pilot account to save your telemetry archives across devices.</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Render Telemetry Stats in Dossier
        const statsGrid = document.getElementById('dossierStatsGrid');
        if (statsGrid && user) {
            const tasks = window.taskManager ? window.taskManager.tasks : [];
            const doneTasks = tasks.filter(t => t.completed).length;
            const focusMins = tasks.reduce((sum, t) => sum + (t.timeSpentMinutes || 0), 0);
            const exams = window.examEngine ? window.examEngine.examHistory : [];
            const passedExams = exams.filter(e => e.isPassed).length;
            const vaultItems = window.studxVault ? window.studxVault.items : [];

            statsGrid.innerHTML = `
                <div class="dossier-stat-box">
                    <div class="stat-num">${doneTasks}/${tasks.length}</div>
                    <div class="stat-title">DIRECTIVES COMPLETED</div>
                </div>
                <div class="dossier-stat-box">
                    <div class="stat-num">${focusMins}m</div>
                    <div class="stat-title">FOCUS TIME LOGGED</div>
                </div>
                <div class="dossier-stat-box">
                    <div class="stat-num">${passedExams}/${exams.length}</div>
                    <div class="stat-title">EXAMS PASSED</div>
                </div>
                <div class="dossier-stat-box">
                    <div class="stat-num">${vaultItems.length}</div>
                    <div class="stat-title">VAULT REPOSITORY DOCS</div>
                </div>
            `;
        }

        // Fill Edit Profile form fields
        if (user) {
            const editCallsign = document.getElementById('editCallsignInput');
            const editDisplay = document.getElementById('editDisplayNameInput');
            const editRole = document.getElementById('editRoleInput');
            const editDept = document.getElementById('editDepartmentInput');
            if (editCallsign) editCallsign.value = user.callsign || '';
            if (editDisplay) editDisplay.value = user.displayName || '';
            if (editRole) editRole.value = user.role || '';
            if (editDept) editDept.value = user.department || '';

            this.renderAvatarGrid('editAvatarGrid', user.avatar);
        }

        // Render Register Avatar Selector
        this.renderAvatarGrid('regAvatarGrid', 'arc-reactor');

        // Render Accounts List
        const accountsContainer = document.getElementById('accountsListContainer');
        if (accountsContainer) {
            const accounts = window.authManager.accounts;
            if (accounts.length === 0) {
                accountsContainer.innerHTML = `
                    <div class="empty-state">
                        <p>No registered accounts found. Switch to New Pilot tab to enroll.</p>
                    </div>
                `;
            } else {
                accountsContainer.innerHTML = accounts.map(acc => {
                    const isCurrent = user && user.id === acc.id;
                    const avatarInfo = window.authManager.getAvatarPreset(acc.avatar);
                    const lastActive = acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleDateString() : 'Recent';

                    return `
                        <div class="account-card ${isCurrent ? 'active-account' : ''}">
                            <div class="account-avatar" style="border-color: ${avatarInfo.color};">
                                <i data-lucide="${avatarInfo.icon}" style="color: ${avatarInfo.color};"></i>
                            </div>
                            <div class="account-details">
                                <div class="account-title-row">
                                    <h4>${this.escapeHtml(acc.displayName)}</h4>
                                    <span class="account-callsign">${this.escapeHtml(acc.callsign || acc.username)}</span>
                                </div>
                                <div class="account-sub-info">
                                    <span>LVL ${acc.level || 1} • ${acc.role || 'Pilot'}</span>
                                    <span>Last Active: ${lastActive}</span>
                                </div>
                            </div>
                            <div class="account-actions">
                                ${isCurrent ? `
                                    <span class="current-badge"><i data-lucide="check"></i> ACTIVE</span>
                                ` : `
                                    <button class="btn-hud-primary btn-sm" onclick="app.handleSwitchAccount('${acc.id}')">
                                        <i data-lucide="log-in"></i> SWITCH
                                    </button>
                                `}
                                ${accounts.length > 1 ? `
                                    <button class="btn-icon-hud btn-delete" title="Delete Profile" onclick="app.handleDeleteAccount('${acc.id}')">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        if (window.lucide) window.lucide.createIcons();
    }

    renderAvatarGrid(containerId, activeAvatarId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const presets = window.authManager.avatarPresets;
        container.innerHTML = presets.map(p => {
            const isSelected = p.id === activeAvatarId;
            return `
                <div class="avatar-card ${isSelected ? 'active' : ''}" data-avatar-id="${p.id}" onclick="app.selectAvatar('${containerId}', '${p.id}')">
                    <div class="avatar-icon-wrap" style="color: ${p.color}; background: ${p.bg}; border-color: ${p.color};">
                        <i data-lucide="${p.icon}"></i>
                    </div>
                    <span class="avatar-name">${p.name}</span>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    selectAvatar(containerId, avatarId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.querySelectorAll('.avatar-card').forEach(c => {
            c.classList.toggle('active', c.dataset.avatarId === avatarId);
        });

        if (window.soundFX) window.soundFX.playClick();
    }

    async handleSwitchAccount(userId) {
        try {
            await window.authManager.switchAccount(userId);
            this.renderAuthModal();
            this.switchAuthTab('dossier');
        } catch (err) {
            alert(err.message);
        }
    }

    async handleDeleteAccount(userId) {
        if (confirm('Permanently remove this Pilot Profile and all associated directives & archives?')) {
            window.authManager.deleteAccount(userId);
            this.renderAuthModal();
        }
    }

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            // In Exam Runner
            if (window.examEngine && window.examEngine.examState === 'running') {
                if (e.key >= '1' && e.key <= '4') {
                    const keys = ['A', 'B', 'C', 'D'];
                    const chosen = keys[parseInt(e.key, 10) - 1];
                    window.examEngine.selectOption(chosen);
                } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
                    window.examEngine.selectOption(e.key.toUpperCase());
                } else if (e.key.toLowerCase() === 'n') {
                    window.examEngine.nextQuestion();
                } else if (e.key.toLowerCase() === 'p') {
                    window.examEngine.prevQuestion();
                } else if (e.key.toLowerCase() === 'm') {
                    window.examEngine.markForReview();
                } else if (e.key.toLowerCase() === 'c') {
                    window.examEngine.clearResponse();
                }
                return;
            }

            // Global timer shortcut
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.currentTab === 'timer') {
                    window.focusTimer.toggle();
                }
            } else if (e.key === '1') {
                this.switchTab('tasks');
            } else if (e.key === '2') {
                this.switchTab('timer');
            } else if (e.key === '3') {
                this.switchTab('exam');
            } else if (e.key === '4') {
                this.switchTab('vault');
            } else if (e.key === '5') {
                this.switchTab('history');
            }
        });
    }

    /**
     * Real-time 12-Hour Format Clock (hh:mm:ss AM/PM)
     */
    startTelemetryClock() {
        const timeEl = document.getElementById('hudTelemetryClock');
        const dateEl = document.getElementById('hudTelemetryDate');

        const update = () => {
            const now = new Date();
            if (timeEl) {
                timeEl.textContent = now.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
            }
            if (dateEl) {
                dateEl.textContent = now.toLocaleDateString([], {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric'
                }).toUpperCase();
            }
        };

        update();
        setInterval(update, 1000);
    }

    setTheme(themeName, playAudio = true) {
        this.currentTheme = themeName;
        localStorage.setItem('studx_theme', themeName);
        document.body.className = `theme-${themeName}`;

        const colors = {
            'arc-cyan': { primary: '#00f0ff', accent: '#ffd700' },
            'cyber-crimson': { primary: '#ff3366', accent: '#00f0ff' },
            'matrix-green': { primary: '#00ff88', accent: '#00f0ff' },
            'violet-pulse': { primary: '#b800ff', accent: '#00f0ff' }
        };

        const current = colors[themeName] || colors['arc-cyan'];
        if (window.hudBg) {
            window.hudBg.setTheme(current.primary, current.accent);
        }

        if (playAudio && window.soundFX) window.soundFX.playClick();
    }

    launchTaskTimer(taskId) {
        this.switchTab('timer');
        window.focusTimer.attachTask(taskId);
    }

    renderHistoryView() {
        const container = document.getElementById('historyListContainer');
        if (!container) return;

        const history = window.examEngine.examHistory || [];
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i data-lucide="bar-chart-3"></i></div>
                    <h3>NO TEST TELEMETRY RECORDED FOR CURRENT PILOT</h3>
                    <p>Complete a mock test or step-evaluated exam in the Exam Arena to log real-time performance analytics.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = history.map(h => {
            const mins = Math.floor(h.timeTakenSecs / 60);
            const secs = h.timeTakenSecs % 60;
            const isPass = h.percentage >= 40;

            return `
                <div class="history-card ${isPass ? 'pass-card' : 'fail-card'}">
                    <div class="history-header">
                        <div class="history-title-block">
                            <h4>${this.escapeHtml(h.title)}</h4>
                            <span class="history-date">${h.date} @ ${h.time}</span>
                        </div>
                        <div class="history-score-badge ${isPass ? 'badge-pass' : 'badge-fail'}">
                            ${h.score} / ${h.maxScore} (${h.percentage}%)
                        </div>
                    </div>
                    <div class="history-metrics">
                        <div class="h-metric"><i data-lucide="check"></i> Correct / Evaluated: <strong>${h.correctCount}</strong></div>
                        <div class="h-metric"><i data-lucide="x"></i> Deductions: <strong>${h.incorrectCount}</strong></div>
                        <div class="h-metric"><i data-lucide="help-circle"></i> Unattempted: <strong>${h.unattemptedCount}</strong></div>
                        <div class="h-metric"><i data-lucide="clock"></i> Duration: <strong>${mins}m ${secs}s</strong></div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.app = new App();
window.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
