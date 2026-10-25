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

---

## 5. Kịch bản 3: Spike Test (`spike_test.js`)

### 5.1. Bản chất và Mục tiêu của Spike Test (Kiểm thử sốc tải)

Khác với Baseline Load Test (duy trì tải đều đặn), **Spike Test** là bài kiểm tra độ đàn hồi (**Resilience & Recovery**) của hệ thống khi có một lượng truy cập khổng lồ ùa vào đột ngột trong thời gian rất ngắn (ví dụ: khoảnh khắc mở bán Flash Sale lúc 0h ngày Black Friday, hoặc khi một sự kiện khuyến mãi lớn vừa được công bố).

#### **Mô hình 4 giai đoạn sốc tải (Tổng thời gian: 5 phút):**
1. **Stage 1 (0:00 – 1:00):** Giữ **50 VUs** trong 1 phút (Mức tải nền ổn định thông thường).
2. **Stage 2 (1:00 – 1:30):** Tăng vọt gấp 10 lần từ **50 lên 500 VUs** trong đúng 30 giây (Pha sốc tải đột biến).
3. **Stage 3 (1:30 – 3:30):** Duy trì tải đỉnh **500 VUs** trong suốt 2 phút (Đo sức chịu đựng cực hạn).
4. **Stage 4 (3:30 – 5:00):** Giảm tải nhanh về 0 và quan sát thời gian phục hồi (**Recovery Time**).

---

### 5.2. Tại sao cần tới 500+ tài khoản trong `users.csv`?

* **Vấn đề xung đột nghiệp vụ:** Mã giảm giá `SAVE10` trên EShop có ràng buộc nghiệp vụ: `max_uses_per_user = 1` (mỗi người chỉ được dùng 1 lần).
* Nếu chỉ có 100 tài khoản mà chạy 500 VUs: trung bình 5 VUs sẽ dùng chung 1 tài khoản. Khi VU đầu tiên dùng mã thành công, 4 VU còn lại sẽ bị báo lỗi `HTTP 400: Đã đạt giới hạn sử dụng mã`. Lỗi này là do **trùng tài khoản**, không phải do **hệ thống bị sập**.
* **Giải pháp chuẩn:** Nạp đủ **601 tài khoản độc lập** vào CSDL và file `users.csv` để cấp phát theo tỷ lệ **1:1** (`VU 1` $\rightarrow$ `user1`, ..., `VU 500` $\rightarrow$ `user500`). Khi đó mọi áp lực và lỗi phát sinh đều phản ánh 100% năng lực chịu tải của phần cứng và CSDL.

---

### 5.3. Hiện tượng Thắt cổ chai SQLite (Lock Contention)

* **Điểm yếu của SQLite:** SQLite là hệ CSDL dạng tệp đơn (single-file database). Khi có nhiều tiến trình cùng thực hiện câu lệnh ghi (`INSERT INTO orders` khi Checkout), SQLite phải áp dụng cơ chế khóa độc quyền (**Exclusive Lock**) trên toàn bộ tệp database.
* **Cơ chế hoạt động dưới tải 500 VUs:**
  * Thư viện `sqlite3` trong Node.js sử dụng một hàng đợi bất đồng bộ (internal async queue) để tuần tự hóa các câu lệnh ghi.
  * Nếu tốc độ ghi của ổ cứng đủ nhanh, các câu lệnh sẽ được giải phóng kịp thời. Nhưng độ trễ của riêng endpoint `checkout` sẽ tăng vọt lên cao nhất trong toàn bộ các API (thực tế đo được: $P95 = 8.8\text{ ms}$, $P99 = 20.2\text{ ms}$, cao gấp 5 – 10 lần so với các API đọc `search` và `product_detail`).

---

### 5.4. Kết quả Thực nghiệm Thực tế đo được từ Spike Test (500 VUs)

* **Tổng số requests xử lý:** **59,621 requests** (tăng gấp gần **8 lần** so với bài Baseline 50 VUs).
* **Thông lượng đạt đỉnh (Peak Throughput):** **197.86 req/s** (gần 200 requests/giây).
* **Số đơn hàng đặt thành công:** **2,510 đơn hàng** được ghi nhận thẳng vào CSDL.
* **Độ trễ toàn cục P95:** **4.12 ms** (hệ thống phục hồi hoàn hảo sau pha sốc tải).
* **Tỷ lệ lỗi HTTP:** **0.00%** (không có request nào bị timeout hay sập server).

---

## 6. Tổng kết: Báo cáo SLO và Vai trò của từng Kịch bản

### 6.1. Báo cáo SLO là gì?
* **SLO (Service Level Objective):** Là bản cam kết định lượng về chất lượng dịch vụ của hệ thống EShop.
* Báo cáo SLO 1 trang đối chiếu 5 chỉ số cam kết:
  1. $P95 < 500\text{ ms}$
  2. Tỷ lệ lỗi $< 1\%$
  3. Thông lượng $\ge 20\text{ req/s}$
  4. CPU $< 80\%$
  5. RAM $< 300\text{ MB}$

### 6.2. Ma trận phối hợp giữa các kịch bản trong Báo cáo SLO

| Kịch bản kiểm thử | Mức tải | Thời gian | Vai trò cốt lõi trong Báo cáo SLO |
| :--- | :---: | :---: | :--- |
| **Smoke Test** | 1 VU | 1 phút | **Điều kiện tiên quyết:** Kiểm tra thông suốt cả 7 API, $0\%$ lỗi khi không có tải. |
| **Baseline Load** | 50 VUs | 5 phút | **Dữ liệu chính để kết luận Pass/Fail:** Đo đạc năng lực hệ thống ở mức tải chuẩn vận hành. |
| **Spike Test** | 50 $\rightarrow$ 500 VUs | 5 phút | **Đo độ đàn hồi & Khả năng chịu sốc:** Đo lường ngưỡng chịu tải cực hạn và thời gian phục hồi (Recovery Time). |
| **Endurance Test**| 50 VUs | 30 phút | **Đo độ bền:** Kiểm tra xem RAM có bị rò rỉ (Memory Leak) sau thời gian dài chạy liên tục hay không. |

---

## 7. Kịch bản 4: Endurance Test (`endurance_test.js`)

### 7.1. Bản chất và Mục tiêu của Endurance Test (Kiểm thử độ bền)
* **Khái niệm:** Còn được gọi là **Soak Testing**, là bài kiểm tra hệ thống dưới mức tải trung bình cao (50 VUs) duy trì liên tục trong thời gian dài (30 phút).
* **Mục tiêu chính:**
  1. **Phát hiện rò rỉ bộ nhớ (Memory Leak):** Kiểm tra xem tiến trình Node.js và V8 Heap Engine có giải phóng bộ nhớ sau mỗi phiên làm việc hay không, hay RAM cứ phình to dần theo thời gian cho đến khi sập server (Out Of Memory - OOM).
  2. **Đo độ thoái hóa hiệu năng (Performance Degradation):** Đảm bảo sau 30 phút chạy liên tục, độ trễ phản hồi ($P95$) không bị suy giảm (không bị chậm dần đều do nghẽn GC hoặc CSDL bị phình to).
  3. **Phân bổ tải:** Tập trung vào các hành vi tra cứu dữ liệu liên tục ($90\%$ Tìm kiếm & $10\%$ Xem chi tiết) để kiểm tra độ bền vững của tầng truy vấn dữ liệu.

### 7.2. Hướng dẫn thực thi:
* **Chạy nghiệm thu đầy đủ 30 phút:**
  ```bash
  k6 run --out json=endurance_results.json endurance_test.js
  ```
* **Chạy thử nghiệm nhanh (ví dụ 2 phút):**
  ```bash
  k6 run -e ENDURANCE_DURATION=2m endurance_test.js
  ```

---

## 8. Bảng So sánh Tổng hợp Bộ 4 Kịch bản Kiểm thử Tải EShop

| Tiêu chí | 1. Smoke Test | 2. Baseline Load Test | 3. Spike Test | 4. Endurance Test |
| :--- | :--- | :--- | :--- | :--- |
| **File script** | `smoke_test.js` | `baseline_load.js` | `spike_test.js` | `endurance_test.js` |
| **Số lượng Virtual Users (VUs)** | 1 VU | 50 VUs | 50 $\rightarrow$ 500 VUs | 50 VUs |
| **Tổng thời gian chạy** | 1 phút | 5 phút | 5 phút | 30 phút |
| **Phân bổ tỷ lệ tải (Workload Mix)** | Chạy tuần tự 100% 7 bước | 70% Search, 25% Detail, 5% Checkout | 70% Search, 25% Detail, 5% Checkout | 90% Search, 10% Detail |
| **Mục tiêu kỹ thuật cốt lõi** | Kiểm tra thông mạch 7 API, xác thực token | Đo đạc hiệu năng chuẩn để đối chiếu Pass/Fail SLO | Đo sức chịu sốc tải đỉnh và bắt lỗi khóa SQLite | Phát hiện rò rỉ bộ nhớ (Memory Leak) Node.js |
| **Chỉ số trọng tâm** | Tỷ lệ Checks đạt 100%, 0% lỗi | Throughput $\ge 20$, $P95 < 500\text{ ms}$, Lỗi $< 1\%$ | Đỉnh Throughput (gần 200 req/s), Recovery Time | Xu hướng RAM ($< 300\text{ MB}$) và $P95$ ổn định |
| **Lệnh chạy xuất dữ liệu** | `k6 run smoke_test.js` | `k6 run --out json=baseline_results.json baseline_load.js` | `k6 run --out json=spike_results.json spike_test.js` | `k6 run --out json=endurance_results.json endurance_test.js` |

---

## 9. Quy trình Kiểm thử Kết hợp AI (AI-Augmented Performance Testing Workflow)

Đây là điểm nhấn quan trọng nhất trong vai trò **Technical & AI Lead** của Seminar Track. Quy trình kiểm thử kết hợp AI tuân thủ nghiêm ngặt 3 bước: **Prompting $\rightarrow$ Auditing $\rightarrow$ Refining**:

```text
[ File HAR / Log HTTP ] 
       │
       ▼ (1. Prompting)
[ ChatGPT / Claude ] ──────► ai_generated_raw.js (Bản thô - Chứa lỗi ngầm định)
                                  │
                                  ▼ (2. Critical Auditing)
[ Đối chiếu backend server.js ] ──► Phát hiện 4 lỗi ngầm định (Silent Assumptions)
                                  │
                                  ▼ (3. Human Refining)
                             ai_audited_refined.js (Bản chuẩn hóa) ──► Tách thành 4 kịch bản test
```

### 9.1. Chi tiết 4 lỗi ngầm định (Silent Assumptions) phát hiện qua kiểm toán
1. **Lỗi sai cấu trúc Payload (Payload Contract Mismatch):** AI sinh dữ liệu `POST /api/checkout` dạng camelCase (`shippingAddress`, thiếu `total_amount`), trong khi backend EShop đọc dạng snake_case (`total_amount`, `shipping_address`). Hậu quả: CSDL lưu giá trị `NULL`.
2. **Lỗi logic gọi API dẫn đến 100% thất bại (Flawed Business Logic):** AI gọi `POST /api/apply-coupon` chỉ truyền `{ code: 'SAVE10' }` mà thiếu trường `total_amount`. Backend so sánh `undefined > min_order_amount` $\rightarrow$ luôn trả về HTTP 400.
3. **Thiếu tính năng Data-Driven (Hardcoded Single User):** AI dùng chung 1 tài khoản `test@eshop.com` cho toàn bộ VUs, gây tranh chấp phiên và vi phạm ràng buộc mã giảm giá `max_uses_per_user = 1`.
4. **Bỏ qua API nghiệp vụ quan trọng:** AI nhảy cóc từ xem chi tiết sản phẩm sang checkout mà bỏ qua API giỏ hàng `/api/cart`.

---

## 10. Các Chế độ Thất bại của Công cụ k6 (Failure Modes - Bắt buộc theo Rubric)

Khi sử dụng k6, kỹ sư hiệu năng cần cảnh giác với **3 tình huống công cụ báo kết quả gây hiểu lầm hoặc sai lệch thực tế**:

### Failure Mode 1: Hiện tượng VU Starvation / Coordinated Omission trong Closed Model (`ramping-vus`)
* **Nguyên nhân (Trigger):** Backend EShop bị chậm do khóa ghi CSDL SQLite.
* **Triệu chứng (Symptom):** Các Virtual Users bị kẹt chờ server phản hồi. Vì là mô hình vòng lặp đóng (Closed System), VU chưa nhận được phản hồi thì sẽ **không gửi tiếp request mới**.
* **Hiểu lầm (Misleading):** k6 báo tỷ lệ lỗi HTTP rất thấp ($0\%$), người kiểm thử tưởng hệ thống vẫn ổn. Nhưng thực chất **thông lượng (Throughput) đã sụt giảm nghiêm trọng**, số lượng request phục vụ được giảm mạnh.
* **Cách khắc phục (Mitigation):** Không chỉ nhìn vào Error Rate mà phải đối chiếu chặt chẽ với biểu đồ Throughput (`http_reqs`) và cân nhắc sử dụng executor dạng Open Model (`constant-arrival-rate`).

### Failure Mode 2: Lỗi HTTP 200 giả tạo (Silent HTTP 200 / False Positives)
* **Nguyên nhân (Trigger):** API backend trả về HTTP Status 200 nhưng nội dung bên trong body JSON lại là thông báo lỗi nghiệp vụ (ví dụ: `{"success": false, "message": "Sản phẩm đã hết hàng"}`).
* **Triệu chứng (Symptom):** Script kiểm thử chỉ kiểm tra sơ sài `check(res, { 'status 200': (r) => r.status === 200 })`.
* **Hiểu lầm (Misleading):** k6 báo Pass $100\%$, nhưng thực tế không có đơn hàng nào được tạo thành công trong cơ sở dữ liệu.
* **Cách khắc phục (Mitigation):** Bắt buộc phải viết deep assertion kiểm tra nội dung JSON:
  ```javascript
  check(res, {
    'status 200': (r) => r.status === 200,
    'có orderId': (r) => r.json('orderId') !== undefined,
  });
  ```

### Failure Mode 3: Nghẽn tài nguyên máy phát tải (Load Generator Resource / Port Exhaustion)
* **Nguyên nhân (Trigger):** Chạy mức tải 500 VUs ngay trên cùng một máy tính cá nhân đang chạy Backend Node.js và SQLite.
* **Triệu chứng (Symptom):** Hệ điều hành Windows bị quá tải CPU hoặc cạn kiệt cổng kết nối TCP tạm thời (Ephemeral Port Exhaustion / TIME_WAIT socket backlog).
* **Hiểu lầm (Misleading):** Độ trễ $P95, P99$ tăng vọt lên hàng nghìn ms, người kiểm thử vội vàng kết luận do ứng dụng EShop bị chậm, nhưng thực tế là do **chính máy tính phát tải của bạn bị nghẽn phần cứng**.
* **Cách khắc phục (Mitigation):** Bật Task Manager / Performance Monitor giám sát máy phát tải; cấu hình tăng giới hạn socket trên OS hoặc tách máy phát tải k6 sang một máy riêng biệt (Distributed Testing).

---

## 11. Tại sao có 6 loại Performance Testing nhưng Đồ án lại chọn 4 dạng kịch bản?

### 11.1. Bản chất 6 loại Performance Testing trong công nghiệp
Mỗi loại kiểm thử hiệu năng nhằm giải quyết một **chiều kích Rủi ro (Specific Risk Dimension)** riêng biệt của doanh nghiệp:
1. **Load Testing (Tải dự kiến):** Kiểm tra hệ thống vận hành ngày thường có đạt chuẩn cam kết SLO không ($P95 < 200\text{ms}$).
2. **Stress Testing (Giới hạn chịu đựng):** Đẩy tải vượt ngưỡng để tìm điểm gãy (Breaking Point) và đánh giá cơ chế từ chối dịch vụ (Graceful Degradation vs Hard Crash).
3. **Spike Testing (Biến động sốc tải):** Tải tăng vọt đột ngột trong thời gian ngắn (Flash Sale) rồi hạ xuống xem hệ thống có tự phục hồi không.
4. **Endurance / Soak Testing (Độ bền thời gian):** Ngâm tải liên tục (30 phút - vài ngày) để phát hiện rò rỉ bộ nhớ (Memory Leak) hoặc cạn kiệt connection pool.
5. **Volume Testing (Khối lượng dữ liệu):** Đo tốc độ truy vấn khi cơ sở dữ liệu phình to (hàng triệu bản ghi).
6. **Scalability Testing (Khả năng mở rộng):** Đánh giá hiệu quả khi tăng CPU/RAM hoặc nhân bản Node/Cluster server.

### 11.2. Lý do đồ án EShop chọn bộ 4 kịch bản (Smoke - Baseline - Spike - Endurance)
1. **Spike Test 500 VUs kiêm nhiệm vai trò Stress Test:** Với EShop chạy SQLite, tải chuẩn ngày thường là 50 VUs. Khi tăng lên 500 VUs (gấp 10 lần tải chuẩn với 2,510 đơn hàng), đây đã chính là bài toán kiểm tra sức chịu đựng tối đa (Stress Test) của SQLite lock I/O và Node.js Event Loop.
2. **Volume Testing thuộc phạm vi Database Benchmarking:** Kiểm thử Volume phụ thuộc vào kích thước dữ liệu bơm trong DB (hàng triệu records), trong khi đề tài Seminar tập trung chính vào công cụ k6 và mô phỏng hành vi truy cập người dùng (User Traffic Simulation).
3. **Scalability Testing đòi hỏi hạ tầng đa Node (Cluster/Cloud):** Do SUT EShop đang chạy trên máy cục bộ (single node, SQLite file), không có Load Balancer (NGINX/K8s HPA) để kiểm chứng tỷ lệ scale tuyến tính.
4. **Bộ khung vàng theo chuẩn Grafana k6 & Google SRE:** Bộ 4 kịch bản này là bộ khung khuyến nghị chuẩn mực vừa đủ bao quát kiểm thử logic, độ trễ, khả năng chịu sốc và rò rỉ bộ nhớ mà không bị loãng phạm vi.

---

## 12. Phân tích Chuyên sâu: Tại sao cả 4 Quá trình Kiểm thử đều đạt 0.00% Lỗi HTTP?

Một câu hỏi mang tính phản biện cốt tử trong thực tế kiểm thử hiệu năng: *"Khi một hệ thống chịu áp lực tải lớn (hơn 110,000 requests với 500 VUs dồn dập trên SQLite), liệu con số 0.00% lỗi HTTP có phải là 'ảo' hoặc công cụ kiểm thử bỏ sót lỗi hay không?"*

### 12.1. Thực tế: Hệ thống từng thất bại nặng nề (Hơn 108,000 lỗi HTTP 401/400)
Con số 0.00% lỗi hoàn toàn không phải ngẫu nhiên hay do hệ thống "bất tử". Ở các vòng thử nghiệm ban đầu, hệ thống đã từng sụp đổ hàng loạt:
* **Lần chạy với script AI thô:** 100% lỗi HTTP 400 ở `/api/apply-coupon` (thiếu `total_amount`), 100% lỗi HTTP 400 ở `/api/checkout` (sai chuẩn `camelCase`), 100% lỗi HTTP 401 (thiếu bóc tách JWT Token).
* **Lần chạy dùng chung tài khoản:** Bị lỗi 400 từ chối mã giảm giá hàng loạt do vi phạm quy tắc `max_uses_per_user = 1`.
* **Lần chạy khi chưa seed database:** Hơn 108,000 requests bị lỗi HTTP 401 trên cả 3 bài Baseline (52.86%), Spike (53.31%) và Endurance (49.49%) do tài khoản người dùng chưa được nạp vào SQLite.

👉 **Kết luận:** Tỷ lệ lỗi 0.00% chỉ đạt được sau khi nhóm đã **kiểm toán toàn diện mã nguồn**, bóc tách token động và áp dụng **Data-driven cấp phát 601 tài khoản độc lập** qua `SharedArray`.

### 12.2. Ba yếu tố kỹ thuật giúp Server không bị sập (Crash) ở mức tải 500 VUs
1. **Mô hình Workload thực tế (95% Đọc - 5% Ghi):** Trong hơn 60,000 requests của bài Spike, hơn 57,000 requests là Tìm kiếm (`GET /api/products`) và Xem chi tiết. Thao tác Đọc trên SQLite sử dụng Shared Read Lock và được phục vụ tức thì từ bộ nhớ đệm RAM, không gây nghẽn máy chủ.
2. **Lợi thế môi trường Localhost và ổ cứng SSD NVMe:** Toàn bộ quá trình test diễn ra nội bộ trên máy trạm với độ trễ mạng xấp xỉ 0ms (không có packet loss hay internet jitter). Ổ cứng SSD xử lý các câu lệnh INSERT chỉ trong vài mili-giây.
3. **Cơ chế Hàng đợi Bất đồng bộ của Node.js:** Khi 500 VUs đồng loạt gửi yêu cầu đặt hàng, driver `sqlite3` trong Node.js tự động xếp các lệnh ghi vào hàng đợi trong bộ nhớ và tuần tự hóa xuống tệp `database.sqlite`. Thời gian chờ tối đa của đơn hàng lâu nhất chỉ là 70.5ms (còn rất xa ngưỡng timeout 5,000ms của SQLite), do đó không phát sinh lỗi khóa chết `SQLITE_BUSY`.

### 12.3. Sự thật phía sau con số 0%: Điểm nghẽn tiềm ẩn bộc lộ ở phân vị P99 (Tail Latency)
Mặc dù tỷ lệ lỗi HTTP là 0%, nhưng hệ thống đã **bộc lộ dấu hiệu suy giảm hiệu năng rõ rệt ở tầng cơ sở dữ liệu**:
* **So sánh độ trễ API Đọc vs API Ghi:**
  * Các API Đọc (`search`, `detail`): Giữ vững độ trễ siêu nhanh ($P95 \le 2.0\text{ms}$, $P99 \le 4.5\text{ms}$).
  * API Ghi đơn hàng (`checkout`): Độ trễ ở bài Baseline là $P95 = 14.03\text{ms}$ ($P99 = 26.42\text{ms}$); khi sốc tải 500 VUs, độ trễ tăng vọt lên **$P95 = 34.78\text{ms}$**, **$P99 = 42.64\text{ms}$** và thời gian phản hồi tối đa chạm ngưỡng **$70.50\text{ms}$** (chậm gấp gần 10 lần các API đọc).
* **Nguy cơ sụp đổ nếu tải tăng cao hơn (Breaking Point):**
  * Con số 0% lỗi hiện tại đang nằm ngay sát mép giới hạn chịu đựng của SQLite.
  * Nếu kịch bản được chuyển sang mô hình Flash Sale thực thụ (ví dụ 30% người mua hàng thay vì 5%), hoặc nâng quy mô tải lên 1,000 – 2,000 VUs, hàng đợi ghi của SQLite sẽ bị quá tải vượt mức 5 giây timeout, dẫn đến lỗi hàng loạt `SQLITE_BUSY: database is locked` và HTTP 500.

### 12.4. Bài học cốt lõi cho Kỹ sư Hiệu năng (Performance Engineering Mindset)
* Không được phép thỏa hiệp hay chủ quan khi thấy kết quả báo cáo "xanh mướt 0% lỗi".
* Một kỹ sư hiệu năng giỏi phải biết nhìn vào **phân vị đuôi trễ ($P95, P99, Max$)** và **bản chất I/O của cơ sở dữ liệu** để nhận diện trước điểm gãy của hệ thống trước khi sự cố xảy ra trên môi trường Production.
