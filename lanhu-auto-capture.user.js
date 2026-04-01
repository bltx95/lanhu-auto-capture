// ==UserScript==
// @name         蓝湖原型自动截图
// @namespace    http://tampermonkey.net/
// @version      0.9.8
// @description  自动展开所有折叠目录，精准提取多层级树状路径，完美命名
// @author       Gemini
// @match        *://*.lanhuapp.com/*
// @match        *://axure-file.lanhuapp.com/*
// @grant        none
// @require      https://cdn.bootcdn.net/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 🎭 角色二：摄影师 (Iframe 内部，保持高能容错)
    // ==========================================
    if (window.top !== window.self) {
        async function attemptCapture(target, scaleFactor) {
            console.log(`[Iframe摄影师] 尝试倍率: ${scaleFactor.toFixed(2)}`);
            const canvas = await html2canvas(target, {
                useCORS: true, allowTaint: false, scale: scaleFactor, backgroundColor: '#ffffff', imageTimeout: 10000
            });
            if (canvas.width === 0 || canvas.height === 0) throw new Error('画布尺寸为0');
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => { blob ? resolve(blob) : reject(new Error('Blob为Null')); }, 'image/png');
            });
        }

        window.addEventListener('message', async (event) => {
            if (event.data && event.data.action === 'GEMINI_CAPTURE_NOW') {
                window.parent.postMessage({ action: 'GEMINI_ACK' }, '*');
                try {
                    await new Promise(r => setTimeout(r, 1500));
                    const target = document.querySelector('.page') || document.querySelector('#base') || document.body;
                    let targetW = target.scrollWidth, targetH = target.scrollHeight;
                    if (target.offsetHeight === 0) target.style.height = targetH + 'px';
                    if (target.offsetWidth === 0) target.style.width = targetW + 'px';

                    let currentScale = 1;
                    const MAX_LIMIT = 8000;
                    if (targetW > MAX_LIMIT || targetH > MAX_LIMIT) {
                        currentScale = MAX_LIMIT / Math.max(targetW, targetH);
                    }

                    let finalBlob = null, attempts = 0;
                    while (!finalBlob && attempts < 3) {
                        try {
                            finalBlob = await attemptCapture(target, currentScale);
                        } catch (e) {
                            currentScale *= 0.6; attempts++;
                        }
                    }
                    if (!finalBlob) throw new Error('多次重试仍失败');

                    const url = URL.createObjectURL(finalBlob);
                    const link = document.createElement('a');
                    link.download = event.data.fileName;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    window.parent.postMessage({ action: 'GEMINI_CAPTURE_DONE' }, '*');
                } catch (err) {
                    window.parent.postMessage({ action: 'GEMINI_CAPTURE_ERROR' }, '*');
                }
            }
        });
        return;
    }

    // ==========================================
    // 👑 角色一：指挥官 (主页面，强化目录解析)
    // ==========================================
    let isRunning = false;
    const PANEL_ID = 'gemini-lanhu-capture-panel';
    let delayValue = 3000;
    let captureStatus = 'pending';
    let captureResolve = null;

    window.addEventListener('message', (event) => {
        if (event.data.action === 'GEMINI_ACK') captureStatus = 'acked';
        else if (event.data.action === 'GEMINI_CAPTURE_DONE') { if (captureResolve) captureResolve(true); }
        else if (event.data.action === 'GEMINI_CAPTURE_ERROR') { if (captureResolve) captureResolve(false); }
    });

    function robustClick(element) {
        ['mousedown', 'mouseup', 'click'].forEach(type => {
            element.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, buttons: 1 }));
        });
    }

    // 自动展开所有折叠的目录
    async function expandAllFolders() {
        let collapsedIcons = document.querySelectorAll('.lan-icon.expand-icon.spin-right');
        let attempts = 0;
        // 循环点击，直到没有向右的箭头（说明全展开了），最多防死循环10次
        while (collapsedIcons.length > 0 && attempts < 10) {
            for (let icon of collapsedIcons) {
                robustClick(icon);
                await new Promise(r => setTimeout(r, 100)); // 等待展开动画
            }
            collapsedIcons = document.querySelectorAll('.lan-icon.expand-icon.spin-right');
            attempts++;
        }
    }

    async function startCapture() {
        isRunning = true;
        updateUIState();
        const statusInfo = document.getElementById('gemini-lanhu-status');

        // 1. 第一步：强行展开所有层级，确保所有页面都在 DOM 中出现
        if (statusInfo) statusInfo.innerText = '正在自动展开所有目录...';
        await expandAllFolders();

        // 2. 第二步：获取全部树节点
        const allItems = Array.from(document.querySelectorAll('.lan-tree-list-item'));
        if (allItems.length === 0) {
            alert('未检测到目录节点！');
            isRunning = false; updateUIState(); return;
        }

        let pathStack = [];
        let pageCounter = 1; // 专门用于记录真实页面的序号

        for (let i = 0; i < allItems.length; i++) {
            if (!isRunning) break;
            const item = allItems[i];

            // 提取深度 (deepD-0, deepD-1...)
            const depthMatch = item.className.match(/deepD-(\d+)/);
            const currentDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

            // 提取名称
            const nameEl = item.querySelector('.tree-name');
            const itemName = nameEl ? nameEl.innerText.trim() : '未命名';

            // 更新路径栈：把当前深度及其之后的数据截断，压入新名称
            pathStack[currentDepth] = itemName;
            pathStack.length = currentDepth + 1;

            // 终极识别：如果包含 .has-children 或者有 folder 图标，就是文件夹
            const isFolder = item.querySelector('.has-children') ||
                             item.querySelector('.icon-folder') ||
                             item.querySelector('img[alt="folder"]');

            if (isFolder) {
                console.log(`[已进入目录] ${pathStack.join('-')}`);
                continue; // 是文件夹，仅记录路径，不截图
            }

            // --- 下面全是处理真实页面的逻辑 ---
            const fullPathStr = pathStack.join('-');
            const safePathName = fullPathStr.replace(/[\\/:*?"<>|]/g, '_');

            // 找到可以点击的包裹层
            const nodeToClick = item.querySelector('.tree-item-wrapper') || item;

            nodeToClick.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nodeToClick.style.outline = '2px solid red';
            robustClick(nodeToClick);

            if(statusInfo) statusInfo.innerText = `处理: ${safePathName}`;
            await new Promise(r => setTimeout(r, delayValue)); // 等待页面和Iframe加载

            captureStatus = 'pending';
            // 序号使用 pageCounter 而不是 i
            const fileName = `${String(pageCounter).padStart(3, '0')}_${safePathName}.png`;

            // 轮询呼叫摄影师
            const pollTimer = setInterval(() => {
                if (captureStatus !== 'pending') { clearInterval(pollTimer); return; }
                const iframe = document.getElementById('lan-mapping-iframe');
                if (iframe?.contentWindow) {
                    iframe.contentWindow.postMessage({ action: 'GEMINI_CAPTURE_NOW', fileName: fileName }, '*');
                }
            }, 1000);

            // 45秒超时兜底
            const success = await new Promise((resolve) => {
                captureResolve = resolve;
                setTimeout(() => { clearInterval(pollTimer); if (captureStatus !== 'done') resolve(false); }, 45000);
            });

            nodeToClick.style.outline = 'none';
            if (success) pageCounter++; // 成功后序号+1
            await new Promise(r => setTimeout(r, 1500));
        }

        isRunning = false;
        updateUIState();
        alert('🎉 页面全量截图完成！');
    }

    // UI 构建逻辑
    function updateUIState() {
        const startBtn = document.getElementById('gemini-lanhu-start');
        const stopBtn = document.getElementById('gemini-lanhu-stop');
        if(startBtn) startBtn.style.display = isRunning ? 'none' : 'block';
        if(stopBtn) stopBtn.style.display = isRunning ? 'block' : 'none';
    }

    function injectUI() {
        if (document.getElementById(PANEL_ID) || window.top !== window.self) return;
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style = 'position:fixed;bottom:40px;right:40px;z-index:2147483647;display:flex;flex-direction:column;gap:10px;padding:15px;background:#fff;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.3);border:1px solid #ddd;min-width:180px;';
        panel.innerHTML = `
            <button id="gemini-lanhu-start" style="padding:10px;background:#2d8cf0;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">🚀 启动智能深钻截图</button>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:#666;">
                <div style="display:flex;justify-content:space-between;"><span>加载等待:</span><span id="gemini-lanhu-delay-val" style="font-weight:bold;color:#2d8cf0;">3.0秒</span></div>
                <input id="gemini-lanhu-delay-slider" type="range" min="1" max="10" value="3" style="width:100%;">
            </div>
            <button id="gemini-lanhu-stop" style="padding:10px;background:#ff4d4f;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;display:none;">🛑 停止</button>
            <div id="gemini-lanhu-status" style="font-size:12px;color:#666;text-align:center;margin-top:5px;">状态: 待命</div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('#gemini-lanhu-delay-slider').oninput = function() {
            delayValue = this.value * 1000;
            document.getElementById('gemini-lanhu-delay-val').innerText = this.value + '.0秒';
        };
        panel.querySelector('#gemini-lanhu-start').onclick = startCapture;
        panel.querySelector('#gemini-lanhu-stop').onclick = () => isRunning = false;
    }

    setInterval(injectUI, 1000);
})();
