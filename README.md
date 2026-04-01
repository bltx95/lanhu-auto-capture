# 🚀 Lanhu Auto Capture (蓝湖原型自动导出工具)

![Version](https://img.shields.io/badge/version-0.9.8-blue)
![License](https://img.shields.io/badge/license-MIT-green)

一个强大的 Tampermonkey (篡改猴) 浏览器用户脚本，用于全自动遍历并批量导出蓝湖 (Lanhu) / Axure 项目的高清原型设计图。

解放双手，告别“点一页、截一张、重命名”的机械劳动！

## ✨ 核心特性 / Features

- **🤖 自动深度遍历**：自动展开左侧所有折叠目录，精准识别“文件夹”与“页面”。
- **📂 智能路径命名**：抛弃无意义的流水号，自动将文件命名为完整的树形层级路径（如 `005_日常行为评价-页面1.png`）。
- **🛡️ 跨域 Iframe 穿透**：完美解决蓝湖嵌套 Axure 原型导致的 `html2canvas` 截图白屏问题。
- **💥 超大图防爆机制**：针对几万像素长的“业务泳道图 / 链路图”，内置自动降级压缩与多次抢救重试逻辑，解决 `Blob Null` 与浏览器显存溢出崩溃问题。
- **⏱️ 可视化控制台**：右下角常驻悬浮面板，实时显示抓取进度，支持动态调节渲染等待时间。

## 🛠️ 安装说明 / Installation

1. 确保你的浏览器已安装 [Tampermonkey (篡改猴)](https://www.tampermonkey.net/) 插件。
2. 点击下方链接一键安装脚本：
   👉 **[点击这里安装脚本](https://raw.githubusercontent.com/bltx95/lanhu-auto-capture/main/lanhu-auto-capture.user.js)** *(注：推到GitHub后替换此链接)*

## 📖 使用方法 / Usage

1. 打开任意一个蓝湖的项目页面（例如：`https://lanhuapp.com/web/...`）。
2. 等待页面加载完成，右下角会自动出现 **“🚀 启动智能深钻截图”** 的控制面板。
3. **关键提醒**：开始前，请确保浏览器的缩放比例为 **100%**。
4. 根据你项目的加载速度和图纸大小，调节面板中的“加载等待”时间（默认为 3 秒，如果原型图非常庞大，建议调至 5 秒以上）。
5. 点击**启动按钮**，双手离开键盘，享受自动化！

> **⚠️ 注意事项**：由于脚本会连续触发下载，浏览器顶部可能会弹出“该网站尝试下载多个文件”的权限提示，请务必点击 **始终允许 (Allow)**。

## 🧩 技术原理解析

由于蓝湖采用了复杂的单页应用 (SPA) 架构，且常通过不同域名 (如 `axure-file.lanhuapp.com`) 的 `iframe` 承载核心原型文件，传统的截图脚本往往会遭遇同源策略 (CORS) 拦截导致白屏。

本项目采用 **双端通讯注入架构 (Dual-Injection with postMessage)**：
- **主页面 (指挥官)**：负责操作 DOM 树，模拟真人进行深层点击展开、计算层级路径，并通过轮询向 iframe 发送 Action 指令。
- **Iframe (摄影师)**：突破 CORS 限制在沙盒内部渲染 Canvas，处理冗长泳道图导致的内存溢出，并将图片转换为二进制 Blob 流直接触发内部下载。

## 🤝 贡献 / Contributing

欢迎提交 Issue 或 Pull Request 来完善这个脚本！如果这个项目帮你节省了下班的时间，欢迎给个 ⭐️ Star！

## 📄 协议 / License

[MIT License](LICENSE) © bltx95
