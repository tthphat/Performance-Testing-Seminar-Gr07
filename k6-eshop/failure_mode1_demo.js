// ============================================================================
// FAILURE MODE 1 DEMO: CẠM BẪY COORDINATED OMISSION TRONG CLOSED MODEL
// ============================================================================
// Mục tiêu demo:
// 1. Cho người xem thấy Closed Model (constant-vus) tự động giảm nhịp gửi khi có trễ,
//    làm tỷ lệ lỗi báo cáo vẫn là 0.00% (Pass giả tạo).
// 2. Vạch trần sự sụt giảm thông lượng (Throughput) nghiêm trọng so với kỳ vọng.
// 3. So sánh với giải pháp Open Model (constant-arrival-rate).
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const MODE = __ENV.MODE || 'closed'; // 'closed' hoặc 'open'

export const options = {
  scenarios: MODE === 'open'
    ? {
      // [GIẢI PHÁP] OPEN MODEL: Ép hệ thống nhận đúng 50 requests/giây
      open_model_real_world: {
        executor: 'constant-arrival-rate',
        rate: 50,              // Bắt buộc 50 requests mỗi giây
        timeUnit: '1s',
        duration: '15s',
        preAllocatedVUs: 20,
        maxVUs: 100,
      },
    }
    : {
      // [CẠM BẪY] CLOSED MODEL: 20 VUs chạy vòng lặp khép kín
      closed_model_omission: {
        executor: 'constant-vus',
        vus: 20,
        duration: '15s',
      },
    },
  thresholds: {
    // ❌ BẪY: Người kiểm thử chỉ cài ngưỡng lỗi mạng (< 1%) mà quên chặn Throughput!
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

export default function () {
  // Gửi request tìm kiếm sản phẩm
  const res = http.get(`${BASE_URL}/api/products?search=phone`, {
    tags: { endpoint: 'search' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  // Trong Closed Model: Khi người dùng dừng lại 2 giây (hoặc server bị chậm 2 giây),
  // toàn bộ 20 VUs bị nghẽn lại chờ đợi, k6 KHÔNG gửi thêm bất kỳ request mới nào!
  if (MODE === 'closed') {
    sleep(10); // Giả lập độ trễ / think time 2s
  }
}
