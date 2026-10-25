// ============================================================================
// KỊCH BẢN DEMO LỖI: Baseline Load Test với mã AI ban đầu (ai_generated_raw)
// Minh họa Failure Mode 2: Các lỗi ngầm định nghiêm trọng & Thiếu Data-driven của AI
// ============================================================================
// Khi chạy kịch bản này với 50 VUs, các lỗi nghiêm trọng sau sẽ xuất hiện:
// 1. ❌ DÙNG CHUNG 1 TÀI KHOẢN TĨNH: Cả 50 VUs đều đăng nhập 'test@eshop.com'.
// 2. ❌ LỖI COUPON (HTTP 400):
//    - AI chỉ gửi { code: 'SAVE10' }, thiếu total_amount -> Server văng lỗi HTTP 400.
//    - Xung đột max_uses_per_user = 1: Cùng 1 tài khoản áp mã nhiều lần -> Server từ chối.
// 3. ❌ CAMELCASE & FALSE POSITIVE CHECKOUT:
//    - Payload gửi camelCase (shippingAddress thay vì snake_case shipping_address, thiếu total_amount).
//    - AI chỉ check r.status === 200 mà không check sâu dữ liệu.
// 4. ❌ BỎ QUA API GIỎ HÀNG: Nhảy cóc thẳng từ detail sang checkout.
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ❌ LỖI AI #1: Hardcode duy nhất 1 tài khoản tĩnh từ HAR (Không dùng SharedArray / users.csv)
const STATIC_EMAIL = 'test@eshop.com';
const STATIC_PASSWORD = 'Test1234!';
const COUPON_CODE = 'SAVE10'; // Bật mã giảm giá để thấy xung đột nghiệp vụ

// Workload mix theo yêu cầu ban đầu của AI: 70% browse, 25% detail, 5% checkout
const MIX = { browse: 0.70, detail: 0.25 };
const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro'];
const FALLBACK_PRODUCT_IDS = [1, 2, 3, 4, 5];

export const options = {
  scenarios: {
    baseline_buggy: {
      executor: 'constant-vus',
      vus: 50,
      duration: __ENV.DURATION || '30s', // Mặc định 30s để tiện Live Demo trên lớp (hoặc 5m nếu chạy full)
      gracefulStop: '5s',
    },
  },
  thresholds: {
    // Ngưỡng SLO chuẩn: Bài test sẽ bị đánh FAIL vì vi phạm cả Error Rate lẫn Checks
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'], // Kỳ vọng lỗi < 1%, nhưng thực tế sẽ tăng vọt!
    checks: ['rate>0.99'],          // Kỳ vọng pass > 99%, nhưng sẽ bị rớt do lỗi coupon!
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/api/products?search=`);
  let ids = FALLBACK_PRODUCT_IDS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length) ids = list.map((p) => p.id);
  } catch (_) {}
  return { productIds: ids };
}

// Module scope per-VU: Cả 50 VUs đều lấy token của đúng 1 tài khoản tĩnh!
let token = null;
let userId = null;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function login() {
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({ email: STATIC_EMAIL, password: STATIC_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } }
  );
  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has token': (r) => !!r.json('token'),
  });
  if (ok) {
    token = res.json('token');
    userId = res.json('user.id') || 2;
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function browse() {
  const q = Math.random() < 0.4 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });
  check(res, {
    'search: status 200': (r) => r.status === 200,
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
  });
}

// ❌ LỖI AI #2 & #3: Chuỗi mua hàng của AI sinh ra bị lỗi nặng
function buggyCheckoutFlow(ids) {
  // 1. Áp mã giảm giá: AI chỉ gửi { code: 'SAVE10' }, THIẾU total_amount!
  // Backend Express yêu cầu total_amount > min_order_amount (300k).
  // Vì thiếu total_amount và 50 VUs dùng chung 1 tài khoản (dính max_uses_per_user = 1),
  // Endpoint này văng lỗi HTTP 400 Bad Request liên tục!
  const couponRes = http.post(
    `${BASE_URL}/api/apply-coupon`,
    JSON.stringify({ code: COUPON_CODE, user_id: userId }), // AI giả định ngầm định, thiếu total_amount
    { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } }
  );

  check(couponRes, {
    '❌ [Bug AI] coupon: status 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 2. Checkout: AI tự chế payload camelCase (shippingAddress thay vì shipping_address, thiếu total_amount)
  // và bỏ qua hoàn toàn bước thêm vào giỏ hàng POST /api/cart!
  const buggyPayload = JSON.stringify({
    productId: pick(ids),
    quantity: 1,
    shippingAddress: '123 Fake Street, HCM', // ❌ Sai quy chuẩn backend (bắt buộc snake_case)
    couponCode: COUPON_CODE,
  });

  const checkoutRes = http.post(
    `${BASE_URL}/api/checkout`,
    buggyPayload,
    { headers: authHeaders(), tags: { endpoint: 'checkout' } }
  );

  check(checkoutRes, {
    'checkout: status 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 3. Xem lịch sử đơn hàng
  const orders = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });
  check(orders, { 'my-orders: status 200': (r) => r.status === 200 });
}

export default function (data) {
  if (!token) login();

  const r = Math.random();
  if (r < MIX.browse) {
    browse();
  } else if (r < MIX.browse + MIX.detail) {
    productDetail(data.productIds);
  } else {
    buggyCheckoutFlow(data.productIds);
  }

  sleep(Math.random() * 1.5 + 0.5); // think time 0.5 - 2s
}
