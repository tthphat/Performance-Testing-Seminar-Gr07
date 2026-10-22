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

---

## 4. Kịch bản 2: Baseline Load Test (`baseline_load.js`)

### 4.1. Tại sao lại phân bổ tải theo tỷ lệ $70\% - 25\% - 5\%$?

Mô hình phân bổ này được gọi là **Mô hình phụ tải thực tế (Realistic Workload Model)**, dựa trên nguyên lý **Phễu chuyển đổi Thương mại Điện tử (E-Commerce Conversion Funnel)**:

```text
               [ 70% ] Tìm kiếm & Duyệt danh mục (Browse & Search)
                       \                                  /
                        \ [ 25% ] Xem chi tiết sản phẩm  /
                         \        (Product Detail)      /
                          \                            /
                           \ [ 5% ] Đặt hàng & Mua sắm/
                            \      (Checkout Flow)   /
```

1. **Thực tế hành vi người dùng ngoài đời thực:**
   * Trong thực tế, không có một trang thương mại điện tử nào mà $100\%$ người truy cập đều mua hàng. Nếu thiết kế kịch bản mà cả 50 VUs chỉ cắm đầu bấm Checkout liên tục thì đó là bài test **phi thực tế (Unrealistic Benchmark)**, không phản ánh đúng áp lực vận hành của hệ thống.
   * **Tầng đỉnh phễu ($70\%$ Tìm kiếm & xem danh sách):** Đa số người dùng vào web với tâm lý lướt xem hàng (window shopping), gõ từ khóa, lọc danh mục. Đây là các tác vụ **ĐỌC (Read-heavy operations)**, tần suất cực kỳ dày đặc nhưng chi phí tính toán nhẹ.
   * **Tầng giữa phễu ($25\%$ Xem chi tiết sản phẩm):** Khi thấy món đồ ưa thích trong danh sách, một phần khách hàng sẽ bấm vào xem chi tiết cấu hình, hình ảnh, giá tiền. Số lượng này luôn thấp hơn số lượt tìm kiếm.
   * **Tầng đáy phễu ($5\%$ Giỏ hàng, Mã giảm giá & Thanh toán):** Tỷ lệ chuyển đổi mua hàng (Conversion Rate - CVR) trung bình của các sàn thương mại điện tử hàng đầu thế giới (Amazon, Shopee, Tiki) chỉ dao động từ **$2\% \text{ đến } 5\%$**.
2. **Ý nghĩa kỹ thuật đối với hệ thống EShop:**
   * Các thao tác Tìm kiếm và Xem chi tiết chỉ là câu lệnh `SELECT` (đọc dữ liệu).
   * Thao tác **Checkout** là câu lệnh `INSERT` và `UPDATE` vào các bảng `orders`, `coupon_usage`. Do backend EShop sử dụng cơ sở dữ liệu **SQLite (cơ chế khóa tệp đơn tiến trình - single file lock)**, nếu tỷ lệ checkout quá cao một cách bất thường, SQLite sẽ bị nghẽn khóa ghi ngay lập tức. Tỷ lệ $5\%$ là con số chuẩn xác để vừa kiểm tra khả năng ghi của DB, vừa giữ cho hệ thống hoạt động đúng bản chất tải thông thường.

---

### 4.2. Các chỉ số $P50$, $P95$, $P99$ (Percentiles - Bách phân vị) là gì?

Trong kiểm thử hiệu năng chuyên nghiệp, người ta **không bao giờ dùng con số Trung bình (Average / Mean)** để đánh giá chất lượng dịch vụ, mà bắt buộc phải dùng **Percentiles (Bách phân vị)**.

#### **Vì sao con số Trung bình (Average) là "kẻ nói dối"?**
* **Ví dụ thực tế:** Giả sử bạn gửi 100 requests lên EShop:
  * 99 requests phản hồi siêu nhanh trong **$10\text{ ms}$**.
  * Đúng 1 request duy nhất bị đơ mất **$10.000\text{ ms}$** (10 giây).
* Nếu tính thời gian trung bình (Average):
  $$\text{Average} = \frac{99 \times 10 + 10.000}{100} = 109.9\text{ ms}$$
* Nhìn vào con số **$109.9\text{ ms}$**, bạn sẽ lầm tưởng hệ thống chạy rất mượt ($< 500\text{ ms}$). Nhưng sự thật là đã có **1 vị khách hàng bị đứng máy suốt 10 giây và có thể đã bỏ sang trang web khác mua hàng!** Số trung bình đã che giấu hoàn toàn trải nghiệm tồi tệ của khách hàng đó (hiện tượng Outlier / Long-tail latency).

---

#### **Percentile (Bách phân vị) giải quyết bài toán này như thế nào?**
Công cụ k6 sẽ gom toàn bộ thời gian phản hồi của mọi request trong suốt 5 phút chạy test, sau đó **sắp xếp theo thứ tự từ nhanh nhất đến chậm nhất** trên một thước đo từ $0\%$ đến $100\%$:

```text
[ Nhanh nhất ] -------------------- [ P50 ] ------------ [ P95 ] --- [ P99 ] - [ Chậm nhất ]
     1ms                             5ms                  25ms        150ms        2000ms
                                      ^                    ^            ^
                               50% người dùng        95% người dùng   1% khách hàng
                               thấy nhanh hơn        thấy nhanh hơn   chịu chậm nhất
```

1. **$P50$ (50th Percentile / Median - Trung vị):**
   * Là mốc thời gian của request nằm chính giữa danh sách (vị trí $50\%$).
   * **Ý nghĩa:** Đại diện cho **trải nghiệm của đại đa số người dùng phổ thông**. $50\%$ số lượt truy cập có tốc độ nhanh hơn hoặc bằng con số này.
2. **$P95$ (95th Percentile - Chuẩn vàng đo cam kết dịch vụ SLO/SLA):**
   * Là mốc thời gian của request nằm ở vị trí $95\%$.
   * **Ý nghĩa:** **$95\%$ tổng số request của người dùng có tốc độ phản hồi nhanh hơn con số này**, chỉ có duy nhất $5\%$ các request chậm nhất vượt qua mốc này.
   * **Tại sao ngành phần mềm chọn $P95$ làm tiêu chuẩn SLO?** Vì các tập đoàn công nghệ lớn (Google, Amazon, Microsoft) quy định rằng một hệ thống đạt chuẩn phải đảm bảo $95\%$ khách hàng luôn có trải nghiệm mượt mà. Trong đề tài môn học của bạn, yêu cầu SLO bắt buộc là:
     $$\mathbf{P95 < 500\text{ ms}}$$
3. **$P99$ (99th Percentile - Trải nghiệm cận biên xấu nhất / Worst-case):**
   * Là mốc thời gian của request nằm ở vị trí $99\%$.
   * **Ý nghĩa:** Đại diện cho **$1\%$ khách hàng chịu trải nghiệm chậm chạp nhất** trên hệ thống.
   * **Kỹ sư hiệu năng xem $P99$ để làm gì?** Con số $P99$ là chiếc kính lúp giúp phát hiện sớm các vấn đề nghiêm trọng:
     * Tiến trình dọn rác bộ nhớ (Garbage Collection) của Node.js bị khựng lại.
     * Hiện tượng nghẽn hàng đợi (Queue backlog) hoặc tranh chấp khóa ghi SQLite khi nhiều người cùng checkout một lúc.

---

### 4.3. Cách chạy Baseline Load Test và Xuất dữ liệu làm Báo cáo SLO

Để phục vụ cho việc lập **Báo cáo SLO 1 trang (Milestone M5)**, bạn chạy lệnh xuất dữ liệu ra file JSON:

```bash
k6 run --out json=baseline_results.json baseline_load.js
```

Trong lúc k6 đang chạy, bạn có thể mở một cửa sổ PowerShell thứ hai để giám sát mức độ chiếm dụng CPU & RAM của tiến trình Node.js:
```powershell
Get-Process node | Select-Object Id, ProcessName, CPU, @{Name="RAM_MB";Expression={[math]::Round($_.WorkingSet64 / 1MB, 2)}}
```
Tiêu chuẩn đạt SLO:
* $P95 < 500\text{ ms}$
* Tỷ lệ lỗi $< 1\%$
* Thông lượng (Throughput) $\ge 20\text{ req/s}$
* CPU Backend $< 80\%$
* RAM Backend $< 300\text{ MB}$
