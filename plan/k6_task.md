# KẾ HOẠCH CÔNG VIỆC CHI TIẾT: PHỤ TRÁCH CÔNG CỤ K6 & AI (NHÓM 07)

* **Phụ trách:** Trương Thành Phát (23120319)
* **Vai trò trong nhóm:** Technical & AI Lead / Phụ trách AI-Augmented Tool (**Grafana k6 + ChatGPT/Claude**)
* **Hệ thống kiểm thử (SUT):** EShop (Node.js + SQLite backend)

---

## 1. Tổng quan trách nhiệm & Đầu ra bắt buộc (Deliverables của bạn)

Để đáp ứng đầy đủ cả **Seminar Track Guide** và **Yêu cầu chung của môn học**, phần việc `k6 + AI` của bạn cần tạo ra các sản phẩm cụ thể sau:

1. **Bộ Source Code & Dữ liệu thực nghiệm (`k6`):**
   * File `eshop_session.har` thu thập từ phiên thao tác thủ công trên EShop.
   * File dữ liệu kiểm thử `users.csv` / `products.csv` phục vụ kiểm thử hướng dữ liệu (Data-driven).
   * Bộ kịch bản k6 (`.js`) hoàn chỉnh cho 4 kịch bản tải: `smoke_test.js`, `baseline_load.js`, `spike_test.js`, `endurance_test.js`.
   * Kịch bản `ai_generated_raw.js` (bản gốc do AI sinh ra) và `ai_audited_refined.js` (bản đã được bạn kiểm toán và sửa lỗi) để làm minh chứng đối chiếu.
   * Kịch bản `bakeoff_runner.js` cho phép truyền tham số tỷ lệ tải (`%-mix`) từ dòng lệnh để chạy trực tiếp trong hoạt động tương tác trên lớp.
2. **Báo cáo SLO 1 trang (1-page SLO Report):**
   * Tổng hợp các chỉ số $P50$, $P95$, $P99$, Throughput, Error Rate, CPU/RAM và bảng đánh giá Đạt/Không đạt (Pass/Fail) so với ngưỡng yêu cầu.
3. **Tài liệu hướng dẫn (`User_Guide.md` - phần k6 & AI bằng tiếng Anh):**
   * Đầy đủ từ cài đặt, chạy thử, cấu hình nâng cao, xử lý lỗi (Troubleshooting) đến ít nhất 3 **Failure Modes** của k6/AI.
4. **Video Demo (`Demo_Screencast.mp4` - phần k6 & AI):**
   * Quay trực tiếp trên Terminal/IDE (nền trắng, chữ đen, thuyết minh tiếng Anh) đủ 3 cấp độ: cài đặt, chức năng cơ bản, luồng xử lý phức tạp + AI.
5. **Tài liệu hoạt động trên lớp (`Activity_Worksheet.md`):**
   * Phiếu bài tập và đáp án (Answer Key) cho hoạt động **"Workload Model Bake-off"** kéo dài 20–25 phút.
6. **Hồ sơ Kiểm toán AI (`[AI-03]` & dữ liệu cho `[AI-02]`):**
   * Lưu nhật ký toàn bộ câu lệnh Prompt, kết quả AI trả về và danh sách các lỗi bạn đã phát hiện/chỉnh sửa.

---

## 2. Giai đoạn S3: Các bước thực nghiệm kỹ thuật chi tiết (Technical Step-by-Step)

### Bước 1: Thiết lập môi trường EShop & Cài đặt k6 (Milestone M1)
1. **Dựng hệ thống EShop SUT ở máy local:**
   * Khởi chạy Backend (Node.js + SQLite) và Frontend của EShop.
   * Kiểm tra kết nối tới 7 API mục tiêu:
     * `POST /api/login`
     * `GET /api/products?search=...`
     * `GET /api/products/:id`
     * `POST /api/apply-coupon`
     * `POST /api/checkout`
     * `GET /api/orders/my-orders`
     * `POST /api/admin/import-products`
2. **Cài đặt Grafana k6:**
   * **Windows:** `winget install k6 --source winget` hoặc `choco install k6`
   * **macOS:** `brew install k6`
   * **Linux (Debian/Ubuntu):** Cài đặt qua `apt` theo tài liệu chính thức của Grafana k6.
   * Chạy lệnh `k6 version` trên Terminal (nền trắng chữ đen) và chụp màn hình lưu vào nhật ký nhóm (Team Log).

---

### Bước 2: Đảm bảo đủ 3 thành phần bắt buộc của công cụ kiểm thử (Milestone M2)
Theo yêu cầu chung của môn học, công cụ phải thể hiện đủ 3 phần: **Record & Playback**, **Data-driven** và **Checkpoints**. Với `k6`, bạn triển khai như sau:

#### 2.1. Record and Playback (Thu thập HAR & Chuyển đổi sang k6)
1. Mở trình duyệt Chrome/Edge $\rightarrow$ bật **DevTools (F12)** $\rightarrow$ chuyển sang tab **Network** $\rightarrow$ tích chọn **Preserve log**.
2. Thực hiện thao tác mua hàng thủ công trên EShop: Đăng nhập $\rightarrow$ Tìm kiếm sản phẩm $\rightarrow$ Xem chi tiết sản phẩm $\rightarrow$ Áp mã giảm giá $\rightarrow$ Thanh toán (Checkout).
3. Nhấn chuột phải vào danh sách request trong tab Network $\rightarrow$ chọn **Save all as HAR with content** $\rightarrow$ lưu thành `eshop_session.har`.
4. Sử dụng công cụ chuyển đổi `har-to-k6` (cài qua `npm install -g har-to-k6`) hoặc đưa đoạn log HAR vào ChatGPT để chuyển thành kịch bản `recorded_flow.js`:
   ```bash
   har-to-k6 eshop_session.har -o recorded_flow.js
   ```

#### 2.2. Data-driven Testing (Kiểm thử hướng dữ liệu với CSV)
1. Tạo file `users.csv` chứa danh sách tài khoản kiểm thử riêng biệt (để không bị xung đột khi chạy Spike Test) và `search_keywords.csv` chứa các từ khóa tìm kiếm.
2. Trong script k6, sử dụng `SharedArray` và thư viện `papaparse` (hoặc hàm tách dòng thủ công) để đọc dữ liệu từ file CSV cấp phát cho từng Virtual User (VU):
   ```javascript
   import { SharedArray } from 'k6/data';

   const users = new SharedArray('eshop_users', function () {
     return open('./users.csv').split('\n').slice(1).map((line) => {
       const [email, password] = line.trim().split(',');
       return { email, password };
     });
   });
   ```

#### 2.3. Checkpoints (Assertions & SLO Thresholds)
1. **Checkpoints trên từng request (`check`):** Kiểm tra mã trạng thái HTTP, cấu trúc JSON trả về và sự tồn tại của JWT token sau khi đăng nhập:
   ```javascript
   import { check } from 'k6';

   check(loginRes, {
     'status is 200': (r) => r.status === 200,
     'has JWT token': (r) => r.json('token') !== undefined,
   });
   ```
2. **Ngưỡng SLO tổng thể (`thresholds`):** Khai báo trực tiếp các tiêu chí SLO của nhóm vào `options` của k6 để công cụ tự động đánh giá Pass/Fail:
   ```javascript
   export const options = {
     thresholds: {
       http_req_duration: ['p(95)<500'], // P95 response time < 500ms
       http_req_failed: ['rate<0.01'],   // Error rate < 1%
       http_reqs: ['rate>=20'],          // Throughput >= 20 req/s
     },
   };
   ```

---

### Bước 3: Ứng dụng AI sinh kịch bản & Kiểm toán kịch bản (Milestone M4 - Điểm nhấn AI)

Đây là phần cốt lõi của vai trò **AI Lead**. Bạn cần thực hiện theo quy trình 3 bước: **Prompting $\rightarrow$ Auditing $\rightarrow$ Refining**.

#### 3.1. Prompt cho ChatGPT/Claude sinh kịch bản k6
Sử dụng mẫu Prompt sau (lưu lại toàn bộ câu lệnh và kết quả để nộp trong `[AI-02]`):
> *"I am performance testing an EShop backend (Node.js + SQLite) using Grafana k6. Here is a sample HTTP log/HAR excerpt of our 7 APIs: `POST /api/login`, `GET /api/products?search=...`, `GET /api/products/:id`, `POST /api/apply-coupon`, `POST /api/checkout`, `GET /api/orders/my-orders`, `POST /api/admin/import-products`. Write a realistic mixed-workload k6 script for a baseline load of 50 VUs for 5 minutes with this distribution: 70% search/list, 25% product detail, and 5% checkout. Include SLO thresholds: P95 < 500ms and error rate < 1%."*

Lưu kết quả đầu tiên của AI vào file `ai_generated_raw.js`.

#### 3.2. Kiểm toán kịch bản AI (Critical Audit - Dùng Template 4 của môn học)
Bạn kiểm tra file `ai_generated_raw.js` và ghi nhận lại các lỗi điển hình mà AI thường mắc phải (để đưa vào báo cáo và trình bày trên lớp):
* **Lỗi 1 – Thiếu hoặc sai JWT Correlation:** AI thường gọi thẳng `POST /api/checkout` mà quên truyền header `Authorization: Bearer <token>` lấy từ `POST /api/login`, hoặc bắt người dùng đăng nhập lại ở mọi vòng lặp gây nghẽn API login.
* **Lỗi 2 – Giả định ngầm định sai lệch (Silent Assumptions):** AI dùng chung 1 tài khoản cố định hoặc 1 mã coupon duy nhất cho cả 50–500 VUs khi checkout, dẫn đến lỗi nghiệp vụ (400/409 Conflict) làm sai lệch tỷ lệ Error Rate của hệ thống.
* **Lỗi 3 – Phân phối tải thiếu thực tế (Unrealistic Pacing / Missing Think Time):** AI quên thêm `sleep()` (think time) giữa các thao tác của người dùng hoặc dùng `sleep(1)` cứng nhắc khiến các request dồn cục đồng bộ (synchronized bursts).
* **Lỗi 4 – Cú pháp hoặc thư viện không tương thích:** AI đôi khi import các module của Node.js (`axios`, `fs`) vốn không chạy được trên runtime Go/JS của k6.

#### 3.3. Tinh chỉnh thành bộ 4 kịch bản chuẩn (`ai_audited_refined.js`)
Sau khi audit, bạn chỉnh sửa lại code để chạy 4 kịch bản thực nghiệm của nhóm:
1. **Smoke Test (`smoke_test.js`):** 1–2 VUs trong 1 phút, chạy tuần tự Login $\rightarrow$ Search $\rightarrow$ Product Detail $\rightarrow$ Checkout để xác nhận JWT correlation, đọc file CSV và `check()` hoạt động đúng.
2. **Baseline Load (`baseline_load.js`):** 50 VUs trong 5 phút với tỷ lệ $70\%$ search/list, $25\%$ product detail, $5\%$ checkout.
3. **Spike Test (`spike_test.js`):** Sử dụng `ramping-vus` executor:
   * Giữ 50 VUs trong 1 phút.
   * Tăng vọt từ 50 lên 500 VUs trong 30 giây.
   * Duy trì 500 VUs trong 2 phút.
   * Giảm tải về 50/0 VUs và quan sát khả năng hồi phục (recovery) trong 1 phút 30 giây.
   * *(Lưu ý: Mỗi VU dùng 1 account riêng từ CSV và không dùng chung coupon).*
4. **Endurance Test (`endurance_test.js`):** 50 VUs trong 30 phút ($90\%$ search/list, $10\%$ product detail) để theo dõi rò rỉ bộ nhớ (memory leak) và suy giảm hiệu năng theo thời gian.

---

### Bước 4: Chạy kiểm thử, Giám sát tài nguyên & Xuất báo cáo SLO (Milestone M3 & M5)
1. **Thực thi và xuất kết quả JSON/HTML:**
   ```bash
   k6 run --out json=baseline_results.json baseline_load.js
   ```
2. **Đo CPU & RAM của EShop Backend:**
   * Trong lúc k6 đang chạy, mở một cửa sổ Terminal thứ hai để theo dõi mức chiếm dụng CPU và RAM của tiến trình Node.js (trên Windows dùng `Task Manager` / `Performance Monitor` hoặc `Get-Process node`; trên Linux/macOS dùng `top` / `htop` / `ps`).
   * Ghi nhận xem CPU trung bình có $< 80\%$ và RAM cuối bài baseline có $< 300\text{ MB}$ hay không.
3. **Ghi nhận Bottleneck đặc thù của SQLite:**
   * Khi chạy Spike Test (500 VUs) với các luồng `POST /api/checkout`, cơ sở dữ liệu **SQLite (single connection)** sẽ xảy ra hiện tượng khóa ghi (`SQLITE_BUSY: database is locked` / lock contention). Hãy chụp lại log lỗi này làm minh chứng đắt giá cho phần phân tích Bottleneck.
4. **Tổng hợp Báo cáo SLO 1 trang (`SLO_Report.md`):**
   * Lập bảng thống kê $P50$, $P95$, $P99$, Throughput ($\text{req/s}$), Error Rate ($\%$) theo từng endpoint và đối chiếu với 5 tiêu chí SLO để kết luận Pass/Fail.

---

## 3. Giai đoạn S4: Viết `User_Guide.md` & Quay Video Demo

### 3.1. Nội dung phần k6 & AI bạn cần viết trong `User_Guide.md` (Bằng tiếng Anh)
Phối hợp với Phú (JMeter) và Tuấn (Locust) để hoàn thiện file `User_Guide.md` gồm 7 mục bắt buộc. Trong đó bạn viết chi tiết cho k6 & AI ở các mục:
* **Section 2 – Installation:** Lệnh cài đặt k6 trên Windows/macOS/Linux kèm $\ge 1$ ảnh chụp màn hình.
* **Section 3 – First Test (End-to-end on EShop in $\le 15$ steps):** Hướng dẫn từng bước từ lúc xuất file HAR trên EShop, dùng ChatGPT chuyển thành k6 script, thêm `check()` và chạy lệnh `k6 run`.
* **Section 4 – Advanced Usage:** Cấu hình `scenarios` (`ramping-vus`, `constant-arrival-rate`), đọc dữ liệu từ CSV với `SharedArray`, thiết lập `thresholds` và xuất báo cáo.
* **Section 5 – Troubleshooting:** Nêu ít nhất 3 lỗi thực tế khi dùng k6 trên EShop và cách khắc phục (ví dụ: lỗi mất JWT token do không parse JSON, lỗi trùng lặp dữ liệu khi nhiều VU dùng chung tài khoản, lỗi cổng kết nối/timeout khi chạy tải cao).
* **Section 6 – Failure Modes (BẮT BUỘC – Tránh bị trừ điểm tự động):**
  Trình bày ít nhất 3 tình huống k6 hoặc kịch bản do AI sinh ra báo kết quả gây hiểu lầm (theo cấu trúc *Trigger $\rightarrow$ Symptom $\rightarrow$ Detection $\rightarrow$ Mitigation*):
  1. **Coordinated Omission / VU Starvation trong Closed Model (`ramping-vus`):** Khi backend EShop bị chậm do khóa SQLite, các VU bị kẹt chờ phản hồi nên tổng số request gửi đi giảm mạnh. Công cụ báo lỗi thấp nhưng thực tế thông lượng (throughput) đã sụt giảm nghiêm trọng.
  2. **Silent HTTP 200 Errors (False Positives):** API trả về HTTP 200 kèm nội dung báo lỗi trong JSON (hoặc trang thông báo lỗi), nếu chỉ kiểm tra `r.status === 200` mà không kiểm tra body thì k6 vẫn báo $0\%$ lỗi.
  3. **Load Generator CPU/Port Exhaustion (Ephemeral Port Exhaustion):** Khi chạy 500 VUs ngay trên cùng một máy local với EShop SUT, máy tính bị quá tải CPU hoặc cạn kiệt cổng kết nối TCP tạm thời, làm tăng độ trễ $P95/P99$ giả tạo không phải do lỗi của ứng dụng.

### 3.2. Quay phần video `Demo_Screencast.mp4`
* **Quy chuẩn bắt buộc:** Terminal và IDE (VS Code) phải chỉnh sang **giao diện sáng (Light Theme – nền trắng, chữ đen, cỡ chữ to rõ)**, không chèn nhạc nền, thuyết minh bằng **tiếng Anh**.
* **Kịch bản quay phần của bạn (~2.5 – 3 phút trong tổng 5–8 phút của nhóm):**
  1. *Demo cài đặt & cơ bản:* Chạy `k6 version` và thực thi nhanh kịch bản `smoke_test.js` trên EShop.
  2. *Demo AI-Augmented Workflow:* Chiếu nhanh đoạn Prompt tạo script từ HAR bằng ChatGPT $\rightarrow$ chỉ ra lỗi trong script AI sinh ra $\rightarrow$ chạy bản `baseline_load.js` và `spike_test.js` đã được tinh chỉnh (có Data-driven CSV và Checkpoints/Thresholds) $\rightarrow$ phân tích bảng kết quả xuất ra trên Terminal.

---

## 4. Giai đoạn S5 & S6: Thiết kế `Activity_Worksheet.md` & Điều phối Live Seminar

### 4.1. Soạn `Activity_Worksheet.md` cho hoạt động "Workload Model Bake-off"
Bạn chịu trách nhiệm chuẩn bị phiếu bài tập và kịch bản chạy thử cho hoạt động 20 phút trên lớp (nộp lên Moodle trước buổi seminar ít nhất 3 ngày làm việc):
* **Bối cảnh bài tập:** Các nhóm khán giả (3–4 SV/nhóm) đóng vai kỹ sư hiệu năng thiết kế mô hình phân bổ tải (`%-mix` cho Search, Product Detail, Cart/Coupon, Checkout) cho ngày hội mua sắm **EShop Black Friday**.
* **Cấu trúc thời gian trong Worksheet (20–25 phút):**
  * `0:00 – 0:03`: Bạn giới thiệu sơ đồ trang EShop, các API và quy tắc hoạt động.
  * `0:03 – 0:12`: Các nhóm thảo luận, dùng AI gợi ý và điền tỷ lệ phần trăm (`%-mix`) mỗi phút cho từng hành vi người dùng vào bảng trong Worksheet kèm lý giải nghiệp vụ.
  * `0:12 – 0:17`: Các nhóm gửi mô hình phân bổ tải của mình lên bảng; bạn tổng hợp và chọn ra mô hình hợp lý/thú vị nhất.
  * `0:17 – 0:22`: Bạn nhập trực tiếp bộ tỷ lệ `%` của nhóm thắng cuộc vào biến môi trường của k6 và chạy **Dry-run trực tiếp trên màn hình chiếu**:
    ```bash
    k6 run -e SEARCH_PCT=65 -e DETAIL_PCT=25 -e CHECKOUT_PCT=10 bakeoff_runner.js
    ```
  * `0:22 – 0:25`: Cùng cả lớp đọc kết quả $P95$, Error Rate trên màn hình và mỗi nhóm ghi lại 1 giả định mà họ muốn thay đổi sau khi thấy kết quả chạy thật.

### 4.2. Nhiệm vụ của bạn trong 45 phút Live Seminar (Stage S6)
* **Phút 10 – 20 (Cùng Phú thực hiện Live Demo - 10 phút):**
  * Sau khi Phú demo nhanh JMeter (khoảng 4–5 phút), bạn mở **Terminal & VS Code thật** (tuyệt đối không phát video quay sẵn) để demo luồng **ChatGPT + k6** trên EShop trong 5 phút tiếp theo.
  * Trình diễn trực tiếp sự khác biệt giữa script thô do AI tạo ra và script đã được kiểm toán chạy với 50 VUs.
* **Phút 20 – 40 (Vai trò Facilitator chính - 20 phút):**
  * Trực tiếp điều phối hoạt động **"Workload Model Bake-off"** theo đúng kịch bản trong `Activity_Worksheet.md`.

---

## 5. Giai đoạn S7 & S8: Hồ sơ Kiểm toán AI (`[AI-02]` & `[AI-03]`)

Trong vòng 5 ngày làm việc sau buổi Seminar, nhóm phải nộp gói AI Audit. Với vai trò **Technical & AI Lead**, bạn thực hiện:
1. **Phụ trách chính biểu mẫu `[AI-03] AI Disclosure`:**
   * Điền đầy đủ thông tin công cụ AI đã sử dụng (ChatGPT, phiên bản, mục đích sử dụng trong từng giai đoạn từ S1 đến S6) vào template tiếng Anh của môn học.
   * Nhắc nhở và thu thập đủ chữ ký thật trên file PDF của cả 3 thành viên (Phú, Phát, Tuấn).
2. **Cung cấp dữ liệu kiểm toán kỹ thuật cho Phú viết `[AI-02] AI Audit Report` ($\ge 600$ từ):**
   * Chuyển cho Phú toàn bộ lịch sử Prompt (Prompt summary), đoạn code AI sinh ra ban đầu và danh sách các lỗi bạn đã phát hiện/sửa chữa (factual errors, missing edge cases, silent assumptions) kèm số dòng cụ thể.

---

## 6. Checklist tự kiểm tra cá nhân trước các cột mốc quan trọng

* [ ] Đã cài đặt `k6` và chạy thành công trên hệ thống EShop local.
* [ ] Đã xuất được file `eshop_session.har` từ trình duyệt khi thao tác trên EShop.
* [ ] Bộ script k6 đã có đủ 3 yếu tố: **Record & Playback** (từ HAR), **Data-driven** (`SharedArray` đọc CSV) và **Checkpoints** (`check()` + `thresholds`).
* [ ] Đã lưu lại bản script gốc do ChatGPT sinh ra và bản script đã qua kiểm toán (Audit) để chứng minh năng lực kiểm chứng AI.
* [ ] Đã chạy đủ Smoke Test, Baseline Load (50 VUs), Spike Test (50 $\rightarrow$ 500 VUs) và thu thập đủ số liệu cho **SLO Report 1 trang**.
* [ ] Đã viết xong phần `k6 + AI` và mục **Failure Modes** ($\ge 3$ lỗi sai lệch) bằng tiếng Anh trong `User_Guide.md`.
* [ ] Đã quay xong phần video demo `k6 + AI` với nền trắng chữ đen, thuyết minh tiếng Anh rõ ràng.
* [ ] Đã chuẩn bị sẵn script `bakeoff_runner.js` nhận tham số từ CLI và hoàn thiện `Activity_Worksheet.md` kèm đáp án.
* [ ] Đã lưu đầy đủ lịch sử Prompt (không chứa MSSV, mật khẩu thật hay khóa bí mật) để hoàn thiện hồ sơ `[AI-02]` và `[AI-03]`.