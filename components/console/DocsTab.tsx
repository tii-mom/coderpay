'use client';

import React, { useState } from 'react';
import { App } from '@/types';
import { 
  Code, 
  Terminal, 
  Copy, 
  Play, 
  Settings, 
  ShieldAlert, 
  ArrowRight,
  Smartphone,
  Globe,
  Database
} from 'lucide-react';

interface DocsTabProps {
  apps: App[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function DocsTab({ apps, onTriggerToast, db }: DocsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'query' | 'callback' | 'sign'>('create');

  // Interactive Sandbox state fields
  const [sandboxAppId, setSandboxAppId] = useState(apps[0]?.appId || 'your_app_id');
  const [sandboxAmount, setSandboxAmount] = useState('10.00');
  const [sandboxTitle, setSandboxTitle] = useState('标准会员季度订阅服务');
  const [sandboxPayType, setSandboxPayType] = useState<'wechat' | 'alipay'>('wechat');
  const [isRunningCheckup, setIsRunningCheckup] = useState(false);
  const [checkupResult, setCheckupResult] = useState<{
    summary: { pass: number; warn: number; fail: number };
    checks: Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }>;
  } | null>(null);
  const [isPingingWebhook, setIsPingingWebhook] = useState(false);
  const [webhookPingResult, setWebhookPingResult] = useState<{
    ok: boolean;
    statusCode: number | null;
    responseSummary: string;
    responseBodyPreview: string;
    durationMs: number;
    completedAt: string;
  } | null>(null);

  const selectedApp = apps.find(a => a.appId === sandboxAppId) || apps[0];

  const handleCopyText = (text: string, desc: string) => {
    navigator.clipboard.writeText(text);
    onTriggerToast(`成功复制 ${desc} 到剪贴板！`, 'success');
  };

  const handleRunSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apps.length === 0) {
      onTriggerToast('请先在 [应用管理] 中创建至少一个收款应用才可联调沙箱测试！', 'error');
      return;
    }

    const o = await db.createOrder({
      outOrderNo: `SANDBOX_${Date.now().toString().slice(-6)}`,
      appId: selectedApp.appId,
      title: sandboxTitle,
      payType: sandboxPayType,
      amount: Number(sandboxAmount)
    });

    if (!o?.id) {
      onTriggerToast(o?.error || '联调订单创建失败，请确认应用下已有可用收款码。', 'error');
      return;
    }

    onTriggerToast(`联调订单 ${o.id} 通道创建成功！正在为您向浏览器新窗口推送用户款台测试面...`, 'success');
    
    setTimeout(() => {
      window.open(`/pay/${o.id}`, '_blank');
    }, 1200);
  };

  const handleRunCheckup = async () => {
    setIsRunningCheckup(true);
    try {
      const res = await fetch('/api/integration/checkup');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '接入体检失败');
      setCheckupResult(data);
      const type = data.summary.fail > 0 ? 'error' : data.summary.warn > 0 ? 'warning' : 'success';
      onTriggerToast(`接入体检完成：通过 ${data.summary.pass}，警告 ${data.summary.warn}，阻塞 ${data.summary.fail}`, type);
    } catch (err: any) {
      onTriggerToast(err.message || '接入体检失败，请稍后重试。', 'error');
    } finally {
      setIsRunningCheckup(false);
    }
  };

  const handleWebhookPing = async () => {
    if (!selectedApp?.appId) {
      onTriggerToast('请先创建并选择一个应用。', 'error');
      return;
    }

    setIsPingingWebhook(true);
    try {
      const res = await fetch('/api/integration/webhook-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: selectedApp.appId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Webhook 测试失败');
      setWebhookPingResult(data);
      onTriggerToast(
        data.ok ? 'Webhook URL 已返回 success。' : `Webhook URL 未按规范返回 success：${data.responseSummary}`,
        data.ok ? 'success' : 'warning'
      );
    } catch (err: any) {
      onTriggerToast(err.message || 'Webhook 测试失败，请稍后重试。', 'error');
    } finally {
      setIsPingingWebhook(false);
    }
  };

  const [sdkLanguage, setSdkLanguage] = useState<'nodejs' | 'python' | 'go' | 'php'>('nodejs');

  // Code snippets generator based on active configuration
  const curAppId = selectedApp?.appId || 'CP_APP_ID_A38G90B';
  const curSecret = 'YOUR_APP_SECRET';
  
  // Resolve current host dynamically in browser, default to 3api.shop
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://3api.shop';

  const curlCreateOrder = `curl -X POST ${currentOrigin}/api/order/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "app_id": "${curAppId}",
    "out_order_no": "TEST_ORDER_100234",
    "title": "${sandboxTitle}",
    "amount": ${sandboxAmount},
    "pay_type": "${sandboxPayType}",
    "sign": "c20df843c08969f6cd9ab6b998cfb5e2be10cbfb2752cf3a772da061e8cbf5e2"
  }'`;

  const nodejsPayloadString = `import axios from 'axios';
import crypto from 'crypto';

// 1. 整理业务参数
const params = {
  app_id: "${curAppId}",
  out_order_no: "ORDER_920194839",
  title: "${sandboxTitle}",
  amount: "${sandboxAmount}",
  pay_type: "${sandboxPayType}"
};

// 2. 升序排列并生成待签名字符串
const sortedKeys = Object.keys(params).sort();
let queryStr = sortedKeys.map(k => \`\${k}=\${params[k]}\`).join('&');

// 3. 追加 App Secret 后计算 HMAC-SHA256 签名哈希值
const stringToSign = queryStr + '&key=${curSecret}';
const sign = crypto.createHmac('sha256', '${curSecret}')
                   .update(stringToSign)
                   .digest('hex');

// 4. 发起接口调用
axios.post('${currentOrigin}/api/order/create', { ...params, sign })
  .then(res => {
    console.log("支付收银台定向地址:", res.data.data.payment_url);
  });`;

  const pythonPayloadString = `import requests
import hashlib
import hmac

# 1. 整理业务参数
params = {
    "app_id": "${curAppId}",
    "out_order_no": "ORDER_920194839",
    "title": "${sandboxTitle}",
    "amount": "${sandboxAmount}",
    "pay_type": "${sandboxPayType}",
}

# 2. 升序排列并生成待签名字符串
sorted_keys = sorted(params.keys())
query_str = "&".join([f"{k}={params[k]}" for k in sorted_keys])

# 3. 追加 App Secret 后计算 SHA256 签名哈希值
string_to_sign = f"{query_str}&key=${curSecret}"
sign = hmac.new(
    "${curSecret}".encode("utf-8"),
    string_to_sign.encode("utf-8"),
    hashlib.sha256
).hexdigest()

# 4. 发起接口调用
payload = {**params, "sign": sign}
response = requests.post("${currentOrigin}/api/order/create", json=payload)
print("支付收银台定向地址:", response.json()["data"]["payment_url"])`;

  const goPayloadString = `package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
)

func main() {
	appId := "${curAppId}"
	appSecret := "${curSecret}"
	origin := "${currentOrigin}"

	params := map[string]string{
		"app_id":       appId,
		"out_order_no": "ORDER_920194839",
		"title":        "${sandboxTitle}",
		"amount":       "${sandboxAmount}",
		"pay_type":      "${sandboxPayType}",
	}

	var keys []string
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var queryStr string
	for i, k := range keys {
		if i > 0 {
			queryStr += "&"
		}
		queryStr += fmt.Sprintf("%s=%s", k, params[k])
	}
	stringToSign := queryStr + "&key=" + appSecret

	h := hmac.New(sha256.New, []byte(appSecret))
	h.Write([]byte(stringToSign))
	sign := hex.EncodeToString(h.Sum(nil))

	payload := make(map[string]interface{})
	for k, v := range params {
		payload[k] = v
	}
	payload["sign"] = sign

	jsonBody, _ := json.Marshal(payload)
	resp, _ := http.Post(origin+"/api/order/create", "application/json", bytes.NewBuffer(jsonBody))
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	fmt.Println("Payment URL:", result["data"].(map[string]interface{})["payment_url"])
}`;

  const phpPayloadString = `<?php
$appSecret = '${curSecret}';
$origin = '${currentOrigin}';

$params = [
    'app_id' => '${curAppId}',
    'out_order_no' => 'ORDER_920194839',
    'title' => '${sandboxTitle}',
    'amount' => '${sandboxAmount}',
    'pay_type' => '${sandboxPayType}',
];

ksort($params);
$queryParts = [];
foreach ($params as $k => $v) {
    $queryParts[] = "$k=$v";
}
$queryStr = implode('&', $queryParts);
$stringToSign = $queryStr . '&key=' . $appSecret;

$sign = hash_hmac('sha256', $stringToSign, $appSecret);
$params['sign'] = $sign;

$ch = curl_init("$origin/api/order/create");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
$data = json_decode($response, true);
echo "支付收银台定向地址: " . $data['data']['payment_url'];
?>`;

  const getActivePayloadString = () => {
    switch (sdkLanguage) {
      case 'python': return pythonPayloadString;
      case 'go': return goPayloadString;
      case 'php': return phpPayloadString;
      default: return nodejsPayloadString;
    }
  };

  const getLanguageLabel = () => {
    switch (sdkLanguage) {
      case 'python': return 'Python 签名及发单示例';
      case 'go': return 'Go 签名及发单示例';
      case 'php': return 'PHP 签名及发单示例';
      default: return 'Node.js (TypeScript) 签名及发单示例';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in" id="docs-tab-panel">
      {/* Top Banner Notice */}
      <div className="bg-[#0B1020] border border-[rgba(255,255,255,0.06)] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
        <div>
          <span className="font-bold text-white block">这是“登录后联调工作台”</span>
          <span className="text-slate-400 block mt-1">用于结合当前 App 做沙箱调试与接入体检。</span>
        </div>
        <a 
          href="/docs" 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] flex items-center gap-1.5"
        >
          查看完整公开文档 <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left">
        
        {/* Left Column: API documentation specs */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* API Sub Selector menu tabs */}
          <div className="flex gap-1.5 bg-[#0B1020]/60 border border-[rgba(255,255,255,0.06)] p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('create')}
              className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'create' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              1. 创建支付订单 API
            </button>
            <button
              onClick={() => setActiveSubTab('query')}
              className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'query' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              2. 查询订单状态 API
            </button>
            <button
              onClick={() => setActiveSubTab('callback')}
              className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'callback' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Webhook 到账回调
            </button>
            <button
              onClick={() => setActiveSubTab('sign')}
              className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'sign' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              签名鉴权算法
            </button>
          </div>

          {/* Content segments */}
          {activeSubTab === 'create' && (
            <div className="bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-4 text-xs font-sans leading-relaxed text-slate-300">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 pb-2.5 border-b border-[rgba(255,255,255,0.04)]">
                <Database className="w-4.5 h-4.5 text-blue-400" />
                创建免签收银订单 API 端点: <code>/api/order/create</code>
              </h3>

              <p>
                在您的自建商城/打赏主站中，当买家确定下单并点击【聚合扫码支付】瞬间，您的 Web 服务器需向 CP 宿主系统发出此 POST 参数请求。CP 将实时微调分派订单价、挂机锁定个人收款通道，并返回一个收银付款台定向 URL（<code>payment_url</code>）。您应将买家重定向导流向该地址扫码。
              </p>

              <span className="font-bold text-slate-200 mt-2">HTTP POST 请求负载关键字段：</span>
              <div className="grid grid-cols-3 gap-3 border border-[rgba(255,255,255,0.04)] bg-[#0B1020]/20 p-3 rounded-xl font-mono text-[11px]">
                <div><strong className="text-slate-100">app_id</strong><span className="text-[10px] text-slate-500 block">Required string</span></div>
                <div className="col-span-2 text-slate-300">您的 Coder Pay 接入端 APP 开发者商户凭据唯一序列号</div>

                <div><strong className="text-slate-100">out_order_no</strong><span className="text-[10px] text-slate-500 block">Required string</span></div>
                <div className="col-span-2 text-slate-300">您本地业务库中该订单主键 ID，须具有全局唯一性</div>

                <div><strong className="text-slate-100">amount</strong><span className="text-[10px] text-slate-500 block">Required decimal</span></div>
                <div className="col-span-2 text-slate-300">标定应付实物总额，精确至两位小数，例如：19.90</div>

                <div><strong className="text-slate-100">pay_type</strong><span className="text-[10px] text-slate-500 block">Required enum</span></div>
                <div className="col-span-2 text-slate-300">支付核对通道类型：<code>wechat</code> (微信扫码) 或 <code>alipay</code> (支付宝扫码)</div>
              </div>

              {/* SDK Language Tabs */}
              <div className="flex gap-1 bg-[#0B1020] p-1 rounded-lg border border-[rgba(255,255,255,0.04)] mt-3">
                {(['nodejs', 'python', 'go', 'php'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSdkLanguage(lang)}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                      sdkLanguage === lang ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'nodejs' ? 'Node.js' : lang === 'python' ? 'Python' : lang === 'go' ? 'Go' : 'PHP'}
                  </button>
                ))}
              </div>

              {/* Code sample block wrapper */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{getLanguageLabel()}</span>
                  <button 
                    onClick={() => handleCopyText(getActivePayloadString(), '发单集成代码段')}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold"
                  >
                    <Copy className="w-3.5 h-3.5" /> 复制模块
                  </button>
                </div>
                <pre className="bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-4 rounded-xl text-[10px] text-zinc-300 font-mono overflow-auto max-h-72 whitespace-pre leading-relaxed select-all">
                  {getActivePayloadString()}
                </pre>
              </div>

            </div>
          )}

          {activeSubTab === 'query' && (
            <div className="bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-4 text-xs font-sans leading-relaxed text-slate-300">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 pb-2.5 border-b border-[rgba(255,255,255,0.04)]">
                <Database className="w-4.5 h-4.5 text-blue-400" />
                查询支付订单到账状态: <code>/api/order/query</code>
              </h3>

              <p>
                同步页面跳转可能由于意外的网络刷新而被阻断。我们强烈提倡在您收发货完成前，由您的服务器或者前端以 POST 形式，调拨此状态查询接口以确认交易核销情况。
              </p>

              <span className="font-bold text-slate-200 mt-2">HTTP POST 查询参数:</span>
              <div className="grid grid-cols-4 gap-3 bg-[#0B1020]/20 p-3 rounded-xl font-mono text-[11px] border border-[rgba(255,255,255,0.04)]">
                <div><strong className="text-slate-100">app_id</strong></div>
                <div className="col-span-3 text-slate-400">开发者商户凭据唯一序列号</div>

                <div><strong className="text-slate-100">order_id</strong></div>
                <div className="col-span-3 text-slate-400">CP 系统返回的收款交易流水单号（或传 <code>out_order_no</code> 兼容匹配）</div>

                <div><strong className="text-slate-105">sign</strong></div>
                <div className="col-span-3 text-slate-400">参数排序签名。防伪鉴权校验专用</div>
              </div>

              <span className="font-bold text-slate-200 mt-2">状态 JSON 输出值响应：</span>
              <pre className="bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-4 rounded-xl text-[10px] text-emerald-400 font-mono overflow-auto whitespace-pre leading-relaxed">
{`{
  "code": 200,
  "msg": "success",
  "data": {
    "order_id": "CP2026060519302213",
    "out_order_no": "TEST_ORDER_100234",
    "status": "success", // 交易核销成功。其可能值为: new | pending | success | expired
    "amount": "10.00",
    "real_amount": "9.98", // 客户扫码实际成交额
    "pay_time": "2026-06-05 19:33:14"
  }
}`}
              </pre>
            </div>
          )}

          {activeSubTab === 'callback' && (
            <div className="bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-4 text-xs font-sans leading-relaxed text-slate-300">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 pb-2.5 border-b border-[rgba(255,255,255,0.04)]">
                <Database className="w-4.5 h-4.5 text-blue-400" />
                Webhook 异步发货通知规范 (notify_url)
              </h3>

              <p>
                一旦安装了 <b>CoderPay App</b> 的 Android 设备监听到微信/支付宝收款到达，CP 核心云将在 500ms 内触发对您预留 <code>notify_url</code> 的异步 POST 签名回调网络推送。
              </p>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200">
                <b>回调核销响应规范：</b>当您的业务系统验证签名无误，并充值或发货处理完毕后，请务必向该 HTTP Response 输出文本 <b>&quot;success&quot;</b> (全英文小写无空格)。一旦收到非 success 串（或超时），CP 会判定推送失败。失败会记录异常，可在控制台手动重试；自动重试队列将在后续版本提供。
              </div>

              <span className="font-bold text-slate-200 mt-2">回调发载 Payload 参考（POST Application/JSON）：</span>
            <pre className="bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-4 rounded-xl text-[10px] text-blue-300 font-mono overflow-auto whitespace-pre leading-relaxed">
{`{
  "app_id": "${curAppId}",
  "order_id": "CP2026060519302213",
  "out_order_no": "TEST_ORDER_100234",
  "pay_type": "${sandboxPayType}",
  "amount": "${sandboxAmount}",
  "real_amount": "${Number(sandboxAmount) - 0.02}", 
  "pay_time": "2026-06-05 19:33:14",
  "sign": "f3b392b95c9ec28120b601f0faedee10bf23bf0450682" // 判定真实合法，必须在回调接收端依据 App Secret 重新算签对齐
}`}
            </pre>
          </div>
        )}

        {activeSubTab === 'sign' && (
          <div className="bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-4 text-xs font-sans leading-relaxed text-slate-300">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 pb-2.5 border-b border-[rgba(255,255,255,0.04)]">
              <Database className="w-4.5 h-4.5 text-blue-400" />
              HMAC-SHA256 / MD5 签名校验规则
            </h3>

            <p>
              为防篡改、伪造，进出 CP 的所有参数流都应进行对位哈希签名。规则极其简单，遵循经典的微信支付与支付宝签名范式：
            </p>

            <ol className="list-decimal pl-4.5 flex flex-col gap-2 mt-1">
              <li>
                <b>待签参数升序排列:</b> 剔除 <code>sign</code> 参数本身，将剩余其余 POST 请求参数的 Key 按照 ASCII 字典进行升序自然排列。
              </li>
              <li>
                <b>组装 Query 串:</b> 将升序排好的参数键值按 <code>key1=val1&key2=val2...</code> 的形式用 <code>&</code> 相链条。
              </li>
              <li>
                <b>追加密钥并计算哈希:</b> 在最后的连缀串后强行连加您的专属安全密钥：<code>&key=您的App_Secret</code>。计算一串 HMAC-SHA256 或大写/小写 MD5 值。注入 sign 参数包中。
              </li>
            </ol>

            <span className="font-bold text-slate-200 mt-2">开发者接口安全盾牌承诺：</span>
            <p className="text-[10px] text-slate-500">
              请切勿在前端任何 React / JS 端代码中存放和暴露您的 <code>App Secret</code> 密钥！如有在客户端算算签行为存在，会造成黑客反套取私产。所有签名核对行为应统统置放在独立闭合的应用中转服务器内部实现操作。
            </p>
          </div>
        )}

      </div>

      {/* Right Column: Dynamic interactive sandbox playground debugger! */}
      <div className="lg:col-span-5 bg-cp-card border border-cp rounded-2xl p-5.5 flex flex-col gap-5 text-left text-xs sticky top-4">
        
        <div className="border-b border-[rgba(255,255,255,0.06)] pb-3">
          <span className="text-xs font-bold text-white block">CP 通道沙箱调试器</span>
          <span className="text-[10px] text-slate-500 block mt-1">用于验证发单、收银台和回调链路；真实付款请使用小额订单测试</span>
        </div>

        {apps.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-[#0B1020]/40 border border-amber-500/10 text-slate-400 flex flex-col items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
            <span className="font-bold text-slate-300">没有发现可用收款应用</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              请先在 [应用管理] 页创建第一个渠道 App 节点，然后就可以直接在此执行沙箱支付联调。
            </p>
          </div>
        ) : (
          <form onSubmit={handleRunSandbox} className="flex flex-col gap-4 font-sans text-xs">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">选择联调的目标应用容器</label>
              <select
                value={sandboxAppId}
                onChange={(e) => setSandboxAppId(e.target.value)}
                className="px-3 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-200"
              >
                {apps.map(a => (
                  <option key={a.id} value={a.appId}>{a.name} ({a.signType})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">沙箱商品单价 (元)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  max="10000"
                  value={sandboxAmount}
                  onChange={(e) => setSandboxAmount(e.target.value)}
                  className="px-3.5 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-200 font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">选择沙箱扫码渠道</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSandboxPayType('wechat')}
                    className={`py-2 px-2.5 border rounded-xl text-[10px] font-bold transition-all ${
                      sandboxPayType === 'wechat'
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-400'
                        : 'bg-[#0B1020] border-slate-800 text-slate-500'
                    }`}
                  >
                    微信支付
                  </button>
                  <button
                    type="button"
                    onClick={() => setSandboxPayType('alipay')}
                    className={`py-2 px-2.5 border rounded-xl text-[10px] font-bold transition-all ${
                      sandboxPayType === 'alipay'
                        ? 'bg-blue-950/40 border-blue-500/60 text-blue-400'
                        : 'bg-[#0B1020] border-slate-800 text-slate-500'
                    }`}
                  >
                    支付宝
                  </button>
                </div>
              </div>

            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">预设联调商品名称</label>
              <input
                type="text"
                value={sandboxTitle}
                onChange={(e) => setSandboxTitle(e.target.value)}
                className="px-3.5 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-200"
                required
              />
            </div>

            {/* Simulated request CLI viewer snippet */}
            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500">CP 云端联调请求抓包（实时拼折 cURL 脚本）</span>
              <pre className="bg-[#0B1020] border border-[rgba(255,255,255,0.04)] p-3 rounded-xl text-[9px] font-mono whitespace-normal text-slate-400 leading-normal select-all">
                {curlCreateOrder}
              </pre>
            </div>

            <button
              type="submit"
              className="mt-3.5 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md flex items-center justify-center gap-1.5 text-xs sm:text-sm"
            >
              <Play className="w-4 h-4 fill-white text-white" /> 
              一键激发沙箱收银台 调试
            </button>

            <span className="text-[10px] text-slate-500 text-center leading-normal">
              * 点击调试将生成一个全新待付单。沙箱测试用于验证创建订单、收银台展示和回调链路；真实付款测试请使用另一台手机支付小额订单。
            </span>

            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-950/10 p-4 text-[11px] text-slate-300">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="font-bold text-emerald-300">上线前接入体检</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleWebhookPing}
                    disabled={isPingingWebhook}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-[10px]"
                  >
                    {isPingingWebhook ? '测试中...' : '测试 Webhook'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRunCheckup}
                    disabled={isRunningCheckup}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-[10px]"
                  >
                    {isRunningCheckup ? '体检中...' : '立即体检'}
                  </button>
                </div>
              </div>

              {webhookPingResult && (
                <div className={`mb-3 rounded-xl border p-3 ${
                  webhookPingResult.ok
                    ? 'border-emerald-500/20 bg-emerald-500/10'
                    : 'border-amber-500/20 bg-amber-500/10'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-200">Webhook 连通测试</span>
                    <span className={`text-[10px] font-bold ${webhookPingResult.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {webhookPingResult.ok ? 'PASS' : 'WARN'}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    HTTP {webhookPingResult.statusCode ?? '-'} · {webhookPingResult.durationMs}ms · {webhookPingResult.responseSummary}
                  </p>
                  {webhookPingResult.responseBodyPreview && !webhookPingResult.ok && (
                    <code className="block mt-2 rounded-lg bg-[#0B1020]/60 px-2 py-1 text-[10px] text-slate-400 break-all">
                      {webhookPingResult.responseBodyPreview}
                    </code>
                  )}
                </div>
              )}

              {checkupResult ? (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-emerald-300">通过 {checkupResult.summary.pass}</span>
                    <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-amber-300">警告 {checkupResult.summary.warn}</span>
                    <span className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-rose-300">阻塞 {checkupResult.summary.fail}</span>
                  </div>
                  {checkupResult.checks.map((check) => (
                    <div key={check.id} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0B1020]/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-slate-200">{check.label}</span>
                        <span className={`text-[10px] font-bold uppercase ${
                          check.status === 'pass' ? 'text-emerald-400' : check.status === 'warn' ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL'}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-1 leading-relaxed">{check.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <span>1. App Secret 仅保存在服务端</span>
                  <span>2. amount 使用两位小数字符串</span>
                  <span>3. notify_url 返回纯文本 success</span>
                  <span>4. 至少一台 Android 监听端在线</span>
                  <span>5. 微信/支付宝通知详情未隐藏</span>
                  <span>6. 固定金额码池覆盖高频金额</span>
                </div>
              )}
            </div>

          </form>
        )}

      </div>

    </div>
    </div>
  );
}
