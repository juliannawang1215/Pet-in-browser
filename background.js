/**
 * 加班计时唯一写入点：所有标签页只上报时间戳，状态合并在此，再写入 chrome.storage.local。
 */
const DAILY_LOG_KEY = 'afterHoursWorkLog';
const LOG_REV_KEY = 'afterHoursLogRev';
const IDLE_THRESHOLD_MS = 10 * 60 * 1000;
const MAX_LOG_DAYS = 120;

function broadcastLogToTabs(log, rev) {
    let snapshot;
    try {
        snapshot = JSON.parse(JSON.stringify(log));
    } catch {
        snapshot = log;
    }
    chrome.tabs.query({}, (tabs) => {
        if (!tabs || !tabs.length) return;
        for (const t of tabs) {
            if (t.id == null || t.id < 0) continue;
            chrome.tabs
                .sendMessage(t.id, { type: 'afterHoursLogSync', log: snapshot, rev })
                .catch(() => {});
        }
    });
}

function getDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function pruneOldLogs(logObj) {
    const keys = Object.keys(logObj).sort();
    if (keys.length <= MAX_LOG_DAYS) return logObj;
    const toDelete = keys.slice(0, keys.length - MAX_LOG_DAYS);
    const next = { ...logObj };
    toDelete.forEach((k) => delete next[k]);
    return next;
}

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

let mutationChain = Promise.resolve();

function enqueueOp(fn) {
    mutationChain = mutationChain
        .then(
            () =>
                new Promise((resolve, reject) => {
                    try {
                        fn(() => resolve());
                    } catch (e) {
                        reject(e);
                    }
                })
        )
        .catch(() => {});
}

function processActivity(nowMs, done) {
    chrome.storage.local.get([DAILY_LOG_KEY, LOG_REV_KEY], (items) => {
        let log = items[DAILY_LOG_KEY] || {};
        const prevRev = typeof items[LOG_REV_KEY] === 'number' ? items[LOG_REV_KEY] : 0;
        const rev = prevRev + 1;
        const dk = getDateKey(new Date(nowMs));
        const dayLog = log[dk];

        if (!dayLog || !dayLog.firstInteractionMs) {
            log[dk] = {
                firstInteractionMs: nowMs,
                lastInteractionMs: nowMs,
                lastActivityAt: nowMs,
                accumulatedActiveMs: 0,
                currentDurationMs: 0
            };
        } else {
            const lastAt = dayLog.lastActivityAt != null ? dayLog.lastActivityAt : dayLog.lastInteractionMs;
            let acc = typeof dayLog.accumulatedActiveMs === 'number' ? dayLog.accumulatedActiveMs : 0;
            const gap = nowMs - lastAt;
            if (gap <= IDLE_THRESHOLD_MS) {
                acc += gap;
            }
            const next = {
                firstInteractionMs: dayLog.firstInteractionMs,
                lastInteractionMs: nowMs,
                lastActivityAt: nowMs,
                accumulatedActiveMs: acc
            };
            next.currentDurationMs = computeActiveDurationMsFromDayLog({ ...dayLog, ...next }, nowMs);
            log[dk] = next;
        }
        log = pruneOldLogs(log);
        chrome.storage.local.set({ [DAILY_LOG_KEY]: log, [LOG_REV_KEY]: rev }, () => {
            broadcastLogToTabs(log, rev);
            done();
        });
    });
}

function processFlushSnapshot(done) {
    chrome.storage.local.get([DAILY_LOG_KEY, LOG_REV_KEY], (items) => {
        let log = items[DAILY_LOG_KEY] || {};
        const prevRev = typeof items[LOG_REV_KEY] === 'number' ? items[LOG_REV_KEY] : 0;
        const rev = prevRev + 1;
        const dk = getDateKey(new Date());
        const dayLog = log[dk];
        if (!dayLog || !dayLog.firstInteractionMs) {
            done();
            return;
        }
        const nowMs = Date.now();
        const currentDurationMs = computeActiveDurationMsFromDayLog(dayLog, nowMs);
        log[dk] = {
            ...dayLog,
            currentDurationMs,
            lastInteractionMs: dayLog.lastInteractionMs || nowMs
        };
        log = pruneOldLogs(log);
        chrome.storage.local.set({ [DAILY_LOG_KEY]: log, [LOG_REV_KEY]: rev }, () => {
            broadcastLogToTabs(log, rev);
            done();
        });
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'afterHoursActivity') {
        const ts = typeof msg.ts === 'number' ? msg.ts : Date.now();
        enqueueOp((done) => processActivity(ts, done));
        sendResponse({ ok: true });
        return false;
    }
    if (msg && msg.type === 'afterHoursFlush') {
        enqueueOp((done) => processFlushSnapshot(done));
        sendResponse({ ok: true });
        return false;
    }
    return false;
});

chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) return;
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSettings' }).catch((e) => {
        console.error('Failed to send toggleSettings:', e.message);
    });
});
