import http from 'k6/http';
import { check } from 'k6';

// [FAILURE MODE 3 DEMO] Cạn kiệt cổng mạng (Ephemeral Port Exhaustion)
// Cấu hình ép k6 tắt HTTP Keep-Alive (mở kết nối TCP mới cho từng request)
export const options = {
  vus: 50,
  duration: '5s',
  noConnectionReuse: true, // ❌ BẪY: Ép mở socket mới liên tục cho từng request
  // noConnectionReuse: false  --  Mặc định của k6: BẬT HTTP Keep-Alive (Tái sử dụng kết nối)
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  const res = http.get(BASE_URL + '/api/products');
  check(res, { 'status 200': (r) => r.status === 200 });
}
