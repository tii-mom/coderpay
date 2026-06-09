# CoderPay Android App

CoderPay Android App 是 CoderPay 的原生移动端，正式定位为“到账监听 + 轻量运营控制台”。App 绑定设备后使用设备 HMAC 身份访问云端，可完成到账通知监听、设备健康检查、余额充值、套餐订阅、收款码上传/管理、订单与异常查看等核心运营动作。

## 核心能力

- 通知监听：通过 `NotificationListenerService` 捕获微信/支付宝到账通知，并用本地幂等哈希防止重复上传。
- 断网补传：Room + WorkManager 缓存未上传事件，网络恢复后自动补传。
- 设备身份：使用一次性高熵 `deviceCode` 绑定设备，绑定成功后保存 `deviceSecret`，写接口统一使用 HMAC 头。
- 移动运营：支持充值、套餐订阅、收款码上传/创建/启停/删除、异常中心、设备密钥重置。
- 健康检查：展示通知权限、电池优化、心跳、最近事件与服务端兼容状态。

## 构建要求

- Android Studio 或 Gradle Wrapper
- JDK 17
- Android SDK 34

终端构建：

```bash
cd coderpay-android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ./gradlew assembleDebug
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ./gradlew assembleRelease
```

产物位置：

- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release unsigned: `app/build/outputs/apk/release/app-release-unsigned.apk`
- Release signed: `app/build/outputs/apk/release/app-release.apk`

## Release 签名

发布到真实用户前必须使用生产 keystore 签名。将 `keystore.properties` 放在 `coderpay-android/` 目录，文件已被 `.gitignore` 忽略：

```properties
storeFile=/absolute/path/to/coderpay-release.jks
storePassword=replace-with-secure-password
keyAlias=coderpay
keyPassword=replace-with-secure-password
```

生成 keystore 示例：

```bash
keytool -genkeypair -v \
  -keystore coderpay-release.jks \
  -alias coderpay \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

不要把 `keystore.properties`、`.jks` 或 `.keystore` 提交到仓库。

## 设备绑定

1. 在 Web 控制台创建设备，获得 `dev_` 开头的一次性高熵绑定码。
2. 打开 App，输入服务器地址和设备绑定码。
3. 绑定成功后，App 保存设备密钥并启动心跳和通知监听。
4. 绑定码过期或重置设备后，旧绑定码和旧密钥会失效，需要重新绑定。

移动端写操作必须由已绑定设备签名，云端不会向 App 返回 `appSecret`、用户密码或敏感 token。

## 手机权限与保活

- 通知读取权限必须开启，否则无法捕获微信/支付宝到账通知。
- 建议关闭电池优化，并在手机系统中允许后台运行、自启动和关联启动。
- 微信/支付宝通知必须显示具体内容；如果系统隐藏通知内容，App 无法解析金额。

## 上线验收

云端：

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Android：

```bash
cd coderpay-android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ./gradlew assembleDebug
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ./gradlew assembleRelease
```

真实链路至少需要覆盖：

- 微信固定金额码支付。
- 支付宝固定金额码支付。
- 通用码尾数微调支付。
- 余额充值后订阅套餐。
- 设备离线和恢复后的补传。
- 同设备同金额并发订单进入人工审核，不自动错配。
