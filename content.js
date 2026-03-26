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
    const IMAGE_FILENAME = 'cat_transparent.png'; // 现在的透明图片

    let petElement;

    if (USE_WEBM) {
        // 创建 Video 视频元素
        petElement = document.createElement('video');
        petElement.src = chrome.runtime.getURL(WEBM_FILENAME);
        petElement.autoplay = true;
        petElement.loop = true;
        petElement.muted = true; // 浏览器策略：静音才能自动播放
        petElement.playsInline = true;
    } else {
        // 创建 Img 图片元素 (当前使用)
        petElement = document.createElement('img');
        petElement.src = chrome.runtime.getURL(IMAGE_FILENAME);
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
    // 拖拽逻辑
    // ==========================================
    let isDragging = false;
    let initialX, initialY, currentX, currentY;
    let xOffset = 0, yOffset = 0;

    petContainer.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    function dragStart(e) {
        if (e.target === petContainer || e.target === petElement) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            e.preventDefault(); // 阻止默认的文本/图片拖动行为
        }
    }

    function dragEnd() {
        if (!isDragging) return;
        initialX = currentX;
        initialY = currentY;
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
