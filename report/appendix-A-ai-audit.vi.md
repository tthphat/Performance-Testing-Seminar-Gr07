# Phụ lục A - AI Audit Report

CS423 / CSC13003 - Kiểm chứng Phần mềm (AI-augmented · 2026) - Biểu mẫu 5 mục cho mỗi artifact

## 1. Thông tin sinh viên

| Mục | Giá trị |
|---|---|
| Họ tên sinh viên (in hoa) | TRUONG THANH PHAT |
| MSSV | 23120319 |
| Lớp / Khoá | Seminar Nhom 07 |
| Mã bài tập | Seminar-T05 Performance Testing |
| Ngày làm bài | 22/10/2026 |
| Công cụ AI đã dùng | Claude 3.7 Sonnet |
| Có dùng AI | [x] Có [ ] Không |

## 2. Hướng dẫn
Mỗi artifact do AI sinh có một mục bên dưới, gồm: (1) prompt + công cụ, (2) output AI, (3) verdict, (4) lý do (dẫn chiếu slide/ISTQB/RFC), (5) bản sinh viên sửa. Prompt và output được dán nguyên văn.

## 3. Bảng audit - 1 mục / artifact

| # | Bước | Công cụ | Verdict |
|---|---|---|---|
| A01 | Performance Testing / k6 Baseline Script / Milestone M4 | Claude 3.7 Sonnet | INCOMPLETE |
| A02 | Performance Testing / JMeter Smoke Test (.jmx) | Antigravity Assistant | VALID |
| A03 | Performance Testing / JMeter Baseline Load Test (.jmx) | Antigravity Assistant | VALID |

### Artifact A01 - Performance Testing / k6 Baseline Script / Milestone M4

**(1) Prompt + Công cụ** - Tool: Claude 3.7 Sonnet - Thời gian: 21:35 22/10/2026

````text
I am performance testing an EShop backend (Node.js + SQLite) running at http://localhost:3000 using Grafana k6. Here are the main APIs: POST /api/login, GET /api/products?search=..., GET /api/products/:id, POST /api/apply-coupon, POST /api/checkout, GET /api/orders/my-orders. Write a realistic mixed-workload k6 script for a baseline load of 50 VUs for 5 minutes with distribution: 70% search/list, 25% product detail, and 5% checkout. Include SLO thresholds: P95 < 500ms and error rate < 1%.
````

**(2) Output AI**

````text
// EShop baseline mixed workload — Grafana k6
// Run:  k6 run eshop_mixed_load.js
// Opt:  k6 run -e BASE_URL=http://localhost:3000 -e COUPON_CODE=SAVE10 eshop_mixed_load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// ---------------------------------------------------------------- config ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.USER_EMAIL || 'test@eshop.com';        // from your HAR
const PASSWORD = __ENV.USER_PASSWORD || 'Test1234!';       // from your HAR
const COUPON_CODE = __ENV.COUPON_CODE || '';               // leave empty to skip apply-coupon

// Mix: 70% search/list, 25% product detail, 5% checkout
const MIX = { browse: 0.70, detail: 0.25 /* remaining 0.05 = checkout */ };

// Search terms taken from the product catalog seen in the HAR
const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro', 'tai nghe'];
const FALLBACK_PRODUCT_IDS = [1, 2, 3, 4, 5];

const businessErrors = new Counter('business_errors');

// --------------------------------------------------------------- options ---
export const options = {
  scenarios: {
    baseline_mixed: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Global SLOs
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    // Per-endpoint breakdown (same SLO, so you can see which one breaks it)
    'http_req_duration{endpoint:login}': ['p(95)<500'],
    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:product_detail}': ['p(95)<500'],
    'http_req_duration{endpoint:apply_coupon}': ['p(95)<500'],
    'http_req_duration{endpoint:checkout}': ['p(95)<500'],
    'http_req_duration{endpoint:my_orders}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

// ----------------------------------------------------------------- setup ---
// Discover real product IDs once so detail/checkout never hit a 404.
export function setup() {
  const res = http.get(`${BASE_URL}/api/products?search=`, { tags: { endpoint: 'setup' } });
  let ids = FALLBACK_PRODUCT_IDS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length) ids = list.map((p) => p.id);
  } catch (_) { /* keep fallback */ }
  return { productIds: ids };
}

// ------------------------------------------------------------ VU helpers ---
// Module scope is per-VU in k6, so each VU logs in once and reuses its token
// (avoids hammering /login and tripping the login_attempts / locked_until logic).
let token = null;
let firstIteration = true;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function login() {
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has token': (r) => !!r.json('token'),
  });
  token = ok ? res.json('token') : null;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------- scenarios ---
function browse() {
  // ~40% full list (empty search, like the SPA home page), ~60% keyword search
  const q = Math.random() < 0.4 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });
  check(res, {
    'search: status 200': (r) => r.status === 200,
    'search: returns array': (r) => Array.isArray(r.json()),
  });
}

function productDetail(ids) {
  const id = pick(ids);
  const res = http.get(`${BASE_URL}/api/products/${id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });
  check(res, {
    'detail: status 200': (r) => r.status === 200,
    'detail: id matches': (r) => r.json('id') === id,
  });
}

// ASSUMPTION: checkout/apply-coupon/my-orders payloads were not in the HAR.
// Adjust buildCheckoutPayload() to match your real API contract.
function buildCheckoutPayload(ids, couponApplied) {
  return {
    items: [{ productId: pick(ids), quantity: 1 }],
    ...(couponApplied ? { couponCode: COUPON_CODE } : {}),
    shippingAddress: '123 Load Test St, Ho Chi Minh City',
    paymentMethod: 'COD',
  };
}

function checkoutFlow(ids) {
  let couponApplied = false;

  if (COUPON_CODE) {
    const c = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: COUPON_CODE }),   // ASSUMPTION: body field name
      { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } },
    );
    couponApplied = check(c, { 'coupon: status 200': (r) => r.status === 200 });
    sleep(Math.random() * 1 + 0.5);
  }

  const res = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify(buildCheckoutPayload(ids, couponApplied)),
    { headers: authHeaders(), tags: { endpoint: 'checkout' } },
  );
  const ok = check(res, {
    'checkout: status 200/201': (r) => r.status === 200 || r.status === 201,
  });
  if (!ok) businessErrors.add(1);

  // Users usually land on their orders page after paying
  const orders = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });
  check(orders, { 'my-orders: status 200': (r) => r.status === 200 });
}

// -------------------------------------------------------------- main loop --
export default function (data) {
  if (firstIteration) {
    sleep(Math.random() * 5);   // stagger so 50 VUs don't all log in on the same ms
    firstIteration = false;
  }
  if (!token) login();

  const r = Math.random();
  if (r < MIX.browse) {
    browse();
  } else if (r < MIX.browse + MIX.detail) {
    productDetail(data.productIds);
  } else {
    checkoutFlow(data.productIds);
  }

  sleep(Math.random() * 2 + 1);  // think time: 1–3 s
}
````

**(3) Verdict:** INCOMPLETE

**(4) Lý do (ISTQB / slide):** Sai cấu trúc payload POST /api/checkout (dùng camelCase shippingAddress và thiếu total_amount khiến DB lưu NULL, vi phạm đặc tả API Specification Section 4.3) và POST /api/apply-coupon (thiếu total_amount khiến backend trả về HTTP 400, vi phạm Section 5.1).

**(5) Bản sinh viên sửa:**

````text
Sửa payload checkout thành { total_amount, shipping_address } và apply-coupon thành { code, total_amount, user_id }, bổ sung CSV data-driven và API giỏ hàng trong ai_audited_refined.js.
````



### Artifact A02 - Performance Testing / JMeter Smoke Test (.jmx)

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant - Thời gian: 00:50 23/10/2026

```text
Tạo kịch bản JMeter Smoke Test (smoke_test.jmx) kiểm tra 7 API chính của EShop SUT (http://localhost:3000): POST /api/login (extract token), GET /api/products, GET /api/products/:id, POST /api/cart, POST /api/apply-coupon (SAVE10), POST /api/checkout (extract orderId), GET /api/orders/my-orders. Áp dụng CSV Data Set Config (users.csv), JSON Extractor, JSON Assertion, Response Assertion 200 cho 1 VU.
```

**(2) Output AI**

```text
Sinh file jmeter-eshop/smoke_test.jmx tuân thủ chuẩn JMeter 5.6.3 Test Plan schema, tích hợp HTTP Header Manager (Bearer token), CSV Data Set Config cho Data-driven, JSON PostProcessor trích xuất dynamic values.
```

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Kịch bản đáp ứng đúng 100% đặc tả 7 API endpoints, thực hiện đầy đủ 3 cơ chế: Data-driven, Checkpoints/Assertions, và luồng tuần tự hoàn chỉnh từ Authentication đến Checkout.

**(5) Bản sinh viên sửa:** Không cần sửa (dùng nguyên bản sinh).

---

### Artifact A03 - Performance Testing / JMeter Baseline Load Test (.jmx)

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant - Thời gian: 00:52 23/10/2026

```text
Tạo kịch bản JMeter Baseline Load Test (baseline_load.jmx) với 50 Threads, Ramp-up 30s, thời gian chạy 5 phút (300s). Phân bổ tải thực tế (Realistic Workload Model) bằng Throughput Controller theo tỉ lệ: 70% Browse & Search, 25% Product Detail, 5% Checkout. Cấu hình OnceOnlyController cho bước Login và ConstantTimer (300ms think time).
```

**(2) Output AI**

```text
Sinh file jmeter-eshop/baseline_load.jmx với Throughput Controller (Percent Executions: 70%, 25%, 5%), OnceOnlyController để đăng nhập một lần, HTTP Header Manager Bearer Token, và timer mô phỏng hành vi người dùng thật.
```

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Mô hình tải tuân thủ đúng nguyên lý phễu chuyển đổi E-Commerce và tránh nghẽn khóa đơn tiến trình của SQLite database.

**(5) Bản sinh viên sửa:** Không cần sửa (dùng nguyên bản sinh).

## 4. Tổng kết độ chính xác AI

| Chỉ số | Số lượng | Tỉ lệ |
|---|---|---|
| Tổng artifact AI sinh đã audit | 3 | 100% |
| VALID (đúng, dùng nguyên) | 2 | 66.7% |
| INVALID (sai; loại bỏ) | 0 | 0% |
| INCOMPLETE (chấp nhận sau khi sửa) | 1 | 33.3% |

## 5. Kết luận - Khi nào nên / không nên dùng AI?

<!-- SINH VIÊN TỰ VIẾT 80-150 chữ: AI mạnh ở đâu, sai ở đâu, khuyến nghị. Xoá dòng này sau khi viết. -->

## 6. Mandatory Disclosure

> Test case / script / báo cáo này được sinh phiên bản đầu bởi Claude 3.7 Sonnet; tôi đã rà soát và chỉnh sửa [phần X], bổ sung [edge case Y, Z]; [phần W] do tôi tự viết. AI Audit Report chi tiết đính kèm ở Phụ lục A. Tôi cam đoan không dùng AI để sinh bất kỳ artifact nào thuộc danh mục bị cấm.

<!-- SINH VIÊN điền [phần X], [Y, Z], [phần W] bằng nội dung thật; ký tên: -->

Họ tên sinh viên (in hoa): TRUONG THANH PHAT  
MSSV: 23120319  
Lớp / Khoá: Seminar Nhom 07  
Môn học: CS423 / CSC13003 - Kiểm chứng Phần mềm  
Giảng viên:  
Ngày:  
Chữ ký:
