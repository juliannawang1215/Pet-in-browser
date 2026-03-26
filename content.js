(function() {
    console.log("🐱 Cat Extension is trying to load...");
    // 防止重复注入（比如页面刷新或单页应用切换路由）
    if (document.getElementById('floating-pet-container')) return;

    // 创建最外层容器（负责拖拽和定位）
    const petContainer = document.createElement('div');
    petContainer.id = 'floating-pet-container';
    
    // ==========================================
    // 💡【未来更换为 WebM 高清视频的教程】💡
    // 1. 把你的视频（例如 dog.webm）复制到这个 cat-extension 文件夹里
    // 2. 把下面 "USE_WEBM" 的值改为 true
    // 3. 把 "WEBM_FILENAME" 的值改为你的视频名字，比如 'dog.webm'
    // 4. 去浏览器的扩展页面刷新一下这个插件即可！
    // ==========================================
    const USE_WEBM = true; 
    const WEBM_FILES = ['video2.webm']; // 暂时只设置为新动作
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
        animatedVideoElement.src = chrome.runtime.getURL(WEBM_FILES[0]);
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
            pointer-events: none !important; /* 避免挡住拖拽事件 */
            display: block; /* 被行内样式覆盖 */
            background: transparent !important;
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

    petContainer.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    let animationTimer = null;

    function toggleAnimation() {
        if (isAnimating) return; // 如果正在播放动画，忽略多余点击
        isAnimating = true;
        
        if (USE_WEBM) {
            let randomWebm = WEBM_FILES[Math.floor(Math.random() * WEBM_FILES.length)];
            animatedVideoElement.src = chrome.runtime.getURL(randomWebm);
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
})();
