# 🐾 Pet-in-browser: Desktop Pet & Salary Tracker

A lightweight, interactive browser extension that brings a draggable cat pet to any webpage, while simultaneously tracking your **real-time earnings** in a minimalist, premium interface.

---


https://github.com/user-attachments/assets/58c8fd2e-d177-436e-9bde-5ea274a752e4


## ✨ Features

### 😺 Interactive Desktop Pet
- **Randomized Animations**: Higher-quality WebM videos for smooth, lifelike pet behaviors.
- **Draggable**: Long-press to reposition the pet anywhere on your screen.
- **Micro-interactions**: Short-click to trigger randomized animations and visual feedback.

### 💰 Real-time Salary Tracker
- **Earnings Counter**: Watch your "Today's Earnings" tick up millisecond by millisecond based on your annual salary.
- **Premium Glassmorphism**: Floating earnings bubble with a modern transparent design (13px border-radius, subtle blur).
- **In-page Settings**: Access configuration directly on the webpage (no clunky popups) via a minimalist 16px rounded panel.

---

## 🚀 Getting Started

### 1. Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/juliannawang1215/Pet-in-browser.git
    ```
2.  **Open Chrome Extensions**:
    Go to `chrome://extensions/` in your browser.
3.  **Enable Developer Mode**:
    Toggle the switch in the top right corner.
4.  **Load Unpacked**:
    Click "Load unpacked" and select the root folder of this project.

### 2. Configuration
1.  Click the **Pet-in-browser** icon in your browser toolbar.
2.  A minimalist settings modal will appear directly in your current tab.
3.  Enter your **Annual Salary** and **Work Start Time** (e.g., 09:00).
4.  Click **Save Settings**.

---

## 🎨 Design Philosophy
Inspired by minimalist Apple-style aesthetics and modern glassmorphism.
- **Typography**: Inter / System Sans-serif hierarchy.
- **Color Palette**: Strict Black & White with subtle `rgba` transparency for depth.
- **Paddings**: Consistent 24px internal spacing and 16px corner radii.

---

## 🛠 Tech Stack
- **Core**: Manifest V3, JavaScript (ES6+)
- **Storage**: `chrome.storage.sync` for cross-tab persistence.
- **Animations**: `requestAnimationFrame` for high-performance, smooth counter updates.
- **Styling**: Vanilla CSS with hardware-accelerated transforms.

---

## 📄 License
MIT License. Feel free to customize and enjoy!
