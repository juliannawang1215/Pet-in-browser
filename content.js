(function() {
    console.log("🐱 Cat Extension is trying to load...");
    // 防止重复注入（比如页面刷新或单页应用切换路由）
    if (document.getElementById('floating-pet-container')) return;

    // 创建最外层容器（负责拖拽和定位）
    const petContainer = document.createElement('div');
    petContainer.id = 'floating-pet-container';

    // ==========================================
    // 💰 实时薪水看板配置
    // ==========================================
    let annualSalary = 100000;
    let workStartTime = "09:00";
    const DAILY_LOG_KEY = 'afterHoursWorkLog';
    const LOG_REV_KEY = 'afterHoursLogRev';
    /** 与 background 一致，用于从 storage 快照推算展示用时长 */
    const IDLE_THRESHOLD_MS = 10 * 60 * 1000;
    /** 只读镜像：由 chrome.storage 更新；加班状态由 background 唯一写入 */
    let afterHoursLog = {};
    /** 与 background 写入单调递增的 revision 对齐，丢弃过期的 storage.get 结果 */
    let lastAppliedRevision = 0;
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['annualSalary', 'startTime'], (items) => {
            if (items.annualSalary) annualSalary = Number(items.annualSalary);
            if (items.startTime) workStartTime = items.startTime;
        });
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.annualSalary) annualSalary = Number(changes.annualSalary.newValue);
                if (changes.startTime) workStartTime = changes.startTime.newValue;
            }
        });
    }

    function getDateKey(d = new Date()) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatDuration(ms) {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    function formatDayLabel(dayKey) {
        const nowKey = getDateKey(new Date());
        if (dayKey === nowKey) return 'Today';
        const [, m, d] = dayKey.split('-');
        return `${m}/${d}`;
    }

    /** 与 persist 结构一致，仅用快照 + 当前时间推算展示用时长 */
    function computeActiveDurationMsFromDayLog(dayLog, nowMs = Date.now()) {
        if (!dayLog || !dayLog.firstInteractionMs) return 0;
        let acc = typeof dayLog.accumulatedActiveMs === 'number' ? dayLog.accumulatedActiveMs : 0;
        let lastAt = dayLog.lastActivityAt != null ? dayLog.lastActivityAt : null;
        if (lastAt == null && dayLog.lastInteractionMs) {
            lastAt = dayLog.lastInteractionMs;
        }
        if (
            dayLog.firstInteractionMs &&
            typeof dayLog.accumulatedActiveMs !== 'number' &&
            typeof dayLog.currentDurationMs === 'number'
        ) {
            acc = dayLog.currentDurationMs;
            lastAt = dayLog.lastInteractionMs || lastAt;
        }
        if (lastAt == null) return Math.max(0, acc);
        const gapSinceLast = nowMs - lastAt;
        const liveTail = gapSinceLast <= IDLE_THRESHOLD_MS ? gapSinceLast : 0;
        return Math.max(0, acc + liveTail);
    }

    function applyStorageLogFromRemote(remoteLog, rev) {
        if (typeof rev === 'number') {
            if (rev < lastAppliedRevision) return false;
            lastAppliedRevision = rev;
        } else if (lastAppliedRevision > 0) {
            return false;
        }
        if (!remoteLog || typeof remoteLog !== 'object') {
            afterHoursLog = {};
        } else {
            try {
                afterHoursLog = JSON.parse(JSON.stringify(remoteLog));
            } catch {
                afterHoursLog = { ...remoteLog };
            }
        }
        return true;
    }

    function getDayDurationMs(dayKey) {
        const currentKey = getDateKey(new Date());
        if (dayKey === currentKey) {
            return computeActiveDurationMsFromDayLog(afterHoursLog[dayKey], Date.now());
        }
        const dayLog = afterHoursLog[dayKey];
        if (!dayLog) return 0;
        if (typeof dayLog.accumulatedActiveMs === 'number') {
            return Math.max(0, dayLog.accumulatedActiveMs);
        }
        if (typeof dayLog.currentDurationMs === 'number') {
            return Math.max(0, dayLog.currentDurationMs);
        }
        if (dayLog.firstInteractionMs && dayLog.lastInteractionMs) {
            return Math.max(0, dayLog.lastInteractionMs - dayLog.firstInteractionMs);
        }
        return 0;
    }

    function recordInteractionNow() {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'afterHoursActivity', ts: Date.now() }).catch(() => {});
        }
    }

    function flushCurrentAfterHoursDuration() {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'afterHoursFlush' }).catch(() => {});
        }
    }

    function renderHistoryPanel() {
        const list = document.getElementById('modalHistoryList');
        const todayEl = document.getElementById('metricToday');
        const avg7El = document.getElementById('metricAvg7');
        const ytdEl = document.getElementById('metricYtd');
        if (!list) return;
        const sortedKeysDesc = Object.keys(afterHoursLog).sort((a, b) => (a < b ? 1 : -1));
        const currentTodayKey = getDateKey(new Date());
        const keys = sortedKeysDesc.filter((k) => k !== currentTodayKey).slice(0, 7);

        if (todayEl || avg7El || ytdEl) {
            const todayMs = getDayDurationMs(currentTodayKey);
            const daysForAvg = keys.length;
            const avg7Ms = daysForAvg > 0
                ? keys.reduce((sum, k) => sum + getDayDurationMs(k), 0) / daysForAvg
                : 0;

            const yearPrefix = `${new Date().getFullYear()}-`;
            const ytdMs = sortedKeysDesc
                .filter((k) => k.startsWith(yearPrefix))
                .reduce((sum, k) => sum + getDayDurationMs(k), 0);

            if (todayEl) todayEl.textContent = formatDuration(todayMs);
            if (avg7El) avg7El.textContent = formatDuration(avg7Ms);
            if (ytdEl) ytdEl.textContent = formatDuration(ytdMs);
        }

        if (keys.length === 0) {
            list.innerHTML = '';
            return;
        }
        list.innerHTML = keys.map((key) => (
            `<li class="cat-history-row"><span class="day">${formatDayLabel(key)}</span><span class="value">${formatDuration(getDayDurationMs(key))}</span></li>`
        )).join('');
    }

    function escapeCsvCell(value) {
        const raw = String(value ?? '');
        if (/[",\n]/.test(raw)) {
            return `"${raw.replace(/"/g, '""')}"`;
        }
        return raw;
    }

    function exportAfterHoursCsv() {
        const keys = Object.keys(afterHoursLog).sort((a, b) => (a < b ? 1 : -1));
        const header = [
            'date',
            'first_interaction_local',
            'last_interaction_local',
            'active_duration_hms',
            'active_duration_hours_decimal',
            'idle_threshold_minutes'
        ];
        const rows = keys.map((key) => {
            const day = afterHoursLog[key] || {};
            const first = day.firstInteractionMs ? new Date(day.firstInteractionMs).toLocaleString() : '';
            const last = day.lastInteractionMs ? new Date(day.lastInteractionMs).toLocaleString() : '';
            const durationMs = getDayDurationMs(key);
            const durationHms = formatDuration(durationMs);
            const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(4);
            return [key, first, last, durationHms, durationHours, String(IDLE_THRESHOLD_MS / 60000)];
        });

        const csv = [header, ...rows]
            .map((row) => row.map(escapeCsvCell).join(','))
            .join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `after-hours-working-log-${getDateKey(new Date())}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function refreshAfterHoursFromStorage(done) {
        if (!chrome.storage || !chrome.storage.local) {
            if (done) done();
            return;
        }
        chrome.storage.local.get([DAILY_LOG_KEY, LOG_REV_KEY], (items) => {
            applyStorageLogFromRemote(items[DAILY_LOG_KEY], items[LOG_REV_KEY]);
            if (done) done();
        });
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        refreshAfterHoursFromStorage(() => renderHistoryPanel());
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local') return;
            if (!changes[DAILY_LOG_KEY] && !changes[LOG_REV_KEY]) return;
            chrome.storage.local.get([DAILY_LOG_KEY, LOG_REV_KEY], (items) => {
                if (applyStorageLogFromRemote(items[DAILY_LOG_KEY], items[LOG_REV_KEY])) {
                    renderHistoryPanel();
                }
            });
        });
    } else {
        afterHoursLog = {};
    }

    const salaryBubble = document.createElement('div');
    salaryBubble.id = 'salary-bubble';
    petContainer.appendChild(salaryBubble);
    
    // ==========================================
    // 💡【未来更换为 WebM 高清视频的教程】💡
    // 1. 把你的视频（例如 dog.webm）复制到这个 cat-extension 文件夹里
    // 2. 把下面 "USE_WEBM" 的值改为 true
    // 3. 把 "WEBM_FILENAME" 的值改为你的视频名字，比如 'dog.webm'
    // 4. 去浏览器的扩展页面刷新一下这个插件即可！
    // ==========================================
    const USE_WEBM = true; 
    const WEBM_CONFIGS = [
        { src: 'you_video.webm', scale: 1.0 },
        { src: 'video2.webm', scale: 0.84 }, // V2 is 9:16, 18% taller, scale down to match apparent size
        { src: 'video3.webm', scale: 1.0 } // Action 3
    ];
    const ANIMATED_IMAGE = 'cat_transparent.png'; // 动态图
    const STATIC_IMAGE = 'cat_static_hd.png'; // 高清静止图
    const WALK_SPRITE = 'cat_walk_strip.png'; // 8-frame horizontal strip
    /** 走路精灵条 + 自动遛猫：暂时关闭；换好素材后改为 true 即可恢复 */
    const ENABLE_CAT_WALK = false;

    let staticImgElement;
    let walkSpriteElement;
    let walkStripImgElement;
    let animatedVideoElement;
    let isAnimating = false;
    const WALK_FRAME_COUNT = 12;
    const WALK_FRAME_WIDTH = 256;
    const WALK_FRAME_HEIGHT = 186;
    const WALK_FPS = 10;
    let walkFrameIndex = 0;
    let walkFrameElapsed = 0;

    // 创建静止的高清图片元素
    staticImgElement = document.createElement('img');
    staticImgElement.src = chrome.runtime.getURL(STATIC_IMAGE);
    staticImgElement.id = 'floating-pet-static';
    staticImgElement.style.display = 'block'; // 默认显示静止图
    petContainer.appendChild(staticImgElement);

    // 创建走路精灵帧元素（默认隐藏，仅在 walk 状态显示）
    walkSpriteElement = document.createElement('div');
    walkSpriteElement.id = 'floating-pet-walk';
    walkSpriteElement.style.display = 'none';
    walkStripImgElement = document.createElement('img');
    walkStripImgElement.src = chrome.runtime.getURL(WALK_SPRITE);
    walkStripImgElement.id = 'floating-pet-walk-strip';
    walkSpriteElement.appendChild(walkStripImgElement);
    petContainer.appendChild(walkSpriteElement);
    if (!ENABLE_CAT_WALK) {
        petContainer.classList.add('cat-ext-walk-disabled');
    }

    if (USE_WEBM) {
        // 创建 Video 视频元素 (隐藏)
        animatedVideoElement = document.createElement('video');
        animatedVideoElement.src = chrome.runtime.getURL(WEBM_CONFIGS[0].src);
        animatedVideoElement.loop = false;
        animatedVideoElement.muted = true;
        animatedVideoElement.playsInline = true;
        animatedVideoElement.id = 'floating-pet-animated';
        animatedVideoElement.style.display = 'none'; // 默认隐藏
        
        animatedVideoElement.addEventListener('ended', () => {
            animatedVideoElement.style.display = 'none';
            staticImgElement.style.display = 'block';
            animatedVideoElement.currentTime = 0;
            isAnimating = false;
        });
        
        petContainer.appendChild(animatedVideoElement);
    } else {
        // ... (keep fallback if USE_WEBM is false, we can just use the img element)
        // Since we are now using webm as requested, simplify.
        staticImgElement.id = 'floating-pet-media'; 
    }

    document.body.appendChild(petContainer);

    if (!document.getElementById('cat-ext-font-inter')) {
        const link = document.createElement('link');
        link.id = 'cat-ext-font-inter';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap';
        document.head.appendChild(link);
    }

    // 注入 CSS 样式
    const css = `
        #floating-pet-container {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            width: 160px !important; /* 调整宠物默认大小 */
            z-index: 2147483647 !important; /* 置于顶层 */
            cursor: grab !important;
            filter: drop-shadow(0 10px 15px rgba(0,0,0,0.2)) !important;
            transition: filter 0.2s ease, transform 0.05s linear !important;
            user-select: none !important;
            touch-action: none !important;
        }

        #floating-pet-container:active {
            cursor: grabbing !important;
            filter: drop-shadow(0 20px 25px rgba(0,0,0,0.3)) !important;
        }

        #floating-pet-static,
        #floating-pet-walk,
        #floating-pet-animated,
        #floating-pet-media {
            width: 100% !important;
            height: auto !important;
            display: block; /* 被行内样式覆盖 */
            background: transparent !important;
        }

        #floating-pet-walk {
            aspect-ratio: ${WALK_FRAME_WIDTH} / ${WALK_FRAME_HEIGHT} !important;
            overflow: hidden !important;
            position: relative !important;
        }

        #floating-pet-walk-strip {
            width: ${WALK_FRAME_COUNT * 100}% !important;
            height: 100% !important;
            max-width: none !important;
            transform: translateX(0%);
            will-change: transform !important;
            display: block !important;
        }

        #floating-pet-container.cat-ext-walk-disabled #floating-pet-walk {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }

        #salary-bubble {
            position: absolute !important;
            bottom: 100% !important;
            left: 50% !important;
            transform: translateX(-50%) translateY(70px) !important;
            background: rgba(28, 28, 32, 0.58) !important;
            backdrop-filter: blur(18px) saturate(160%) !important;
            -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
            border: 1px solid rgba(255, 255, 255, 0.14) !important;
            border-radius: 8px !important;
            padding: 8px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
            gap: 8px !important;
            width: max-content !important;
            max-width: min(280px, calc(100vw - 24px)) !important;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
            opacity: 0 !important;
            visibility: hidden !important;
            transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), visibility 0.3s !important;
            pointer-events: none !important;
            z-index: 10 !important;
            box-sizing: border-box !important;
        }

        .bubble-group {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 4px !important;
            width: 100% !important;
        }

        .bubble-label {
            font-size: 10px !important;
            font-weight: 400 !important;
            font-style: normal !important;
            line-height: normal !important;
            color: #ffffff !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
            margin: 0 !important;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        #salary-bubble.show {
            opacity: 1 !important;
            visibility: visible !important;
            transform: translateX(-50%) translateY(56px) !important;
        }

        .bubble-amount {
            font-size: 12px !important;
            line-height: 12px !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            white-space: nowrap !important;
            margin: 0 !important;
            font-variant-numeric: tabular-nums !important;
        }

        .bubble-time {
            font-size: 12px !important;
            line-height: 12px !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            white-space: nowrap !important;
            margin: 0 !important;
            font-variant-numeric: tabular-nums !important;
        }



        #cat-settings-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.38) !important;
            backdrop-filter: blur(14px) saturate(140%) !important;
            -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
            z-index: 2147483646 !important;
            display: none;
            justify-content: center !important;
            align-items: center !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }

        #cat-settings-modal {
            background: rgba(26, 26, 30, 0.72) !important;
            backdrop-filter: blur(22px) saturate(165%) !important;
            -webkit-backdrop-filter: blur(22px) saturate(165%) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            width: 380px !important;
            padding: 32px 24px !important;
            border-radius: 16px !important;
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
            color: #ffffff !important;
            position: relative !important;
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        #cat-settings-overlay.show {
            display: flex !important;
        }

        #cat-settings-overlay.show #cat-settings-modal {
            transform: translateY(0);
            opacity: 1;
        }

        .cat-settings-title {
            margin: 0 !important;
            font-size: 20px !important;
            font-weight: 700 !important;
            text-align: left !important;
            letter-spacing: -0.02em !important;
            color: #ffffff !important;
        }

        .cat-main-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            margin: 0 0 16px 0 !important;
            min-height: 24px !important;
        }

        .cat-main-header-right {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
        }

        .cat-settings-group {
            margin-bottom: 16px !important;
            display: flex !important;
            flex-direction: column !important;
        }

        .cat-settings-label {
            font-weight: 600 !important;
            margin-bottom: 8px !important;
            font-size: 13px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            color: rgba(255, 255, 255, 0.55) !important;
        }

        .cat-settings-input {
            background: #2a2a2e !important;
            border: 1px solid #3d3d42 !important;
            border-radius: 8px !important;
            padding: 12px 14px !important;
            font-size: 15px !important;
            color: #ffffff !important;
            outline: none !important;
            transition: border-color 0.2s ease !important;
            font-family: inherit !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }

        .cat-settings-input:focus {
            border-color: rgba(255, 255, 255, 0.45) !important;
            background: #323236 !important;
        }

        .cat-settings-btn {
            background: #ffffff !important;
            color: #1a1a1c !important;
            border: none !important;
            border-radius: 8px !important;
            padding: 16px !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            width: 100% !important;
            margin-top: 8px !important;
            transition: opacity 0.2s ease !important;
        }

        .cat-settings-btn:hover {
            opacity: 0.9 !important;
        }

        .cat-settings-gear {
            width: 24px !important;
            height: 24px !important;
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            color: #ffffff !important;
            font-size: 20px !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
            padding: 0 !important;
        }

        .cat-settings-gear:hover {
            opacity: 0.7 !important;
        }

        .cat-subpanel {
            display: none !important;
        }

        .cat-subpanel.show {
            display: block !important;
        }

        .cat-subpanel-header {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 16px !important;
        }

        .cat-back-btn {
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            color: #ffffff !important;
            padding: 0 !important;
            width: 24px !important;
            height: 24px !important;
            font-size: 20px !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
        }

        .cat-subpanel-title {
            font-size: 18px !important;
            font-weight: 700 !important;
            color: #ffffff !important;
            margin: 0 !important;
            letter-spacing: -0.02em !important;
        }

        .cat-settings-close {
            width: 24px !important;
            height: 24px !important;
            background: transparent !important;
            border: none !important;
            font-size: 20px !important;
            cursor: pointer !important;
            color: rgba(255, 255, 255, 0.55) !important;
            line-height: 1 !important;
            padding: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .cat-history-panel {
            margin-top: 16px !important;
            border: 1px solid #3d3d42 !important;
            border-radius: 10px !important;
            padding: 12px !important;
            background: #242428 !important;
        }

        .cat-metrics {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
        }

        .cat-metric {
            background: #2a2a2e !important;
            border: 1px solid #3d3d42 !important;
            border-radius: 8px !important;
            padding: 8px 6px !important;
            text-align: center !important;
        }

        .cat-metric-label {
            font-size: 10px !important;
            color: rgba(255, 255, 255, 0.5) !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            margin-bottom: 4px !important;
            line-height: 1.2 !important;
        }

        .cat-metric-value {
            font-size: 12px !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            line-height: 1.2 !important;
        }

        .cat-history-title {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: rgba(255, 255, 255, 0.55) !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            margin-bottom: 8px !important;
        }

        .cat-history-list {
            margin: 0 !important;
            padding: 0 !important;
            list-style: none !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            max-height: 170px !important;
            overflow: auto !important;
        }

        .cat-history-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            font-size: 13px !important;
            color: #ffffff !important;
            padding: 4px 0 !important;
        }

        .cat-history-row .day {
            color: rgba(255, 255, 255, 0.55) !important;
        }

        .cat-history-row .value {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            font-weight: 600 !important;
        }

        .cat-export-btn {
            margin-top: 10px !important;
            width: 100% !important;
            border: 1px solid #3d3d42 !important;
            background: #2a2a2e !important;
            color: #ffffff !important;
            border-radius: 8px !important;
            padding: 10px 12px !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
        }

        .cat-export-btn:hover {
            background: #323236 !important;
        }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ==========================================
    // 拖拽与点击交互逻辑
    // ==========================================
    let isDragging = false;
    let isDragReady = false; // Add variable for long press drag logic
    let dragDelayTimer = null;
    let initialX, initialY, currentX, currentY;
    let xOffset = 0, yOffset = 0;
    
    // 记录点击按下的起点，以此判断是“拖拽”还是“点击”
    let clickStartX, clickStartY;

    // ==========================================
    // 薪水看板悬停逻辑（加班时长以 storage 为准，定时拉回 + onChanged）
    // ==========================================
    let salaryRafId = null;
    const BUBBLE_STORAGE_REFRESH_MS = 200;
    let lastBubbleStorageRefreshAt = 0;
    let bubbleStorageRefreshInflight = false;

    petContainer.addEventListener('mouseenter', () => {
        if (isDragging || isDragReady) return;
        salaryBubble.classList.add('show');
        lastBubbleStorageRefreshAt = 0;
        updateSalary();
    });

    petContainer.addEventListener('mouseleave', () => {
        salaryBubble.classList.remove('show');
        if (salaryRafId) {
            cancelAnimationFrame(salaryRafId);
            salaryRafId = null;
        }
    });

    function updateSalary() {
        if (!salaryBubble.classList.contains('show')) {
            if (salaryRafId) {
                cancelAnimationFrame(salaryRafId);
                salaryRafId = null;
            }
            return;
        }

        const nowMs = Date.now();

        function paintBubble() {
            const tick = new Date();
            const dk = getDateKey(tick);
            const dayLog = afterHoursLog[dk];
            const afterHoursMs = computeActiveDurationMsFromDayLog(dayLog, Date.now());
            const afterHoursText = dayLog && dayLog.firstInteractionMs ? formatDuration(afterHoursMs) : '--:--:--';

            const [hours, minutes] = workStartTime.split(':').map(Number);
            const startOfWork = new Date(tick.getFullYear(), tick.getMonth(), tick.getDate(), hours || 9, minutes || 0, 0, 0);
            const endOfWorkDay = new Date(tick.getFullYear(), tick.getMonth(), tick.getDate(), 17, 0, 0, 0);
            const dayOfWeek = tick.getDay();
            const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

            let earned = 0;
            if (isWeekday && tick > startOfWork) {
                const capTime = tick >= endOfWorkDay ? endOfWorkDay : tick;
                if (capTime > startOfWork) {
                    const msWorked = capTime - startOfWork;
                    const msPerYearWork = 52 * 5 * 8 * 60 * 60 * 1000;
                    earned = (annualSalary / msPerYearWork) * msWorked;
                }
            }

            salaryBubble.innerHTML = `
            <div class="bubble-group">
                <p class="bubble-label">Earned today</p>
                <p class="bubble-amount">$${earned.toFixed(2)}</p>
            </div>
            <div class="bubble-group">
                <p class="bubble-label">After-hours working time</p>
                <p class="bubble-time">${afterHoursText}</p>
            </div>
        `;
        }

        if (chrome.storage && chrome.storage.local) {
            const needPull = nowMs - lastBubbleStorageRefreshAt >= BUBBLE_STORAGE_REFRESH_MS;
            if (needPull && !bubbleStorageRefreshInflight) {
                bubbleStorageRefreshInflight = true;
                lastBubbleStorageRefreshAt = nowMs;
                chrome.storage.local.get([DAILY_LOG_KEY, LOG_REV_KEY], (items) => {
                    bubbleStorageRefreshInflight = false;
                    applyStorageLogFromRemote(items[DAILY_LOG_KEY], items[LOG_REV_KEY]);
                    if (salaryBubble.classList.contains('show')) {
                        paintBubble();
                    }
                });
            } else {
                paintBubble();
            }
        } else {
            paintBubble();
        }

        salaryRafId = requestAnimationFrame(updateSalary);
    }

    ['mousedown', 'keydown', 'wheel', 'touchstart', 'pointerdown', 'scroll'].forEach((evt) => {
        document.addEventListener(evt, recordInteractionNow, { passive: true });
    });
    let mouseMoveRaf = null;
    function onMouseMovePulse() {
        if (mouseMoveRaf) return;
        mouseMoveRaf = requestAnimationFrame(() => {
            mouseMoveRaf = null;
            recordInteractionNow();
        });
    }
    document.addEventListener('mousemove', onMouseMovePulse, { passive: true });
    setInterval(flushCurrentAfterHoursDuration, 60 * 1000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushCurrentAfterHoursDuration();
    });

    petContainer.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    let animationTimer = null;
    let pressScale = 1;
    let currentVideoScale = 1;

    let isAutoWalking = true;
    let petState = 'idle'; // idle | walk
    let walkDir = Math.random() > 0.5 ? 1 : -1;
    let walkSpeed = 55; // px / second
    let nextStateChangeAt = performance.now() + 1000;
    let autoWalkLastTs = null;

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function scheduleNextState(now) {
        if (petState === 'walk') {
            petState = 'idle';
            // Stay still for a long random period: 5-10 minutes
            nextStateChangeAt = now + rand(5 * 60 * 1000, 10 * 60 * 1000);
        } else {
            petState = 'walk';
            if (Math.random() < 0.45) walkDir *= -1;
            applyMediaTransform();
            // Walk only for a short burst before idling again
            nextStateChangeAt = now + rand(3500, 9000);
        }
    }

    function applyContainerTransform() {
        petContainer.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(${pressScale})`;
    }

    function applyMediaTransform() {
        const flip = walkDir;
        staticImgElement.style.transform = `scaleX(${flip})`;
        staticImgElement.style.transformOrigin = 'bottom center';
        walkSpriteElement.style.transform = `scaleX(${flip})`;
        walkSpriteElement.style.transformOrigin = 'bottom center';

        if (animatedVideoElement) {
            animatedVideoElement.style.transform = `scale(${currentVideoScale * flip}, ${currentVideoScale})`;
            animatedVideoElement.style.transformOrigin = 'bottom center';
        }
    }

    function setWalkFrame(frameIndex) {
        const clamped = ((frameIndex % WALK_FRAME_COUNT) + WALK_FRAME_COUNT) % WALK_FRAME_COUNT;
        const shiftPct = (clamped * 100) / WALK_FRAME_COUNT;
        walkStripImgElement.style.transform = `translateX(-${shiftPct}%)`;
    }

    function setWalkVisualActive(isWalkActive) {
        if (isAnimating) return;
        walkSpriteElement.style.display = isWalkActive ? 'block' : 'none';
        staticImgElement.style.display = isWalkActive ? 'none' : 'block';
    }

    function pauseAutoWalk() {
        isAutoWalking = false;
    }

    function resumeAutoWalk(delay = 0) {
        setTimeout(() => {
            isAutoWalking = true;
            // Resume into long idle rhythm after user interaction
            if (petState === 'walk') {
                nextStateChangeAt = performance.now() + rand(1500, 4000);
            } else {
                nextStateChangeAt = performance.now() + rand(5 * 60 * 1000, 10 * 60 * 1000);
            }
        }, delay);
    }

    function shouldPauseAutoWalk() {
        return (
            !isAutoWalking ||
            isDragging ||
            isDragReady ||
            isAnimating ||
            overlay.classList.contains('show')
        );
    }

    function keepPetInViewport() {
        const rect = petContainer.getBoundingClientRect();
        let bounced = false;

        if (rect.left < 0) {
            xOffset += -rect.left;
            walkDir = 1;
            bounced = true;
        }
        if (rect.right > window.innerWidth) {
            xOffset -= (rect.right - window.innerWidth);
            walkDir = -1;
            bounced = true;
        }
        if (rect.top < 0) {
            yOffset += -rect.top;
        }
        if (rect.bottom > window.innerHeight) {
            yOffset -= (rect.bottom - window.innerHeight);
        }

        if (bounced) applyMediaTransform();
    }

    function autoWalkTick(ts) {
        if (!autoWalkLastTs) autoWalkLastTs = ts;
        const deltaSec = Math.min((ts - autoWalkLastTs) / 1000, 0.05);
        autoWalkLastTs = ts;

        if (!ENABLE_CAT_WALK) {
            if (!isAnimating) setWalkVisualActive(false);
            requestAnimationFrame(autoWalkTick);
            return;
        }

        if (!shouldPauseAutoWalk()) {
            if (ts >= nextStateChangeAt) scheduleNextState(ts);

            if (petState === 'walk') {
                setWalkVisualActive(true);
                walkFrameElapsed += deltaSec;
                if (walkFrameElapsed >= 1 / WALK_FPS) {
                    const steps = Math.floor(walkFrameElapsed * WALK_FPS);
                    walkFrameIndex = (walkFrameIndex + steps) % WALK_FRAME_COUNT;
                    setWalkFrame(walkFrameIndex);
                    walkFrameElapsed -= steps / WALK_FPS;
                }
                xOffset += walkDir * walkSpeed * deltaSec;
                applyContainerTransform();
                keepPetInViewport();
                applyContainerTransform();
            } else {
                setWalkVisualActive(false);
            }
        } else if (!isAnimating) {
            setWalkVisualActive(false);
        }

        requestAnimationFrame(autoWalkTick);
    }

    function toggleAnimation() {
        if (isAnimating) return; // 如果正在播放动画，忽略多余点击
        isAnimating = true;
        
        if (USE_WEBM) {
            let randomConfig = WEBM_CONFIGS[Math.floor(Math.random() * WEBM_CONFIGS.length)];
            currentVideoScale = randomConfig.scale;
            animatedVideoElement.src = chrome.runtime.getURL(randomConfig.src);
            applyMediaTransform();
            animatedVideoElement.load();
            walkSpriteElement.style.display = 'none';
            staticImgElement.style.display = 'none';
            animatedVideoElement.style.display = 'block';
            animatedVideoElement.currentTime = 0;
            animatedVideoElement.play();
        } else {
            let targetSrc = chrome.runtime.getURL(ANIMATED_IMAGE);
            targetSrc += "?t=" + Date.now();
            staticImgElement.src = targetSrc;
            
            clearTimeout(animationTimer);
            animationTimer = setTimeout(() => {
                isAnimating = false;
                staticImgElement.src = chrome.runtime.getURL(STATIC_IMAGE);
            }, 5000);
        }
        
        // Add visual click feedback
        pauseAutoWalk();
        pressScale = 0.95;
        applyContainerTransform();
        setTimeout(() => {
            pressScale = 1;
            applyContainerTransform();
            resumeAutoWalk(400);
        }, 150);
    }

    function dragStart(e) {
        if (e.target === petContainer || e.target === staticImgElement || e.target === animatedVideoElement) {
            salaryBubble.classList.remove('show');
            if (salaryRafId) cancelAnimationFrame(salaryRafId);
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            clickStartX = e.clientX;
            clickStartY = e.clientY;
            e.preventDefault(); // 阻止默认的文本/图片拖动行为
            pauseAutoWalk();
            
            // 启动长按检测计时器 (300ms 后才允许拖拽)
            dragDelayTimer = setTimeout(() => {
                isDragReady = true;
                isDragging = true;
                // 长按成功时的交互视觉反馈 (阴影加深)
                petContainer.style.filter = "drop-shadow(0 25px 35px rgba(0,0,0,0.5))";
            }, 300);
        }
    }

    function dragEnd(e) {
        // 松开鼠标时，先清除长按计时器
        clearTimeout(dragDelayTimer);
        
        // 恢复视觉效果
        petContainer.style.filter = "";
        
        if (!isDragReady) {
            // 如果没达到长按时间 (300ms) 就松开了，说明这是一次点击！
            // 为了防止点击时手抖滑动了鼠标，我们设定滑动位移 < 15 像素都算作点击
            let moveDistance = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
            if (moveDistance < 15) {
                toggleAnimation();
            } else {
                resumeAutoWalk(250);
            }
        } else {
            // 这是真正的拖拽结束，保存最新位移状态
            if (typeof currentX !== 'undefined') initialX = currentX;
            if (typeof currentY !== 'undefined') initialY = currentY;
            keepPetInViewport();
            setTranslate(xOffset, yOffset, petContainer);
            resumeAutoWalk(500);
        }

        isDragReady = false;
        isDragging = false;
    }

    function drag(e) {
        // 如果长按还没准备好，或者没有处于拖拽状态，屏蔽鼠标移动事件
        if (!isDragReady || !isDragging) return;
        
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(currentX, currentY, petContainer);
    }

    function setTranslate(xPos, yPos, el) {
        xOffset = xPos;
        yOffset = yPos;
        applyContainerTransform();
    }

    // ==========================================
    // ⚙️ 设置面板 (In-page Modal)
    // ==========================================
    const overlay = document.createElement('div');
    overlay.id = 'cat-settings-overlay';
    overlay.innerHTML = `
        <div id="cat-settings-modal">
            <div id="modalMainPanel" class="cat-subpanel show">
                <div class="cat-main-header">
                    <h2 class="cat-settings-title">More</h2>
                    <div class="cat-main-header-right">
                        <button id="modalSettingsOpen" class="cat-settings-gear">⚙</button>
                        <button class="cat-settings-close">&times;</button>
                    </div>
                </div>
                <div class="cat-history-panel">
                    <div class="cat-history-title">After-hours working hours</div>
                    <div class="cat-metrics">
                        <div class="cat-metric">
                            <div class="cat-metric-label">Today</div>
                            <div id="metricToday" class="cat-metric-value">--:--:--</div>
                        </div>
                        <div class="cat-metric">
                            <div class="cat-metric-label">7-day avg</div>
                            <div id="metricAvg7" class="cat-metric-value">--:--:--</div>
                        </div>
                        <div class="cat-metric">
                            <div class="cat-metric-label">YTD total</div>
                            <div id="metricYtd" class="cat-metric-value">--:--:--</div>
                        </div>
                    </div>
                    <ul id="modalHistoryList" class="cat-history-list"></ul>
                    <button id="modalExportBtn" class="cat-export-btn">Export Spreadsheet (CSV)</button>
                </div>
            </div>
            <div id="modalSettingsPanel" class="cat-subpanel">
                <div class="cat-subpanel-header">
                    <button id="modalSettingsBack" class="cat-back-btn">←</button>
                    <h3 class="cat-subpanel-title">Settings</h3>
                </div>
                <div class="cat-settings-group">
                    <label class="cat-settings-label">Annual Salary ($)</label>
                    <input type="number" id="modalAnnualSalary" class="cat-settings-input" placeholder="100000">
                </div>
                <div class="cat-settings-group">
                    <label class="cat-settings-label">Work Start Time</label>
                    <input type="time" id="modalStartTime" class="cat-settings-input">
                </div>
                <button id="modalSaveBtn" class="cat-settings-btn">Save Settings</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.classList.remove('show');
    };

    overlay.querySelector('.cat-settings-close').onclick = closeModal;
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal();
    };

    const showMainPanel = () => {
        overlay.querySelector('#modalMainPanel').classList.add('show');
        overlay.querySelector('#modalSettingsPanel').classList.remove('show');
    };

    const showSettingsPanel = () => {
        overlay.querySelector('#modalMainPanel').classList.remove('show');
        overlay.querySelector('#modalSettingsPanel').classList.add('show');
    };

    overlay.querySelector('#modalSaveBtn').onclick = () => {
        const newSalary = overlay.querySelector('#modalAnnualSalary').value;
        const newStartTime = overlay.querySelector('#modalStartTime').value;

        if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({
                annualSalary: newSalary || 100000,
                startTime: newStartTime || '09:00'
            }, () => {
                showMainPanel();
            });
        }
    };
    overlay.querySelector('#modalSettingsOpen').onclick = showSettingsPanel;
    overlay.querySelector('#modalSettingsBack').onclick = showMainPanel;

    overlay.querySelector('#modalExportBtn').onclick = () => {
        flushCurrentAfterHoursDuration();
        refreshAfterHoursFromStorage(() => exportAfterHoursCsv());
    };

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Content script received message:", request);
        if (request.type === 'afterHoursLogSync' && request.log && typeof request.log === 'object') {
            const rev = typeof request.rev === 'number' ? request.rev : undefined;
            if (applyStorageLogFromRemote(request.log, rev)) {
                renderHistoryPanel();
            }
            return;
        }
        if (request.action === "toggleSettings") {
            overlay.querySelector('#modalAnnualSalary').value = annualSalary;
            overlay.querySelector('#modalStartTime').value = workStartTime;
            showMainPanel();
            overlay.classList.toggle('show');
            refreshAfterHoursFromStorage(() => renderHistoryPanel());
        }
    });

    window.addEventListener('resize', () => {
        keepPetInViewport();
        setTranslate(xOffset, yOffset, petContainer);
    });

    applyMediaTransform();
    setWalkFrame(0);
    petState = 'idle';
    nextStateChangeAt = performance.now() + rand(5 * 60 * 1000, 10 * 60 * 1000);
    requestAnimationFrame(autoWalkTick);
})();
