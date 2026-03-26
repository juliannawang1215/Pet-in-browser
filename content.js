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
    const USE_WEBM = false; 
    const WEBM_FILENAME = 'your_video.webm'; 
    const ANIMATED_IMAGE = 'cat_transparent.png'; // 动态图
    const STATIC_IMAGE = 'cat_static.png'; // 静止图

    let petElement;
    let isAnimating = false; // 当前是否在播放动画

    if (USE_WEBM) {
        // 创建 Video 视频元素
        petElement = document.createElement('video');
        petElement.src = chrome.runtime.getURL(WEBM_FILENAME);
        petElement.loop = true;
        petElement.muted = true; // 浏览器策略：静音才能自动播放
        petElement.playsInline = true;
        petElement.pause(); // 初始静止
    } else {
        // 创建 Img 图片元素 (默认显示静止图)
        petElement = document.createElement('img');
        petElement.src = chrome.runtime.getURL(STATIC_IMAGE);
    }

    petElement.id = 'floating-pet-media';
    
    petContainer.appendChild(petElement);
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

        #floating-pet-media {
            width: 100% !important;
            height: auto !important;
            pointer-events: none !important; /* 避免挡住拖拽事件 */
            display: block !important;
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
        
        if (USE_WEBM) {
            petElement.currentTime = 0; // 重置到第一帧
            petElement.play();
            
            clearTimeout(animationTimer);
            animationTimer = setTimeout(() => {
                petElement.pause();
                petElement.currentTime = 0;
            }, 5000);
        } else {
            isAnimating = true;
            let targetSrc = chrome.runtime.getURL(ANIMATED_IMAGE);
            // APNG cache bypass to force animation restart
            targetSrc += "?t=" + Date.now();
            petElement.src = targetSrc;
            
            // 动画长度大约是 5 秒 (121帧 / 24fps)
            clearTimeout(animationTimer);
            animationTimer = setTimeout(() => {
                isAnimating = false;
                petElement.src = chrome.runtime.getURL(STATIC_IMAGE);
            }, 5000);
        }
        
        // Add visual click feedback
        petContainer.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(0.95)`;
        setTimeout(() => {
            petContainer.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(1)`;
        }, 150);
    }

    function dragStart(e) {
        if (e.target === petContainer || e.target === petElement) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            clickStartX = e.clientX;
            clickStartY = e.clientY;
            isDragging = true;
            e.preventDefault(); // 阻止默认的文本/图片拖动行为
        }
    }

    function dragEnd(e) {
        if (!isDragging) return;
        
        let moveDistance = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
        if (moveDistance < 5) {
            toggleAnimation();
        }

        // Prevent currentX/Y from becoming undefined if it was just a click
        if (typeof currentX !== 'undefined') initialX = currentX;
        if (typeof currentY !== 'undefined') initialY = currentY;
        
        isDragging = false;
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, petContainer);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
})();
