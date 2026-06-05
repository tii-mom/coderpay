# Coder Pay

Coder Pay 是一款面向独立开发者的微信/支付宝个人免签自动收款系统，由 **Web/云端系统** 与 **Android CP Watcher** 共同构成。

## 核心架构

1. **Web / 云端系统 (CP Cloud)**: 负责应用管理、密钥分发、收款码调度、订单管理、设备在线状态监控、到账匹配引擎以及异步 Webhook 回调推送。
2. **Android CP Watcher**: 挂机监控端，负责利用系统通知监听机制（NotificationListenerService）读取微信/支付宝支付成功通知，结构化提取金额后实时上报给云端匹配引擎。

## 本地开发指南

### 前端/控制台原型预览

本项目当前为 Coder Pay 前端控制台高保真交互原型，采用 Next.js + React + TailwindCSS 构建。

1. **安装依赖**：
   ```bash
   npm install
   ```

2. **运行开发服务器**：
   ```bash
   npm run dev
   ```
   打开 [http://localhost:3000](http://localhost:3000) 即可预览控制台界面。

### 生产部署（前端容器化）

本项目已开启 Next.js `standalone` 独立输出，适合容器化部署：
```bash
npm run build
```
编译后将生成 `.next/standalone` 目录。
