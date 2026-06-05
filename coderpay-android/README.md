# Coder Pay Android Watcher (安卓到账监听客户端)

**Android CP Watcher** 是 Coder Pay 平台配套的安卓端到账监控程序。它通过监听系统级通知（微信/支付宝通知），在收到到账推送后，提取金额并秒级安全地上报给 Coder Pay 云端匹配引擎（`https://3api.shop`），完成商户订单的核销与 Webhook 回调通知。

---

## 🚀 核心功能特性

1. **常驻保活前台服务 (`ForegroundKeepAliveService`)**
   * 创建高优先级前台常驻通知通道，周期上报设备电量、网络类型、微信/支付宝监听探针状态。
2. **系统级通知监听器 (`NotificationService`)**
   * 采用 `NotificationListenerService` 实现高精度、低功耗的消息拦截。
   * 支持多语境及多场景正则解析微信支付/支付宝到账消息（如微信扫码、收钱码、个人转账等）。
3. **断网缓存与去重策略 (Room Database)**
   * 本地集成 SQLite (Room ORM) 数据库，计算到账事件唯一 MD5 幂等去重键，防止重复核销。
   * 当发生设备断网或网络波动时，数据自动入库缓存，待网络恢复后依靠 `WorkManager` 进行指数退避式异步补传，保障 100% 漏单防范。
4. **Jetpack Compose 现代终端 UI**
   * 云端配对：支持一键输入服务器 API 地址和配对的设备 token (`deviceCode`) 进行安全对接。
   * 权限体检：直观检测通知读取权限、电池优化白名单配置，一键调起系统系统级权限页。
   * 模拟激发：内置微信/支付宝本地 Mock 到账接口测试，方便开发者零金额快速完成全链路闭环演练。
   * 调试终端：滚动日志输出，监控数据上报与核销响应。

---

## 📦 如何导入并编译构建 (Build & Run)

本项目基于标准的 **Android Gradle** 规范构建，完美契合 **Android Studio** 开发工具。

### 1. 导入项目
1. 打开 **Android Studio**，选择 `File -> Open`。
2. 选择本地目录：`/Users/yudeyou/Desktop/coderpay-android` 导入。
3. Android Studio 会自动识别 `settings.gradle` 并根据本地 Gradle 配置自动下载 Gradle Wrapper 和对应的 SDK 环境 (Target SDK: 34, Min SDK: 26, Build Tooling Java 17)。

### 2. 编译并输出 APK
* **方法 A（Android Studio GUI）**：
  * 在顶部菜单栏点击 `Build -> Build Bundle(s) / APK(s) -> Build APK(s)`。
  * 编译成功后，点击右下角 Pop-up 提示中的 `locate`，即可找到编译生成的 `app-debug.apk`。
* **方法 B（终端命令行）**：
  * 确保本地已配置 `JAVA_HOME` 环境变量（推荐使用 JDK 17 及以上版本）。
  * 运行命令行：
    ```bash
    chmod +x gradlew
    ./gradlew assembleDebug
    ```
  * 产物生成在：`app/build/outputs/apk/debug/app-debug.apk`

---

## ⚙️ 手机运行及保活配置说明

为确保 Android Watcher 后台运行稳健、不漏单，请务必进行以下配置：

1. **授予通知栏读取权限**：
   * 打开 app，点击 **通知栏读取监听权限** 右侧的 **“需授权”** 按钮。
   * 在弹出的系统设置中找到 **CP Watcher**，开启“允许访问通知”开关。
2. **豁免省电模式/开启自启动**：
   * 点击 **电池省电限制忽略 (保活)** 右侧的 **“需设置”** 按钮，并在弹出提示中选择“允许”以忽略电池优化。
   * 建议在手机的系统设置里找到 CP Watcher，允许其 **后台自启动** 以及 **关联启动**。
3. **通知渠道设置**：
   * 确保微信和支付宝在系统设置中的通知管理已打开，且**通知内容必须处于“显示具体内容”状态**（如果是“内容已隐藏”或只显示“收到一条消息”，则无法捕获金额）。
   * 确保系统微信/支付宝开启了语音播报或横幅通知。

---

## 🧪 联调测试指南

1. 登录云收银控制台 [https://3api.shop](https://3api.shop)，注册/登录开发者账号。
2. 进入**设备通道/管理**页面，生成/获取对应的设备绑定码 `deviceCode`（例如：`dev-1001`）。
3. 启动手机上的 **CP Watcher**：
   * 输入服务器 URL: `https://3api.shop`
   * 输入设备绑定授权码: `dev-1001`
   * 点击 **“保存并连接探针”**。控制台日志滚动并显示 `绑定成功！已拉起后台常驻保活，心跳正常建立。`
4. 控制台查看该设备，应显示 `在线/活跃`。
5. **本地模拟核销**：
   * 在收银台创建一个 ¥0.01 的微信测试订单。
   * 在 CP Watcher 界面上，点击 **“测试微信 ¥0.01”**。
   * 观察手机控制台日志，将显示 `通知拦截` -> `正在上报` -> `核销成功` 闭环流程，同时云端收银台页面自动跳转完成。
