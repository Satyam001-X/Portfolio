/**
 * STUD-X Pilot Authentication & Multi-User Data Engine
 * Manages Pilot accounts, security hashing, session state, user-scoped storage,
 * dynamic profile switching, gamified XP matrix, and .studx archive backups.
 */
class AuthManager {
    constructor() {
        this.storagePrefix = 'studx_';
        this.accountsKey = 'studx_registered_pilots';
        this.currentUserIdKey = 'studx_active_pilot_id';
        this.accounts = [];
        this.currentUser = null;
        this.userChangeListeners = [];

        // Predefined Pilot Avatars with cybernetic icons and styles
        this.avatarPresets = [
            { id: 'arc-reactor', name: 'Arc Core', icon: 'zap', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' },
            { id: 'iron-helm', name: 'Mark Helm', icon: 'shield', color: '#ffd700', bg: 'rgba(255, 215, 0, 0.15)' },
            { id: 'crimson-pulse', name: 'Cyber Pulse', icon: 'flame', color: '#ff3366', bg: 'rgba(255, 51, 102, 0.15)' },
            { id: 'emerald-matrix', name: 'Matrix Node', icon: 'cpu', color: '#00ff88', bg: 'rgba(0, 255, 136, 0.15)' },
            { id: 'violet-nova', name: 'Quantum Ring', icon: 'radio', color: '#b800ff', bg: 'rgba(184, 0, 255, 0.15)' },
            { id: 'phoenix-eye', name: 'Apex Pilot', icon: 'crosshair', color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.15)' },
            { id: 'sentinel', name: 'Sentinel AI', icon: 'eye', color: '#00d2ff', bg: 'rgba(0, 210, 255, 0.15)' },
            { id: 'stealth-recon', name: 'Stealth Recon', icon: 'radar', color: '#a0aec0', bg: 'rgba(160, 174, 192, 0.15)' }
        ];

        this.init();
    }

    init() {
        this.loadAccounts();
        this.restoreSession();
    }

    loadAccounts() {
        try {
            const raw = localStorage.getItem(this.accountsKey);
            this.accounts = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Error loading accounts:', e);
            this.accounts = [];
        }

        // If no accounts exist yet, seed a default Pilot profile for instant out-of-the-box readiness
        if (this.accounts.length === 0) {
            const defaultPilot = {
                id: 'pilot_stark_prime',
                username: 'tony_stark',
                displayName: 'Tony Stark',
                callsign: 'IRON-01',
                email: 'stark@avengers.hud',
                passwordHash: this.hashSync('arc123'), // Default PIN: arc123
                avatar: 'arc-reactor',
                role: 'Chief Engineer / Pilot',
                department: 'Arc Technologies & Quantum Computing',
                bio: 'Genius, billionaire, scholar. Building next-generation cognitive matrices.',
                theme: 'arc-cyan',
                soundEnabled: true,
                xp: 450,
                level: 3,
                createdAt: Date.now() - 86400000 * 14,
                lastLoginAt: Date.now(),
                isGuest: false
            };
            this.accounts.push(defaultPilot);
            this.saveAccounts();
        }
    }

    saveAccounts() {
        try {
            localStorage.setItem(this.accountsKey, JSON.stringify(this.accounts));
        } catch (e) {
            console.error('Error saving accounts:', e);
        }
    }

    restoreSession() {
        const savedId = localStorage.getItem(this.currentUserIdKey);
        if (savedId) {
            this.currentUser = this.accounts.find(a => a.id === savedId) || null;
        }

        if (!this.currentUser) {
            // Default to first registered pilot or create a guest session
            if (this.accounts.length > 0) {
                this.currentUser = this.accounts[0];
                localStorage.setItem(this.currentUserIdKey, this.currentUser.id);
            } else {
                this.currentUser = this.createGuestSession();
            }
        }
    }

    createGuestSession() {
        return {
            id: 'pilot_guest_' + Date.now(),
            username: 'guest_pilot',
            displayName: 'Guest Pilot',
            callsign: 'CADET-00',
            email: '',
            passwordHash: '',
            avatar: 'sentinel',
            role: 'Cadet Trainee',
            department: 'Academic Simulations',
            bio: 'Temporary simulation profile. Create an account to permanently sync telemetry.',
            theme: 'arc-cyan',
            soundEnabled: true,
            xp: 0,
            level: 1,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
            isGuest: true
        };
    }

    getCurrentUser() {
        if (!this.currentUser) {
            this.restoreSession();
        }
        return this.currentUser;
    }

    getCurrentUserId() {
        return this.currentUser ? this.currentUser.id : 'guest';
    }

    /**
     * Generates a storage key scoped to the active pilot
     * e.g. studx_pilot_stark_prime_cyberhud_tasks
     */
    getScopedKey(baseKey) {
        const userId = this.getCurrentUserId();
        return `studx_${userId}_${baseKey}`;
    }

    /**
     * Subscribe to user switch/login/logout events
     */
    onUserChange(callback) {
        if (typeof callback === 'function') {
            this.userChangeListeners.push(callback);
        }
    }

    notifyUserChange() {
        this.userChangeListeners.forEach(cb => {
            try {
                cb(this.currentUser);
            } catch (e) {
                console.error('Error in user change listener:', e);
            }
        });
    }

    /**
     * Synchronous lightweight SHA-256 fallback + Web Crypto async
     */
    hashSync(str) {
        let hash = 0;
        if (!str || str.length === 0) return '0';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return 'hash_' + Math.abs(hash).toString(16) + '_' + str.length;
    }

    async hashPassword(password) {
        if (!password) return '';
        try {
            if (window.crypto && crypto.subtle) {
                const encoder = new TextEncoder();
                const data = encoder.encode(password + '_studx_salt_arc_2026');
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {}
        return this.hashSync(password);
    }

    /**
     * Register a brand new Pilot account
     */
    async register({ username, displayName, callsign, email, password, avatar, role, department, bio, migrateCurrentData = true }) {
        const cleanUsername = (username || '').trim().toLowerCase();
        if (!cleanUsername || cleanUsername.length < 3) {
            throw new Error('Username must be at least 3 characters long.');
        }

        // Check if username already taken
        const existing = this.accounts.find(a => a.username.toLowerCase() === cleanUsername);
        if (existing) {
            throw new Error(`Username "${cleanUsername}" is already registered. Please choose another or sign in.`);
        }

        if (!password || password.length < 3) {
            throw new Error('Password / Security PIN must be at least 3 characters.');
        }

        const passwordHash = await this.hashPassword(password);
        const newId = 'pilot_' + cleanUsername.replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);

        const newPilot = {
            id: newId,
            username: cleanUsername,
            displayName: (displayName || cleanUsername).trim(),
            callsign: (callsign || cleanUsername.toUpperCase().slice(0, 8)).trim().toUpperCase(),
            email: (email || '').trim().toLowerCase(),
            passwordHash: passwordHash,
            avatar: avatar || 'arc-reactor',
            role: (role || 'Cadet Pilot').trim(),
            department: (department || 'Academic Fleet').trim(),
            bio: (bio || 'STUD-X Active Operative').trim(),
            theme: (window.app && window.app.currentTheme) || 'arc-cyan',
            soundEnabled: true,
            xp: 100,
            level: 1,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
            isGuest: false
        };

        this.accounts.push(newPilot);
        this.saveAccounts();

        // Migrate current guest/legacy data if requested
        if (migrateCurrentData) {
            this.migrateLegacyDataToUser(newPilot.id);
        }

        // Switch to newly created user
        await this.setCurrentUser(newPilot);
        return newPilot;
    }

    /**
     * Authenticate and sign into an existing Pilot account
     */
    async login(usernameOrEmail, password) {
        const identifier = (usernameOrEmail || '').trim().toLowerCase();
        if (!identifier) {
            throw new Error('Please enter your Pilot Username or Email.');
        }

        const account = this.accounts.find(a => 
            a.username.toLowerCase() === identifier || 
            (a.email && a.email.toLowerCase() === identifier)
        );

        if (!account) {
            throw new Error('Pilot not found with that username or email.');
        }

        const inputHash = await this.hashPassword(password);
        const legacyHash = this.hashSync(password);

        if (account.passwordHash && account.passwordHash !== inputHash && account.passwordHash !== legacyHash) {
            throw new Error('Incorrect Security PIN / Password. Authentication rejected.');
        }

        account.lastLoginAt = Date.now();
        this.saveAccounts();

        await this.setCurrentUser(account);
        return account;
    }

    /**
     * Fast 1-click switch between local accounts on the system
     */
    async switchAccount(userId, pin = null) {
        const target = this.accounts.find(a => a.id === userId);
        if (!target) {
            throw new Error('Target account not found.');
        }

        if (pin !== null && pin !== '') {
            const inputHash = await this.hashPassword(pin);
            const legacyHash = this.hashSync(pin);
            if (target.passwordHash && target.passwordHash !== inputHash && target.passwordHash !== legacyHash) {
                throw new Error('Invalid Security PIN.');
            }
        }

        target.lastLoginAt = Date.now();
        this.saveAccounts();

        await this.setCurrentUser(target);
        return target;
    }

    async logout() {
        // Switch to guest session or first account
        const guest = this.createGuestSession();
        this.currentUser = guest;
        localStorage.removeItem(this.currentUserIdKey);
        this.notifyUserChange();
        if (window.soundFX) window.soundFX.playClick();
        return guest;
    }

    async setCurrentUser(user) {
        this.currentUser = user;
        if (!user.isGuest) {
            localStorage.setItem(this.currentUserIdKey, user.id);
        } else {
            localStorage.removeItem(this.currentUserIdKey);
        }

        // Apply user's saved theme preference
        if (user.theme && window.app && typeof window.app.setTheme === 'function') {
            window.app.setTheme(user.theme, false);
        }

        // Apply sound preference
        if (user.soundEnabled !== undefined && window.soundFX) {
            window.soundFX.toggleSound(user.soundEnabled);
        }

        this.notifyUserChange();
        if (window.soundFX) window.soundFX.playSuccess();
    }

    /**
     * Updates profile info of the currently logged in pilot
     */
    async updateProfile({ displayName, callsign, avatar, role, department, bio, newPassword, theme }) {
        if (!this.currentUser || this.currentUser.isGuest) {
            throw new Error('Cannot edit guest profile. Please create an account first.');
        }

        const account = this.accounts.find(a => a.id === this.currentUser.id);
        if (!account) throw new Error('Account record not found.');

        if (displayName) account.displayName = displayName.trim();
        if (callsign) account.callsign = callsign.trim().toUpperCase();
        if (avatar) account.avatar = avatar;
        if (role) account.role = role.trim();
        if (department) account.department = department.trim();
        if (bio !== undefined) account.bio = bio.trim();
        if (theme) account.theme = theme;

        if (newPassword && newPassword.trim().length >= 3) {
            account.passwordHash = await this.hashPassword(newPassword.trim());
        }

        this.currentUser = account;
        this.saveAccounts();
        this.notifyUserChange();
        return account;
    }

    /**
     * Delete an account and wipe its user-scoped data
     */
    deleteAccount(userId) {
        const idx = this.accounts.findIndex(a => a.id === userId);
        if (idx === -1) return false;

        // Clean user scoped keys from localStorage
        const prefix = `studx_${userId}_`;
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        this.accounts.splice(idx, 1);
        this.saveAccounts();

        if (this.currentUser && this.currentUser.id === userId) {
            if (this.accounts.length > 0) {
                this.setCurrentUser(this.accounts[0]);
            } else {
                this.logout();
            }
        } else {
            this.notifyUserChange();
        }

        return true;
    }

    /**
     * Awards XP to the active pilot for completing directives, tests, or focus sessions
     */
    awardXP(amount, reason = '') {
        if (!this.currentUser) return;

        const currentXp = (this.currentUser.xp || 0) + amount;
        const oldLevel = this.currentUser.level || 1;
        const newLevel = Math.floor(currentXp / 250) + 1;

        this.currentUser.xp = currentXp;
        this.currentUser.level = newLevel;

        if (!this.currentUser.isGuest) {
            const acc = this.accounts.find(a => a.id === this.currentUser.id);
            if (acc) {
                acc.xp = currentXp;
                acc.level = newLevel;
                this.saveAccounts();
            }
        }

        // Trigger level up animation if leveled up
        if (newLevel > oldLevel) {
            if (window.taskManager && typeof window.taskManager.triggerConfetti === 'function') {
                window.taskManager.triggerConfetti();
            }
            if (window.soundFX) window.soundFX.playSuccess();
        }

        this.updateHeaderBadge();
    }

    /**
     * Migrates legacy or guest data from standard keys into the user's isolated storage
     */
    migrateLegacyDataToUser(userId) {
        const legacyTaskKey = 'cyberhud_tasks';
        const legacyStreakKey = 'cyberhud_streak';
        const legacyExamKey = 'studx_exam_history';
        const legacyVaultKey = 'studx_vault_items';

        const userTaskKey = `studx_${userId}_cyberhud_tasks`;
        const userStreakKey = `studx_${userId}_cyberhud_streak`;
        const userExamKey = `studx_${userId}_studx_exam_history`;
        const userVaultKey = `studx_${userId}_studx_vault_items`;

        if (localStorage.getItem(legacyTaskKey) && !localStorage.getItem(userTaskKey)) {
            localStorage.setItem(userTaskKey, localStorage.getItem(legacyTaskKey));
        }
        if (localStorage.getItem(legacyStreakKey) && !localStorage.getItem(userStreakKey)) {
            localStorage.setItem(userStreakKey, localStorage.getItem(legacyStreakKey));
        }
        if (localStorage.getItem(legacyExamKey) && !localStorage.getItem(userExamKey)) {
            localStorage.setItem(userExamKey, localStorage.getItem(legacyExamKey));
        }
        if (localStorage.getItem(legacyVaultKey) && !localStorage.getItem(userVaultKey)) {
            localStorage.setItem(userVaultKey, localStorage.getItem(legacyVaultKey));
        }
    }

    /**
     * Export all data for the active user as a .studx JSON file archive
     */
    exportPilotData() {
        const user = this.getCurrentUser();
        const userId = user.id;

        const tasksRaw = localStorage.getItem(`studx_${userId}_cyberhud_tasks`) || localStorage.getItem('cyberhud_tasks') || '[]';
        const streakRaw = localStorage.getItem(`studx_${userId}_cyberhud_streak`) || localStorage.getItem('cyberhud_streak') || '{}';
        const examRaw = localStorage.getItem(`studx_${userId}_studx_exam_history`) || localStorage.getItem('studx_exam_history') || '[]';
        const vaultRaw = localStorage.getItem(`studx_${userId}_studx_vault_items`) || localStorage.getItem('studx_vault_items') || '[]';

        const exportData = {
            format: 'STUD-X-PILOT-ARCHIVE',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            pilot: {
                username: user.username,
                displayName: user.displayName,
                callsign: user.callsign,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                department: user.department,
                bio: user.bio,
                xp: user.xp,
                level: user.level,
                theme: user.theme
            },
            data: {
                tasks: JSON.parse(tasksRaw),
                streak: JSON.parse(streakRaw),
                examHistory: JSON.parse(examRaw),
                vaultMetadata: JSON.parse(vaultRaw)
            }
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `STUD-X_${user.callsign || user.username}_Archive_${new Date().toISOString().split('T')[0]}.studx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        if (window.soundFX) window.soundFX.playSuccess();
    }

    /**
     * Import a .studx pilot archive file and restore data
     */
    async importPilotData(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.format || !parsed.pilot || !parsed.data) {
                throw new Error('Invalid STUD-X pilot archive format.');
            }

            const pilotData = parsed.pilot;
            const cleanUsername = (pilotData.username || 'imported_pilot').toLowerCase().replace(/[^a-z0-9_]/g, '');

            let account = this.accounts.find(a => a.username.toLowerCase() === cleanUsername);
            let userId = account ? account.id : ('pilot_' + cleanUsername + '_' + Date.now().toString(36));

            if (!account) {
                account = {
                    id: userId,
                    username: cleanUsername,
                    displayName: pilotData.displayName || cleanUsername,
                    callsign: pilotData.callsign || 'PILOT',
                    email: pilotData.email || '',
                    passwordHash: this.hashSync('studx123'),
                    avatar: pilotData.avatar || 'arc-reactor',
                    role: pilotData.role || 'Restored Pilot',
                    department: pilotData.department || 'Imported Archive',
                    bio: pilotData.bio || 'Restored from STUD-X archive.',
                    theme: pilotData.theme || 'arc-cyan',
                    soundEnabled: true,
                    xp: pilotData.xp || 150,
                    level: pilotData.level || 1,
                    createdAt: Date.now(),
                    lastLoginAt: Date.now(),
                    isGuest: false
                };
                this.accounts.push(account);
            } else {
                account.displayName = pilotData.displayName || account.displayName;
                account.callsign = pilotData.callsign || account.callsign;
                account.xp = Math.max(account.xp || 0, pilotData.xp || 0);
                account.level = Math.max(account.level || 1, pilotData.level || 1);
            }

            // Restore scoped data
            if (parsed.data.tasks) {
                localStorage.setItem(`studx_${userId}_cyberhud_tasks`, JSON.stringify(parsed.data.tasks));
            }
            if (parsed.data.streak) {
                localStorage.setItem(`studx_${userId}_cyberhud_streak`, JSON.stringify(parsed.data.streak));
            }
            if (parsed.data.examHistory) {
                localStorage.setItem(`studx_${userId}_studx_exam_history`, JSON.stringify(parsed.data.examHistory));
            }
            if (parsed.data.vaultMetadata) {
                localStorage.setItem(`studx_${userId}_studx_vault_items`, JSON.stringify(parsed.data.vaultMetadata));
            }

            this.saveAccounts();
            await this.setCurrentUser(account);
            return account;
        } catch (e) {
            throw new Error('Failed to import archive: ' + e.message);
        }
    }

    /**
     * Get avatar preset object by ID
     */
    getAvatarPreset(avatarId) {
        return this.avatarPresets.find(a => a.id === avatarId) || this.avatarPresets[0];
    }

    /**
     * Update the Pilot HUD element in the header
     */
    updateHeaderBadge() {
        const badgeBtn = document.getElementById('pilotHudBtn');
        if (!badgeBtn) return;

        const user = this.getCurrentUser();
        const avatarInfo = this.getAvatarPreset(user.avatar);
        const xpProgress = (user.xp % 250) / 2.5; // percent to next level

        badgeBtn.innerHTML = `
            <div class="pilot-badge-avatar" style="border-color: ${avatarInfo.color}; box-shadow: 0 0 10px ${avatarInfo.color}40;">
                <i data-lucide="${avatarInfo.icon}" style="color: ${avatarInfo.color};"></i>
            </div>
            <div class="pilot-badge-info">
                <div class="pilot-badge-top">
                    <span class="pilot-callsign">${this.escapeHtml(user.callsign || user.username)}</span>
                    <span class="pilot-level-tag">LVL ${user.level || 1}</span>
                </div>
                <div class="pilot-xp-bar-bg">
                    <div class="pilot-xp-bar-fill" style="width: ${xpProgress}%; background: ${avatarInfo.color};"></div>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.AuthManager = AuthManager;
window.authManager = new AuthManager();
