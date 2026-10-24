// ============================================================================
// Kịch bản 2: Baseline Load Test (baseline_load.js)
// EShop Performance Testing - Milestone M3 & M5
// Student: Truong Thanh Phat (23120319) - Nhom 07
// ============================================================================
// Cấu hình tải chuẩn:
// - 50 Virtual Users (VUs) duy trì trong 5 phút (Ramp-up 30s -> Hold 4m -> Ramp-down 30s)
// - Mô hình phân bổ tải (Workload Model):
//   * 70% Tìm kiếm & duyệt danh sách sản phẩm (Search / Browse)
//   * 25% Xem trang chi tiết sản phẩm (Product Detail)
//   *  5% Chuỗi hành vi mua sắm (Add to Cart -> Apply Coupon -> Checkout -> My Orders)
// - Dữ liệu Data-Driven: 101 tài khoản độc lập từ users.csv qua SharedArray
// - Ngưỡng đánh giá SLO: P95 < 500ms, Tỷ lệ lỗi < 1%, Checks > 99%
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COUPON_CODE = __ENV.COUPON_CODE || 'SAVE10';

// Tỷ lệ phân bổ hành vi người dùng
const WORKLOAD_MIX = {
  browse: 0.70, // 70%
  detail: 0.25, // 25% (còn lại 5% là checkout flow)
};

const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro', 'tai nghe'];
const FALLBACK_PRODUCTS = [
  { id: 1, name: 'iPhone 15 Pro Max', price: 30000000 },
  { id: 2, name: 'Samsung Galaxy S24 Ultra', price: 28000000 },
  { id: 3, name: 'MacBook Pro M3', price: 45000000 },
  { id: 4, name: 'Tai nghe AirPods Pro 2', price: 6000000 },
  { id: 5, name: 'Ban phim co Keychron Q1', price: 4000000 },
];

// Nạp danh sách tài khoản từ users.csv (Data-driven testing)
const users = new SharedArray('eshop_users', function () {
  const content = open('./users.csv');
  const lines = content.split('\n').slice(1).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const [email, password, id] = line.trim().split(',');
    return { email, password, id: parseInt(id) };
  });
});

// Custom Metrics
const businessErrors = new Counter('business_errors');
const checkoutSuccessRate = new Rate('checkout_success_rate');
const checkoutDuration = new Trend('checkout_flow_duration_ms');
const successfulOrders = new Counter('successful_orders_total');

// --------------------------------------------------------------- OPTIONS ---
export const options = {
  scenarios: {
    baseline_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // Tăng tải lên 50 VUs trong 30 giây
        { duration: '4m', target: 50 },  // Duy trì ổn định 50 VUs trong 4 phút
        { duration: '30s', target: 0 },  // Giảm tải dần về 0 trong 30 giây
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Ngưỡng SLO toàn hệ thống (Milestone M5)
    http_req_duration: ['p(95)<500'], // P95 toàn cục < 500ms
    http_req_failed: ['rate<0.01'],   // Tỷ lệ lỗi HTTP < 1%
    checks: ['rate>0.99'],            // Tỷ lệ assertions thành công > 99%

    // Ngưỡng chi tiết theo từng API Endpoint
    'http_req_duration{endpoint:login}': ['p(95)<500'],
    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:product_detail}': ['p(95)<500'],
    'http_req_duration{endpoint:add_to_cart}': ['p(95)<500'],
    'http_req_duration{endpoint:apply_coupon}': ['p(95)<500'],
    'http_req_duration{endpoint:checkout}': ['p(95)<500'],
    'http_req_duration{endpoint:my_orders}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ----------------------------------------------------------------- SETUP ---
export function setup() {
  console.log(`[Setup] Bắt đầu khởi tạo dữ liệu Baseline Load tại ${BASE_URL}...`);
  const res = http.get(`${BASE_URL}/api/products?search=`, {
    tags: { endpoint: 'setup' },
  });

  let products = FALLBACK_PRODUCTS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length > 0) {
      products = list;
      console.log(`[Setup] Đã nạp thành công ${products.length} sản phẩm thực tế từ CSDL.`);
    }
  } catch (_) {
    console.warn('[Setup] Không parse được catalog, dùng sản phẩm mẫu fallback.');
  }

  return { products };
}

// ------------------------------------------------------------- VU STATE ---
// Quản lý phiên riêng cho từng Virtual User (VU Scope)
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
    '[Login] có JWT token': (r) => r.json('token') !== undefined,
  });

  if (ok) {
    token = res.json('token');
    const user = res.json('user');
    currentUserId = user ? user.id : 2;
  } else {
    token = null;
    currentUserId = null;
    businessErrors.add(1);
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------------------------------------------------- WORKLOAD ACTIONS ---

// 1. Nhóm hành vi 70%: Tìm kiếm / Xem danh sách
function actionSearch() {
  const q = Math.random() < 0.3 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });

  check(res, {
    '[Search] status 200': (r) => r.status === 200,
    '[Search] kết quả là mảng': (r) => Array.isArray(r.json()),
  });
}

// 2. Nhóm hành vi 25%: Xem chi tiết sản phẩm
function actionProductDetail(products) {
  const item = pick(products);
  const res = http.get(`${BASE_URL}/api/products/${item.id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });

  check(res, {
    '[Detail] status 200': (r) => r.status === 200,
    '[Detail] đúng ID sản phẩm': (r) => r.json('id') === item.id,
  });
}

// 3. Nhóm hành vi 5%: Chuỗi mua sắm & Thanh toán
function actionCheckoutFlow(products) {
  const flowStart = Date.now();
  const item = pick(products);
  const price = item.price || 500000;

  // 3.1. Thêm vào giỏ hàng
  const cartRes = http.post(
    `${BASE_URL}/api/cart`,
    JSON.stringify({ id: item.id, name: item.name, price: price, quantity: 1 }),
    { headers: authHeaders(), tags: { endpoint: 'add_to_cart' } }
  );

  check(cartRes, {
    '[Cart] status 200': (r) => r.status === 200,
  });

  sleep(0.5); // Tạm dừng vi mô giữa các bước thao tác

  // 3.2. Áp dụng mã giảm giá (Chỉ áp khi giá trị đủ điều kiện min_order_amount)
  let finalAmount = price;
  if (COUPON_CODE && price >= 300000) {
    const couponRes = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: COUPON_CODE, total_amount: price, user_id: currentUserId }),
      { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } }
    );

    const isCouponOk = check(couponRes, {
      '[Coupon] status 200': (r) => r.status === 200,
      '[Coupon] có số tiền giảm': (r) => r.json('discount_amount') !== undefined,
    });

    if (isCouponOk && couponRes.json('final_amount')) {
      finalAmount = couponRes.json('final_amount');
    }
  }

  sleep(0.5);

  // 3.3. Đặt hàng (Checkout)
  const checkoutRes = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify({
      total_amount: finalAmount,
      shipping_address: '123 Nguyen Trai, Phuong 4, Quan 5, TP.HCM',
    }),
    { headers: authHeaders(), tags: { endpoint: 'checkout' } }
  );

  const isCheckoutOk = check(checkoutRes, {
    '[Checkout] status 200': (r) => r.status === 200,
    '[Checkout] có orderId': (r) => r.json('orderId') !== undefined,
  });

  checkoutSuccessRate.add(isCheckoutOk);
  if (isCheckoutOk) {
    successfulOrders.add(1);
  } else {
    businessErrors.add(1);
  }

  // 3.4. Xem lịch sử đơn hàng vừa tạo
  const ordersRes = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });

  check(ordersRes, {
    '[Orders] status 200': (r) => r.status === 200,
    '[Orders] danh sách hợp lệ': (r) => Array.isArray(r.json()),
  });

  checkoutDuration.add(Date.now() - flowStart);
}

// ------------------------------------------------------------- MAIN LOOP ---
export default function (data) {
  // Phân bổ thời gian khởi động ngẫu nhiên (0 - 4s) để 50 VUs không đăng nhập cùng 1 tích tắc
  if (isFirstRun) {
    sleep(Math.random() * 4);
    isFirstRun = false;
  }

  // Mỗi VU lấy 1 tài khoản riêng từ users.csv và chỉ đăng nhập đúng 1 lần
  if (!token) {
    const user = users[(__VU - 1) % users.length];
    loginVU(user.email, user.password);
  }

  // Phân phối tỷ lệ tải theo mô hình Black Friday / ngày thường
  const rand = Math.random();
  if (rand < WORKLOAD_MIX.browse) {
    actionSearch();
  } else if (rand < WORKLOAD_MIX.browse + WORKLOAD_MIX.detail) {
    actionProductDetail(data.products);
  } else {
    actionCheckoutFlow(data.products);
  }

  // Think time ngẫu nhiên 1 - 3 giây mô phỏng thời gian suy nghĩ của người dùng thật
  sleep(Math.random() * 2 + 1);
}
