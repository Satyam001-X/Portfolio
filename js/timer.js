/**
 * CyberHUD Focus Core Timer Engine
 * Supports Pomodoro (Work/Break), Custom Countdown, Stopwatch with Laps, and Web Audio Ambient Soundscapes
 */
class FocusTimer {
    constructor() {
        this.mode = 'pomodoro'; // 'pomodoro' | 'custom' | 'stopwatch'
        this.pomoState = 'work'; // 'work' | 'shortBreak' | 'longBreak'
        this.pomoDurations = {
            work: 25 * 60,
            shortBreak: 5 * 60,
            longBreak: 15 * 60
        };
        this.pomoCycles = 0;

        // Timer states
        this.totalSeconds = 25 * 60;
        this.remainingSeconds = 25 * 60;
        this.stopwatchSeconds = 0;
        this.stopwatchInterval = null;
        this.laps = [];

        this.isRunning = false;
        this.interval = null;
        this.attachedTaskId = null;

        this.ambientType = 'none';
    }

    setMode(mode) {
        if (this.isRunning) {
            this.pause();
        }
        this.mode = mode;
        if (window.soundFX) window.soundFX.playClick();

        if (mode === 'pomodoro') {
            this.setPomoState(this.pomoState || 'work');
        } else if (mode === 'custom') {
            this.updateCustomDurationFromInputs();
        } else if (mode === 'stopwatch') {
            this.updateDisplay();
        }

        this.updateUiMode();
    }

    setPomoState(state) {
        this.pomoState = state;
        this.totalSeconds = this.pomoDurations[state];
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
        this.updatePomoTabs();
    }

    setCustomPreset(minutes) {
        if (this.isRunning) this.pause();
        const minsInput = document.getElementById('customMinutesInput');
        const secsInput = document.getElementById('customSecondsInput');
        if (minsInput) minsInput.value = minutes;
        if (secsInput) secsInput.value = 0;

        this.totalSeconds = minutes * 60;
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
        if (window.soundFX) window.soundFX.playClick();
    }

    updateCustomDurationFromInputs() {
        const mins = parseInt(document.getElementById('customMinutesInput')?.value || '25', 10);
        const secs = parseInt(document.getElementById('customSecondsInput')?.value || '0', 10);
        const total = (isNaN(mins) ? 0 : mins * 60) + (isNaN(secs) ? 0 : secs);
        this.totalSeconds = Math.max(total, 1);
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        if (window.soundFX) {
            window.soundFX.playBoot();
            if (this.ambientType !== 'none') {
                window.soundFX.startAmbient(this.ambientType);
            }
        }

        if (this.mode === 'stopwatch') {
            this.startStopwatch();
        } else {
            this.startCountdown();
        }

        this.updatePlayButton();
    }

    startCountdown() {
        const startTs = Date.now();
        const initialRem = this.remainingSeconds;

        this.interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTs) / 1000);
            this.remainingSeconds = Math.max(0, initialRem - elapsed);

            this.updateDisplay();

            if (this.remainingSeconds <= 0) {
                this.onTimerComplete();
            }
        }, 250);
    }

    startStopwatch() {
        const startTs = Date.now() - (this.stopwatchSeconds * 1000);
        this.stopwatchInterval = setInterval(() => {
            this.stopwatchSeconds = (Date.now() - startTs) / 1000;
            this.updateDisplay();
        }, 50);
    }

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;
        clearInterval(this.interval);
        clearInterval(this.stopwatchInterval);
        this.interval = null;
        this.stopwatchInterval = null;

        if (window.soundFX) {
            window.soundFX.playClick();
            window.soundFX.stopAmbient();
        }

        this.updatePlayButton();
    }

    toggle() {
        if (this.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    }

    reset() {
        this.pause();
        if (this.mode === 'pomodoro') {
            this.remainingSeconds = this.pomoDurations[this.pomoState];
        } else if (this.mode === 'custom') {
            this.remainingSeconds = this.totalSeconds;
        } else if (this.mode === 'stopwatch') {
            this.stopwatchSeconds = 0;
            this.laps = [];
            this.renderLaps();
        }
        this.updateDisplay();
        if (window.soundFX) window.soundFX.playClick();
    }

    recordLap() {
        if (this.mode !== 'stopwatch' || !this.isRunning) return;
        const currentLapTime = this.stopwatchSeconds;
        this.laps.unshift({
            index: this.laps.length + 1,
            time: currentLapTime
        });
        if (window.soundFX) window.soundFX.playNav();
        this.renderLaps();
    }

    renderLaps() {
        const lapContainer = document.getElementById('stopwatchLapsList');
        if (!lapContainer) return;

        if (this.laps.length === 0) {
            lapContainer.innerHTML = `<div class="lap-item-empty">No telemetry splits recorded yet.</div>`;
            return;
        }

        lapContainer.innerHTML = this.laps.map(l => {
            return `
                <div class="lap-item">
                    <span class="lap-num">SPLIT #${String(l.index).padStart(2, '0')}</span>
                    <span class="lap-time">${this.formatStopwatch(l.time)}</span>
                </div>
            `;
        }).join('');
    }

    onTimerComplete() {
        this.pause();
        if (window.soundFX) {
            window.soundFX.playAlarm();
        }

        // Log focus time to attached task if any
        if (this.attachedTaskId && window.taskManager) {
            const minutes = Math.round(this.totalSeconds / 60);
            window.taskManager.addTimeToTask(this.attachedTaskId, minutes);
        }

        if (this.mode === 'pomodoro') {
            if (this.pomoState === 'work') {
                this.pomoCycles++;
                if (this.pomoCycles % 4 === 0) {
                    this.setPomoState('longBreak');
                    alert('🔥 Focus cycle complete! Take a rejuvenating 15-minute Long Break.');
                } else {
                    this.setPomoState('shortBreak');
                    alert('⚡ Focus session accomplished! Take a 5-minute breather.');
                }
            } else {
                this.setPomoState('work');
                alert('🎯 Break concluded. Initializing next focus cycle.');
            }
        } else {
            alert('⏱️ Focus duration complete! Excellent discipline.');
        }
    }

    setAmbient(type) {
        this.ambientType = type;
        if (window.soundFX) {
            if (this.isRunning && type !== 'none') {
                window.soundFX.startAmbient(type);
            } else {
                window.soundFX.stopAmbient();
            }
            window.soundFX.playClick();
        }
        this.updateAmbientButtons();
    }

    updateDisplay() {
        const timeDisplay = document.getElementById('timerDigits');
        const circle = document.getElementById('timerProgressRing');
        const modeLabel = document.getElementById('timerStatusLabel');

        if (this.mode === 'stopwatch') {
            if (timeDisplay) timeDisplay.textContent = this.formatStopwatch(this.stopwatchSeconds);
            if (modeLabel) modeLabel.textContent = 'STOPWATCH TELEMETRY';
            if (circle) {
                // Pulse effect or constant rotation
                const circumference = 2 * Math.PI * 135;
                const offset = (this.stopwatchSeconds % 60) / 60 * circumference;
                circle.style.strokeDashoffset = circumference - offset;
            }
            return;
        }

        // Countdown / Pomodoro
        const mins = Math.floor(this.remainingSeconds / 60);
        const secs = this.remainingSeconds % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (timeDisplay) timeDisplay.textContent = formatted;

        // Title update for browser tab
        document.title = this.isRunning ? `(${formatted}) CyberHUD Core` : 'CyberHUD | Daily Tasks & Exam Arena';

        // Update circular ring (radius = 135 -> circumference ~ 848.23)
        if (circle && this.totalSeconds > 0) {
            const circumference = 2 * Math.PI * 135;
            const progress = this.remainingSeconds / this.totalSeconds;
            const offset = circumference * (1 - progress);
            circle.style.strokeDashoffset = offset;
        }

        if (modeLabel) {
            if (this.mode === 'pomodoro') {
                modeLabel.textContent = this.pomoState === 'work' 
                    ? `FOCUS PROTOCOL (CYCLE #${this.pomoCycles + 1})`
                    : (this.pomoState === 'shortBreak' ? 'SHORT RECHARGE PROTOCOL' : 'LONG RECHARGE PROTOCOL');
            } else {
                modeLabel.textContent = 'CUSTOM COUNTDOWN CORE';
            }
        }
    }

    formatStopwatch(totalSecs) {
        const mins = Math.floor(totalSecs / 60);
        const secs = Math.floor(totalSecs % 60);
        const millis = Math.floor((totalSecs % 1) * 100);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
    }

    updatePlayButton() {
        const btn = document.getElementById('timerToggleBtn');
        if (!btn) return;

        if (this.isRunning) {
            btn.innerHTML = `<i data-lucide="pause"></i> PAUSE`;
            btn.classList.add('btn-active');
        } else {
            btn.innerHTML = `<i data-lucide="play"></i> START CORE`;
            btn.classList.remove('btn-active');
        }
        if (window.lucide) window.lucide.createIcons();
    }

    updateUiMode() {
        // Toggle sections for pomodoro vs custom vs stopwatch
        const pomoControls = document.getElementById('pomodoroSubControls');
        const customControls = document.getElementById('customTimerControls');
        const stopwatchControls = document.getElementById('stopwatchControls');

        if (pomoControls) pomoControls.style.display = this.mode === 'pomodoro' ? 'flex' : 'none';
        if (customControls) customControls.style.display = this.mode === 'custom' ? 'block' : 'none';
        if (stopwatchControls) stopwatchControls.style.display = this.mode === 'stopwatch' ? 'block' : 'none';

        // Tab buttons
        document.querySelectorAll('.timer-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.mode);
        });
    }

    updatePomoTabs() {
        document.querySelectorAll('.pomo-state-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.state === this.pomoState);
        });
    }

    updateAmbientButtons() {
        document.querySelectorAll('.ambient-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.ambient === this.ambientType);
        });
    }

    attachTask(taskId) {
        this.attachedTaskId = taskId;
        const task = window.taskManager?.tasks.find(t => t.id === taskId);
        const banner = document.getElementById('timerActiveTaskBanner');
        if (banner) {
            if (task) {
                banner.style.display = 'flex';
                banner.innerHTML = `
                    <div class="active-task-badge">🎯 TARGET TASK: <strong>${task.title}</strong></div>
                    <button class="btn-clear-task" onclick="focusTimer.detachTask()">&times;</button>
                `;
            } else {
                banner.style.display = 'none';
            }
        }
    }

    detachTask() {
        this.attachedTaskId = null;
        const banner = document.getElementById('timerActiveTaskBanner');
        if (banner) banner.style.display = 'none';
    }
}

window.FocusTimer = FocusTimer;
