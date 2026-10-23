// ============================================================================
// Kịch bản 3: Spike Test (spike_test.js) - EShop Performance Testing
// Student: Truong Thanh Phat (23120319) - Nhóm 07
// ============================================================================
// Mục tiêu kỹ thuật:
// - Kiểm tra khả năng chịu sốc tải đột ngột (tăng gấp 10 lần từ 50 lên 500 VUs trong 30s)
// - Kích hoạt và đo lường hiện tượng thắt cổ chai cơ sở dữ liệu:
//   "SQLite Lock Contention / SQLITE_BUSY: database is locked" khi có nhiều VU cùng ghi đơn hàng
// - Quan sát khả năng tự phục hồi (Recovery Time) của hệ thống khi giảm tải về bình thường
//
// Mô hình tải (Stages - Tổng thời gian: 5 phút):
// 1. Stage 1 (1m00s): Giữ 50 VUs (Mức tải nền bình thường)
// 2. Stage 2 (0m30s): Tăng vọt đột biến từ 50 lên 500 VUs (Spike Ramp-up)
// 3. Stage 3 (2m00s): Duy trì mức sốc tải đỉnh 500 VUs (Peak Spike)
// 4. Stage 4 (1m30s): Giảm tải dần về 0 và quan sát phục hồi (Recovery Phase)
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COUPON_CODE = __ENV.COUPON_CODE || 'SAVE10';

const WORKLOAD_MIX = {
  browse: 0.70, // 70% Search
  detail: 0.25, // 25% Detail
  // Còn lại 5% là Checkout
};

const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro'];
const FALLBACK_PRODUCTS = [
  { id: 1, name: 'iPhone 15 Pro Max', price: 30000000 },
  { id: 2, name: 'Samsung Galaxy S24 Ultra', price: 28000000 },
  { id: 3, name: 'MacBook Pro M3', price: 45000000 },
];

// Nạp danh sách 101 tài khoản từ users.csv
const users = new SharedArray('eshop_users', function () {
  const content = open('./users.csv');
  const lines = content.split('\n').slice(1).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const [email, password, id] = line.trim().split(',');
    return { email, password, id: parseInt(id) };
  });
});

// Custom Metrics để bắt lỗi nghẽn SQLite và đo thời gian phục hồi
const sqliteLockErrors = new Counter('sqlite_lock_errors_total');
const checkoutFailureRate = new Rate('checkout_failure_rate');
const spikeCheckoutLatency = new Trend('spike_checkout_latency_ms');
const successfulCheckouts = new Counter('successful_checkouts_total');

// --------------------------------------------------------------- OPTIONS ---
export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // 1 phút đầu: Tải bình thường 50 VUs
        { duration: '30s', target: 500 }, // Sốc tải đột ngột lên 500 VUs trong 30 giây
        { duration: '2m', target: 500 },  // Duy trì đỉnh sốc tải 500 VUs trong 2 phút
        { duration: '1m30s', target: 0 }, // Giảm tải về 0 và đo thời gian phục hồi
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Trong Spike Test, tỷ lệ lỗi và độ trễ toàn cục cho phép tăng trong giai đoạn đỉnh
    // Nhưng tỷ lệ lỗi tổng thể không được vượt quá 10%
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.90'],

    // Giám sát riêng độ trễ endpoint checkout (nơi chịu ảnh hưởng trực tiếp của khóa SQLite)
    'http_req_duration{endpoint:checkout}': ['p(95)<3000'], // Cho phép trần 3s khi nghẽn ghi
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ----------------------------------------------------------------- SETUP ---
export function setup() {
  console.log(`[Spike Setup] Đang kiểm tra kết nối tới EShop tại ${BASE_URL}...`);
  const res = http.get(`${BASE_URL}/api/products?search=`, { tags: { endpoint: 'setup' } });
  let products = FALLBACK_PRODUCTS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length > 0) products = list;
  } catch (_) {}
  console.log(`[Spike Setup] Chuẩn bị sốc tải 500 VUs với ${products.length} sản phẩm và ${users.length} tài khoản.`);
  return { products };
}

// ------------------------------------------------------------- VU STATE ---
let token = null;
let currentUserId = null;
let isFirstRun = true;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function loginVU(email, password) {
  const payload = JSON.stringify({ email, password });
  const res = http.post(`${BASE_URL}/api/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  });

  const ok = check(res, {
    '[Login] status 200': (r) => r.status === 200,
  });

  if (ok && res.json('token')) {
    token = res.json('token');
    const user = res.json('user');
    currentUserId = user ? user.id : 2;
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------------------------------------------------- WORKLOAD ACTIONS ---
function actionSearch() {
  const q = Math.random() < 0.3 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });
  check(res, { '[Search] status 200': (r) => r.status === 200 });
}

function actionProductDetail(products) {
  const item = pick(products);
  const res = http.get(`${BASE_URL}/api/products/${item.id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });
  check(res, { '[Detail] status 200': (r) => r.status === 200 });
}

function actionCheckoutFlow(products) {
  const item = pick(products);
  const price = item.price || 500000;

  // 1. Add to cart
  http.post(
    `${BASE_URL}/api/cart`,
    JSON.stringify({ id: item.id, name: item.name, price: price, quantity: 1 }),
    { headers: authHeaders(), tags: { endpoint: 'add_to_cart' } }
  );

  sleep(0.3);

  // 2. Apply Coupon
  let finalAmount = price;
  if (COUPON_CODE && price >= 300000) {
    const couponRes = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: COUPON_CODE, total_amount: price, user_id: currentUserId }),
      { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } }
    );
    if (couponRes.status === 200 && couponRes.json('final_amount')) {
      finalAmount = couponRes.json('final_amount');
    }
  }

  sleep(0.3);

  // 3. Checkout - ĐIỂM NÓNG GÂY NGHẼN KHÓA GHI SQLITE
  const startCheckout = Date.now();
  const checkoutRes = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify({
      total_amount: finalAmount,
      shipping_address: '123 Cao Thang, Quan 3, TP.HCM',
    }),
    { headers: authHeaders(), tags: { endpoint: 'checkout' } }
  );

  const duration = Date.now() - startCheckout;
  spikeCheckoutLatency.add(duration);

  // Bắt lỗi khóa ghi SQLite: SQLITE_BUSY hoặc lỗi 500 từ server
  const isLocked = checkoutRes.status === 500 || (checkoutRes.body && checkoutRes.body.includes('SQLITE_BUSY'));
  if (isLocked) {
    sqliteLockErrors.add(1);
    checkoutFailureRate.add(1);
    console.warn(`[SQLite Bottleneck Detected] Lỗi khóa ghi SQLite tại VU ${__VU}: HTTP ${checkoutRes.status}`);
  } else {
    const isOk = check(checkoutRes, {
      '[Checkout] status 200': (r) => r.status === 200,
    });
    checkoutFailureRate.add(isOk ? 0 : 1);
    if (isOk) successfulCheckouts.add(1);
  }

  // 4. My orders
  http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });
}

// ------------------------------------------------------------- MAIN LOOP ---
export default function (data) {
  // Stagger startup ngẫu nhiên trong 3 giây
  if (isFirstRun) {
    sleep(Math.random() * 3);
    isFirstRun = false;
  }

  // Mỗi VU lấy 1 tài khoản từ 101 user (vòng tròn modulo khi có 500 VUs)
  if (!token) {
    const user = users[(__VU - 1) % users.length];
    loginVU(user.email, user.password);
  }

  const rand = Math.random();
  if (rand < WORKLOAD_MIX.browse) {
    actionSearch();
  } else if (rand < WORKLOAD_MIX.browse + WORKLOAD_MIX.detail) {
    actionProductDetail(data.products);
  } else {
    actionCheckoutFlow(data.products);
  }

  // Think time ngẫu nhiên 1 - 2.5 giây
  sleep(Math.random() * 1.5 + 1);
}
