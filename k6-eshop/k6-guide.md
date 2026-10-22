# SỔ TAY HƯỚNG DẪN THỰC THI KIỂM THỬ HIỆU NĂNG VỚI GRAFANA K6 (ESHOP SUT)

* **Môn học:** Software Testing (CS423 / CSC15003) – FIT@HCMUS
* **Chủ đề:** T05 - Performance Testing (Nhóm 07)
* **Người phụ trách k6:** Trương Thành Phát (23120319) – Technical & AI Lead
* **Hệ thống kiểm thử (SUT):** EShop (Node.js + SQLite backend tại `http://localhost:3000`)

---

## 1. Các khái niệm cốt lõi trong Grafana k6

Khi thực hiện kiểm thử hiệu năng với k6, bạn cần nắm vững 4 khái niệm nền tảng sau:

1. **Virtual User (VU - Người dùng ảo):**
   * Mỗi VU tương đương với một tiến trình/luồng chạy song song độc lập, mô phỏng hành vi của một khách hàng thật đang truy cập trang web.
   * Các VU hoạt động đồng thời (concurrently) để tạo áp lực tải lên hệ thống.
2. **Iteration (Vòng lặp thực thi):**
   * Trong k6, mã nguồn hành vi người dùng được định nghĩa bên trong hàm `export default function () { ... }`.
   * **1 Iteration** được tính là **một lần người dùng thực hiện trọn vẹn toàn bộ các bước từ dòng đầu tiên đến dòng cuối cùng của hàm `default`**.
   * Ví dụ: Người dùng mở trang web $\rightarrow$ Đăng nhập $\rightarrow$ Tìm kiếm sản phẩm $\rightarrow$ Xem chi tiết $\rightarrow$ Thêm vào giỏ hàng $\rightarrow$ Áp mã giảm giá $\rightarrow$ Đặt hàng $\rightarrow$ Xem lịch sử đơn. Khi kết thúc bước xem lịch sử đơn, người đó đã hoàn thành **1 Iteration**. Nếu k6 tiếp tục chạy, chu trình sẽ lặp lại từ bước 1 (Iteration 2).
3. **Checks (Điểm kiểm tra / Assertions):**
   * Hoạt động giống như câu lệnh `assert`, dùng để xác thực xem phản hồi của server có đúng kỳ vọng hay không (ví dụ: HTTP status là 200, có chứa chuỗi JWT token, trả về đúng định dạng mảng JSON).
   * **Lưu ý:** Khác với unit test thông thường, khi một `check` bị thất bại (Failed), k6 **không dừng kịch bản lại** mà chỉ ghi nhận tỷ lệ lỗi để tiếp tục kiểm tra các bước sau.
4. **Thresholds (Ngưỡng tiêu chí SLO):**
   * Tiêu chuẩn Pass/Fail tổng thể của toàn bộ bài test (ví dụ: $P95 < 500\text{ ms}$, tỷ lệ lỗi $< 1\%$). Khi bài test kết thúc, nếu có bất kỳ tiêu chí nào vượt ngưỡng, k6 sẽ đánh dấu bài test là thất bại (exit code khác 0).

---

## 2. Kịch bản 1: Smoke Test (`smoke_test.js`)

### 2.1. Bản chất và Mục tiêu của Smoke Test
* **Trong kiểm thử hiệu năng:** Smoke Test được thực thi với **mức tải tối thiểu (1 Virtual User)** trước khi chạy bất kỳ bài test tải nặng nào (Baseline 50 VUs hay Spike 500 VUs).
* **Mục tiêu chính:**
  1. Kiểm tra tính sẵn sàng (Health check) của Backend EShop.
  2. Xác minh tính đúng đắn của toàn bộ luồng kịch bản (kịch bản không bị lỗi cú pháp, không gọi sai endpoint, không bị đứt đoạn giữa chừng).
  3. Đảm bảo toàn bộ 7 API mục tiêu đều hoạt động và trả về HTTP 200.

---

### 2.2. Chu trình 7 bước nghiệp vụ trong `smoke_test.js`

File `smoke_test.js` mô phỏng 1 người dùng thực hiện tuần tự chuỗi 7 hành động:

| Bước | API Endpoint | Phương thức | Dữ liệu truyền lên | Checkpoints kiểm tra |
| :---: | :--- | :---: | :--- | :--- |
| **1** | `/api/login` | `POST` | `email`, `password` (lấy từ file `users.csv`) | Status 200; Trả về chuỗi JWT `token` hợp lệ. |
| **2** | `/api/products?search=phone` | `GET` | Header `Authorization: Bearer <token>` | Status 200; Kết quả là một danh sách mảng JSON. |
| **3** | `/api/products/:id` | `GET` | Header `Authorization` | Status 200; ID sản phẩm trả về trùng khớp ID đã chọn. |
| **4** | `/api/cart` | `POST` | `{ id, name, price, quantity: 1 }` | Status 200 (Thêm sản phẩm vào giỏ thành công). |
| **5** | `/api/apply-coupon` | `POST` | `{ code: 'SAVE10', total_amount, user_id }` | Status 200; Có trường `discount_amount` tính tiền giảm. |
| **6** | `/api/checkout` | `POST` | `{ total_amount, shipping_address }` | Status 200; Nhận được mã đơn hàng `orderId`. |
| **7** | `/api/orders/my-orders` | `GET` | Header `Authorization` | Status 200; Danh sách đơn hàng cá nhân có $\ge 1$ đơn. |

---

### 2.3. Hướng dẫn thực thi: Sự khác biệt giữa 2 lựa chọn chạy k6

Trước khi chạy, hãy mở terminal và di chuyển vào thư mục chứa script:
```bash
cd "d:\HCMUS\semester7\software-testing\Performance-Testing-Seminar-Gr07\k6-eshop"
```

Bạn có thể chạy kịch bản theo 2 chế độ:

#### **Lựa chọn A: Chạy nhanh 1 vòng lặp (Khuyên dùng khi Debug / Kiểm tra nhanh)**
```bash
k6 run --iterations 1 smoke_test.js
```
* **Cơ chế:** Cờ `--iterations 1` ghi đè cấu hình trong file, ép k6 **chỉ chạy đúng 1 vòng lặp duy nhất** rồi thoát ngay.
* **Thời gian thực hiện:** Khoảng **3 – 4 giây**.
* **Khi nào sử dụng:** Khi bạn vừa sửa code, đổi endpoint hoặc muốn kiểm tra nhanh xem server có phản hồi tốt hay không mà không muốn chờ đợi.

#### **Lựa chọn B: Chạy đầy đủ theo thời gian (Chuẩn kịch bản môn học)**
```bash
k6 run smoke_test.js
```
* **Cơ chế:** k6 đọc cấu hình `duration: '1m'` trong file script. 1 người dùng ảo (1 VU) sẽ **liên tục lặp đi lặp lại chu trình 7 bước suốt 60 giây**.
* **Thời gian thực hiện:** Đúng **1 phút** (trong 1 phút sẽ thực hiện được khoảng 12 – 15 vòng lặp mua sắm).
* **Khi nào sử dụng:** Khi chạy nghiệm thu chính thức của mốc Smoke Test để kiểm tra độ ổn định bền vững của ứng dụng khi có thao tác mua hàng liên tục.

---

### 2.4. Cách đọc và phân tích kết quả trên màn hình Terminal

Khi k6 hoàn tất, bảng tổng kết sẽ hiển thị các khối thông tin sau:

```text
  █ THRESHOLDS 
    ✓ checks...............: 'rate==1.0' rate=100.00%
    ✓ http_req_duration....: 'p(95)<500' p(95)=10.02ms
    ✓ http_req_failed......: 'rate==0'   rate=0.00%

  █ TOTAL RESULTS 
    checks_succeeded...: 100.00% (13 out of 13)
    ✓ [1. Login] status 200
    ✓ [1. Login] có JWT token
    ✓ [2. Search] status 200
    ...
```

1. **Khối THRESHOLDS (Ngưỡng chất lượng SLO):**
   * Có dấu tích xanh `✓`: Tiêu chí đạt chuẩn.
   * `checks rate=100%`: 100% các điểm kiểm tra đều đúng, không có lỗi logic nào.
   * `http_req_failed rate=0.00%`: Tỷ lệ lỗi mạng/server là 0%.
   * `http_req_duration p(95)=10.02ms`: 95% số request có thời gian phản hồi cực nhanh (10ms), vượt xa yêu cầu ($< 500\text{ ms}$).
2. **Khối TOTAL RESULTS (Chi tiết Checkpoints):**
   * Thể hiện chi tiết cả 13 tiêu chí kiểm tra tương ứng với 7 bước nghiệp vụ. Nếu bước nào bị lỗi, dòng đó sẽ hiện dấu nhân màu đỏ `✗`.

---

## 3. Cơ chế Data-Driven Testing với `users.csv`

* **Vấn đề thực tế:** Nếu tất cả các VU dùng chung 1 tài khoản (`test@eshop.com`), khi nhiều người cùng đặt hàng và áp mã giảm giá `SAVE10`, hệ thống sẽ báo lỗi `400 Đã đạt giới hạn sử dụng mã (max_uses_per_user = 1)` hoặc gây nghẽn khóa ghi SQLite.
* **Giải pháp trong script:**
  * File `users.csv` chứa 101 tài khoản độc lập đã được nạp sẵn vào cơ sở dữ liệu (`user1@eshop.com` ... `user100@eshop.com`).
  * Trong k6, thư viện `SharedArray` tải dữ liệu một lần vào bộ nhớ:
    ```javascript
    import { SharedArray } from 'k6/data';

    const users = new SharedArray('eshop_users', function () {
      return open('./users.csv').split('\n').slice(1)...;
    });
    ```
  * Cấp phát tài khoản riêng cho từng VU bằng công thức:
    ```javascript
    const currentUser = users[(__VU - 1) % users.length];
    ```
    *(VU 1 dùng user 1, VU 2 dùng user 2,... đảm bảo mỗi phiên người dùng là hoàn toàn độc lập).*
