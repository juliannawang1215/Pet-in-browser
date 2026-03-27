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

    let staticImgElement;
    let animatedVideoElement;
    let isAnimating = false;

    // 创建静止的高清图片元素
    staticImgElement = document.createElement('img');
    staticImgElement.src = chrome.runtime.getURL(STATIC_IMAGE);
    staticImgElement.id = 'floating-pet-static';
    staticImgElement.style.display = 'block'; // 默认显示静止图
    petContainer.appendChild(staticImgElement);

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
        #floating-pet-animated,
        #floating-pet-media {
            width: 100% !important;
            height: auto !important;
            display: block; /* 被行内样式覆盖 */
            background: transparent !important;
        }

        #salary-bubble {
            position: absolute !important;
            bottom: 100% !important;
            left: 50% !important;
            transform: translateX(-50%) translateY(70px) !important;
            background: rgba(255, 255, 255, 0.1) !important; /* User specified transparent white */
            backdrop-filter: blur(10px) !important; /* Glass effect for transparency */
            -webkit-backdrop-filter: blur(10px) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important; /* Subtle white border */
            border-radius: 13px !important; /* User specified */
            padding: 8px 16px !important;
            width: 142px !important;
            height: 52px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
            opacity: 0 !important;
            visibility: hidden !important;
            transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), visibility 0.3s !important;
            white-space: nowrap !important;
            pointer-events: none !important;
            z-index: 10 !important;
            box-sizing: border-box !important;
        }

        #salary-bubble.show {
            opacity: 1 !important;
            visibility: visible !important;
            transform: translateX(-50%) translateY(56px) !important;
        }

        .bubble-subtext {
            font-size: 11px !important;
            color: #666666 !important;
            font-weight: 400 !important;
            margin-bottom: 2px !important;
            line-height: 1 !important;
        }

        .bubble-amount {
            font-size: 18px !important;
            color: #000000 !important;
            font-weight: 600 !important;
            line-height: 1 !important;
        }



        #cat-settings-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.4) !important;
            backdrop-filter: blur(4px) !important;
            z-index: 2147483646 !important;
            display: none;
            justify-content: center !important;
            align-items: center !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }

        #cat-settings-modal {
            background: #ffffff !important;
            width: 380px !important;
            padding: 32px 24px !important;
            border-radius: 16px !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2) !important;
            color: #111111 !important;
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
            margin: 0 0 32px 0 !important;
            font-size: 20px !important;
            font-weight: 700 !important;
            text-align: left !important;
            letter-spacing: -0.02em !important;
        }

        .cat-settings-group {
            margin-bottom: 24px !important;
            display: flex !important;
            flex-direction: column !important;
        }

        .cat-settings-label {
            font-weight: 600 !important;
            margin-bottom: 8px !important;
            font-size: 13px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            color: #666 !important;
        }

        .cat-settings-input {
            background: #fafafa !important;
            border: 1px solid #e5e5e5 !important;
            border-radius: 8px !important;
            padding: 12px 14px !important;
            font-size: 15px !important;
            color: #111 !important;
            outline: none !important;
            transition: border-color 0.2s ease !important;
            font-family: inherit !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }

        .cat-settings-input:focus {
            border-color: #000 !important;
            background: #fff !important;
        }

        .cat-settings-btn {
            background: #000 !important;
            color: #fff !important;
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

        .cat-settings-close {
            position: absolute !important;
            top: 20px !important;
            right: 20px !important;
            background: none !important;
            border: none !important;
            font-size: 20px !important;
            cursor: pointer !important;
            color: #999 !important;
            line-height: 1 !important;
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
    // 薪水看板悬停逻辑
    // ==========================================
    let salaryRafId = null;

    petContainer.addEventListener('mouseenter', () => {
        if (isDragging || isDragReady) return;
        salaryBubble.classList.add('show');
        updateSalary();
    });

    petContainer.addEventListener('mouseleave', () => {
        salaryBubble.classList.remove('show');
        if (salaryRafId) cancelAnimationFrame(salaryRafId);
    });

    function updateSalary() {
        if (salaryRafId) cancelAnimationFrame(salaryRafId);
        
        const now = new Date();
        const [hours, minutes] = workStartTime.split(':').map(Number);
        const startOfWork = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 9, minutes || 0, 0, 0);
        
        let earned = 0;
        if (now > startOfWork) {
            const msWorked = now - startOfWork;
            // 一年工作时长: 52周 * 5天 * 8小时 * 60分 * 60秒 * 1000毫秒
            const msPerYearWork = 52 * 5 * 8 * 60 * 60 * 1000;
            earned = (annualSalary / msPerYearWork) * msWorked;
        }
        
        // 使用 Figma 设计的结构，并增加小数位以展示动态跳动感
        salaryBubble.innerHTML = `
            <div class="bubble-subtext">Today you earned</div>
            <div class="bubble-amount">$${earned.toFixed(4)}</div>
        `;
        
        salaryRafId = requestAnimationFrame(updateSalary);
    }

    petContainer.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    let animationTimer = null;

    function toggleAnimation() {
        if (isAnimating) return; // 如果正在播放动画，忽略多余点击
        isAnimating = true;
        
        if (USE_WEBM) {
            let randomConfig = WEBM_CONFIGS[Math.floor(Math.random() * WEBM_CONFIGS.length)];
            animatedVideoElement.src = chrome.runtime.getURL(randomConfig.src);
            animatedVideoElement.style.transform = `scale(${randomConfig.scale})`;
            animatedVideoElement.style.transformOrigin = 'bottom center';
            animatedVideoElement.load();
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
        petContainer.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(0.95)`;
        setTimeout(() => {
            petContainer.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(1)`;
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
            }
        } else {
            // 这是真正的拖拽结束，保存最新位移状态
            if (typeof currentX !== 'undefined') initialX = currentX;
            if (typeof currentY !== 'undefined') initialY = currentY;
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
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    // ==========================================
    // ⚙️ 设置面板 (In-page Modal)
    // ==========================================
    const overlay = document.createElement('div');
    overlay.id = 'cat-settings-overlay';
    overlay.innerHTML = `
        <div id="cat-settings-modal">
            <button class="cat-settings-close">&times;</button>
            <h2 class="cat-settings-title">Salary Tracker</h2>
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
    `;
    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.classList.remove('show');
    };

    overlay.querySelector('.cat-settings-close').onclick = closeModal;
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal();
    };

    overlay.querySelector('#modalSaveBtn').onclick = () => {
        const newSalary = overlay.querySelector('#modalAnnualSalary').value;
        const newStartTime = overlay.querySelector('#modalStartTime').value;

        if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({
                annualSalary: newSalary || 100000,
                startTime: newStartTime || '09:00'
            }, () => {
                closeModal();
            });
        }
    };

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Content script received message:", request);
        if (request.action === "toggleSettings") {
            overlay.querySelector('#modalAnnualSalary').value = annualSalary;
            overlay.querySelector('#modalStartTime').value = workStartTime;
            overlay.classList.toggle('show');
        }
    });
})();
