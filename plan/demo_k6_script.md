# HỒ SƠ QUY TRÌNH THỰC NGHIỆM & KỊCH BẢN DEMO ĐỒ ÁN (END-TO-END DEMO PROTOCOL)
## ĐỀ TÀI T05: PERFORMANCE TESTING – GRAFANA K6 & AI WORKFLOW
**Môn học:** Kiểm thử phần mềm (CS423 / CSC15003) – FIT@HCMUS  
**Khóa học:** 2026 AI-First Edition  
**Sinh viên phụ trách k6 + AI:** Trương Thành Phát (MSSV: 23120319 – Technical & AI Lead)  
**Hệ thống SUT:** EShop (Node.js + Express + SQLite) tại `http://localhost:3000`  

---

## I. TỔNG QUAN LUỒNG THỰC HIỆN THỰC CHIẾN (END-TO-END PIPELINE)

Toàn bộ quá trình thực nghiệm của nhóm không tách rời thành các phần lý thuyết rời rạc, mà được xâu chuỗi thành một **luồng làm việc kỹ thuật duy nhất và liền mạch (Unified Pipeline)** gồm 7 bước. Ở mỗi bước, kịch bản đều được chú thích rõ ràng việc **đáp ứng trực tiếp yêu cầu nào trong Rubric của Thầy** (`seminar-general-requirement.pdf` và `T05_Performance_Testing.docx.pdf`):

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        LUỒNG LÀM VIỆC THỰC NGHIỆM KIỂM THỬ TẢI k6 + AI WORKFLOW                        │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │
[BƯỚC 1] Khởi động môi trường & Kiểm tra k6 ────────┤ 🏷️ Đáp ứng: Demo Cài đặt công cụ (Installation)
                                                    │
[BƯỚC 2] Thu thập Session thực tế qua HAR ──────────┤ 🏷️ Đáp ứng: Thành phần 1 (Record & Playback)
                                                    │
[BƯỚC 3] Ứng dụng AI sinh kịch bản k6 thô ──────────┤ 🏷️ Đáp ứng: Ứng dụng AI (AI-Augmented Prompting)
                                                    │
[BƯỚC 4] Kiểm toán Phản biện & Bắt lỗi AI ──────────┤ 🏷️ Đáp ứng: Kiểm toán AI (Human-in-the-loop Audit)
                                                    │
[BƯỚC 5] Tinh chỉnh Data-driven & Checkpoints ──────┤ 🏷️ Đáp ứng: Thành phần 2 (Data-driven) & 3 (Checkpoints)
                                                    │
[BƯỚC 6] Thực thi Smoke Test kiểm tra thông suốt ───┤ 🏷️ Đáp ứng: Kịch bản Cấp 1 (Cài đặt & Sanity Check)
                                                    │
[BƯỚC 7] Thực thi Baseline Load & Đo SLO ───────────┤ 🏷️ Đáp ứng: Kịch bản Cấp 2 (Cơ bản) & Nghiệm thu SLO
                                                    │
[BƯỚC 8] Thực thi Spike Test & Vạch trần SQLite ────┤ 🏷️ Đáp ứng: Kịch bản Cấp 3 (Phức tạp/Stress) & Bottleneck
                                                    │
[BƯỚC 9] Ngâm tải Endurance 30 phút kiểm tra RAM ───┤ 🏷️ Đáp ứng: Kiểm định Độ bền vững & Zero Memory Leak
```

---

## II. CHI TIẾT TỪNG BƯỚC TRONG LUỒNG LÀM VIỆC

### BƯỚC 1: Khởi động môi trường & Kiểm tra phiên bản công cụ (Installation & Version Check)
* **Thao tác thực tế:**
  Mở Terminal tại `k6-eshop`, gõ lệnh kiểm tra phiên bản k6:
     ```powershell
     k6 version
     ```
* **Kết quả quan sát:** Terminal hiển thị thông tin phiên bản k6 chính thức (`k6 v2.2.0 (commit/00a9a1b7f5, windows/amd64)`), xác nhận công cụ đã được cài đặt thành công, binary thực thi sẵn sàng trong biến môi trường PATH mà không cần cấu hình runtime phụ thuộc (như Node.js hay JVM).
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Kịch bản Demo Cấp 1 – Demo cài đặt công cụ.*
  * **[Mục đích kỹ thuật]:** Đảm bảo công cụ k6 đã được cài đặt thành công và môi trường máy trạm sẵn sàng trước khi thực thi kiểm thử.

---

### BƯỚC 2: Thu thập dấu vết mạng người dùng thật (Traffic Capture)
* **Thao tác thực tế:**
  1. Mở trình duyệt (Google Chrome), bật cửa sổ **F12 (Developer Tools) $\rightarrow$ tab Network $\rightarrow$ bật Keep log**.
  2. Thao tác mua hàng thủ công thực tế trên giao diện EShop (`http://localhost:5173`): Đăng nhập bằng tài khoản người dùng (`test@eshop.com` / mật khẩu: `Test1234!`) $\rightarrow$ Tìm kiếm sản phẩm $\rightarrow$ Xem chi tiết $\rightarrow$ Thêm vào giỏ hàng $\rightarrow$ Áp mã giảm giá `SAVE10` $\rightarrow$ Đặt hàng (Checkout) $\rightarrow$ Xem lịch sử đơn.
  3. Xuất toàn bộ phiên làm việc thành tệp **`k6-eshop/eshop_session.har`**.
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Thành phần nền tảng 1 – Record & Playback (Ghi nhận lưu lượng).*
  * **[Mục đích kỹ thuật]:** Thu thập đúng 100% cấu trúc gói tin thực tế (Headers, Cookies, Query Params, JSON Payloads) thay vì tự ngồi gõ thủ công từng API.

---

### BƯỚC 3: Ứng dụng AI sinh kịch bản k6 ban đầu
* **Thao tác thực tế:**
  * Đưa trích đoạn tệp `eshop_session.har` kết hợp tài liệu API của EShop vào mô hình ngôn ngữ lớn (Claude / ChatGPT) kèm Prompt định hướng: 
  
  > *"I am performance testing an EShop backend (Node.js + SQLite) running at http://localhost:3000 using Grafana k6. Here are the main APIs: POST /api/login, GET /api/products?search=..., GET /api/products/:id, POST /api/apply-coupon, POST /api/checkout, GET /api/orders/my-orders. Write a realistic mixed-workload k6 script for a baseline load of 50 VUs for 5 minutes with distribution: 70% search/list, 25% product detail, and 5% checkout. Include SLO thresholds: P95 < 500ms and error rate < 1%.". Write in ai_generated_raw.js"
  * AI sinh ra kịch bản thô ban đầu: **`k6-eshop/ai_generated_raw.js`**.
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Khả năng áp dụng AI vào chủ đề testing (AI-Augmented Testing).*
  * **[Mục đích kỹ thuật]:** Khảo sát khả năng tự động hóa sinh mã kiểm thử từ dữ liệu thô của các mô hình Generative AI.

---

### BƯỚC 4: Kiểm toán kỹ thuật & Phát hiện sai lệch của AI
* **Thao tác thực tế:**
  * Người kiểm thử không chạy mù quáng mà mở đối chiếu mã nguồn của AI sinh ra với mã nguồn máy chủ Backend (`eshop-sut/backend/server.js`).
  * Khi chạy thử bản thô `ai_generated_raw.js`, bài test bị thất bại hàng loạt ($100\%$ lỗi). Quá trình kiểm toán kỹ thuật đã vạch trần **3 lỗi sai ngầm định nghiêm trọng (Silent Assumptions)** của AI:
    1. **Lỗi quy chuẩn Payload:** AI tự ý sinh payload dạng `camelCase` (`userId`, `shippingAddress`), trong khi backend Express bắt buộc `snake_case` (`user_id`, `shipping_address`). Server từ chối $100\%$ đơn hàng với mã lỗi HTTP 400.
    2. **Lỗi thiếu tham số bắt buộc:** Khi gọi `POST /api/apply-coupon`, AI chỉ truyền `{ code: 'SAVE10' }` mà bỏ quên trường `total_amount`, khiến API lập tức văng lỗi HTTP 400.
    3. **Lỗi bỏ quên Data-driven:** AI gán cứng duy nhất 1 tài khoản tĩnh (`user@example.com`), vi phạm chính sách mã giảm giá chỉ dùng 1 lần (`max_uses_per_user = 1`).
    4. **Lỗi bỏ sót API nghiệp vụ cốt lõi:** AI nhảy cóc thẳng từ xem chi tiết sang checkout mà bỏ qua hoàn toàn API giỏ hàng (`POST /api/cart`), làm luồng người dùng mất tính chân thực và bỏ sót việc đo tải cho tầng giỏ hàng.
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Quy trình kiểm toán AI bắt buộc ([AI-02] Human Audit) – Không sao chép trực tiếp mà phải đánh giá phản biện.*
  * **[Yêu cầu Rubric]:** *Nhận diện Chế độ thất bại (Failure Mode 2: Lỗi giả định ngầm định).*

---

### BƯỚC 5: Tinh chỉnh Kịch bản Chuẩn với Data-driven & Checkpoints
* **Thao tác thực tế:**
  * Nhóm tiến hành tái cấu trúc toàn diện mã nguồn để tạo ra tệp chuẩn **`k6-eshop/ai_audited_refined.js`**:
    1. **Sửa toàn bộ Payload:** Chuẩn hóa sang `snake_case` và bổ sung `total_amount: 150000`.
    2. **Tương quan dữ liệu động (Correlation):** Bóc tách `token` từ phản hồi Login để truyền vào Header `Authorization: Bearer <token>`.
    3. **Hiện thực Data-driven:** Viết script `seed_users.js` khởi tạo **601 tài khoản độc lập** vào SQLite và xuất ra `users.csv`. Dùng cấu trúc **`SharedArray`** để nạp dữ liệu vào RAM đúng 1 lần và cấp phát 1:1 cho từng VU:
       ```javascript
       const user = users[(__VU - 1) % users.length];
       ```
    4. **Thiết lập Deep Assertions & SLO Thresholds:** Kiểm tra sâu cấu trúc JSON (`r.json('orderId') !== undefined`) và nhúng khối `thresholds` (`p(95)<500`, `rate<0.01`).
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Thành phần nền tảng 2 – Data-driven Testing (với SharedArray).*
  * **[Yêu cầu Rubric]:** *Thành phần nền tảng 3 – Checkpoints & SLO Thresholds.*

---

### BƯỚC 6: Thực thi Smoke Test kiểm tra thông suốt
* **Thao tác thực tế:**
  * Sau khi hoàn thiện kịch bản tinh chỉnh ở Bước 5, kích hoạt bài kiểm tra nhanh Smoke Test (1 VU, 1 vòng lặp) để xác minh tính sẵn sàng và thông suốt của toàn bộ 7 API trước khi tiến hành bơm tải nặng:
    ```powershell
    k6 run --iterations 1 smoke_test.js
    ```
* **Kết quả quan sát:**
  * 1 VU chạy tuần tự 1 vòng lặp qua 7 API nghiệp vụ (Đăng nhập $\rightarrow$ Tìm kiếm $\rightarrow$ Xem chi tiết $\rightarrow$ Giỏ hàng $\rightarrow$ Áp mã giảm giá $\rightarrow$ Đặt hàng $\rightarrow$ Lịch sử đơn).
  * Toàn bộ **13/13 checkpoints đều hiện dấu tích xanh (✓ 100%)**, tỷ lệ lỗi HTTP $0.00\%$.
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Kịch bản Demo Cấp 1 – Demo cài đặt và chức năng khởi đầu.*
  * **[Yêu cầu Rubric]:** *Mức độ tự động hóa hoàn toàn (Fully automated execution).*
  * **[Mục đích kỹ thuật]:** Đảm bảo môi trường và kịch bản đã sẵn sàng, 7 API thông suốt 100% trước khi tiến hành bơm tải nặng.

---

### BƯỚC 7: Thực thi Kịch bản Cơ bản & Nghiệm thu SLO (Baseline Load Testing)
* **Thao tác thực tế:**
  * Chạy kịch bản cơ bản mô phỏng lưu lượng vận hành ngày thường theo mô hình thực tế **70% Tìm kiếm - 25% Xem chi tiết - 5% Đặt hàng**, có thời gian suy nghĩ Think time 1–3s:
    ```powershell
    k6 run --out json=baseline_results_new.json baseline_load.js
    ```
  *(Trong buổi Live Demo trên lớp, chạy bản rút gọn 30 VUs trong 30 giây để không mất thời gian chờ).*
* **Kết quả đo đạc chính thức:**
  * **7,597 requests**, thông lượng duy trì đều đặn **$25.10\text{ req/s}$**.
  * **Checks đạt 100.00%** (14,860 / 14,860), **Tỷ lệ lỗi $0.00\%$**.
  * **P95 toàn cục = $3.76\text{ ms}$** (vượt xa mức trần cam kết $< 500\text{ ms}$).
  * Đặt hàng thành công: **332 / 332 đơn hàng ($100\%$)**.
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Kịch bản Demo Cấp 2 – Demo các chức năng cơ bản.*
  * **[Yêu cầu Rubric]:** *Nghiệm thu ĐẠT (PASS) cả 5 chỉ tiêu cam kết chất lượng dịch vụ (SLO).*

---

### BƯỚC 8: Thực thi Kịch bản Phức tạp & Vạch trần Điểm nghẽn SQLite (Spike & Stress Testing)
* **Thao tác thực tế:**
  * Đẩy tải đột biến từ 50 lên 500 VUs trong 30 giây (gấp 10 lần tải), duy trì 2 phút ở đỉnh tải 500 VUs để mô phỏng sự kiện Flash Sale Black Friday:
    ```powershell
    k6 run --out json=spike_results_new.json spike_test.js
    ```
* **Kết quả kỹ thuật đắt giá ghi nhận được:**
  * Hệ thống chịu tải xuất sắc, xử lý thành công **60,032 requests** (Thông lượng đỉnh đạt **$200.1\text{ req/s}$**), tạo thành công **2,653 đơn hàng**, tỷ lệ lỗi giữ vững **$0.00\%$**, tự phục hồi hoàn toàn sau khi hạ tải.
  * **Vạch trần điểm nghẽn kiến trúc SQLite:**
    * Các API Đọc (`search`, `detail`): $P95$ chỉ là $1.8\text{ ms} - 2.4\text{ ms}$.
    * Riêng API Ghi (`checkout`): $P95$ tăng vọt lên **$34.78\text{ ms}$**, $P99$ đạt **$42.64\text{ ms}$** và Max chạm **$70.50\text{ ms}$**.
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Kịch bản Demo Cấp 3 – Demo các luồng xử lý phức tạp & Stress Test.*
  * **[Yêu cầu Rubric]:** *Xác định và phân tích nguyên nhân gốc rễ của điểm nghẽn (Bottleneck Analysis) – Cơ chế khóa ghi đơn luồng (Single-writer Lock) của SQLite.*

---

### BƯỚC 9: Kiểm định Độ bền & Rò rỉ Bộ nhớ (Endurance Testing)
* **Thao tác thực tế (Mở song song 2 Terminal):**
  1. **Terminal 1: Khởi động công cụ giám sát tài nguyên phần cứng Server (CPU & RAM):**
     * Chạy script PowerShell tự động nhận diện PID Backend Node.js tại cổng 3000, lấy mẫu thông số mỗi 2 giây và ghi dữ liệu ra tệp `server_hardware_metrics.csv`:
       ```powershell
       # Terminal 1: Bật giám sát CPU & RAM thời gian thực
       .\monitor_server.ps1
       ```
     * *(Hoặc dùng lệnh PowerShell trực tiếp không cần script:)*
       ```powershell
       while($true) { Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Select-Object Id, CPU, @{N='RAM(MB)';E={[math]::Round($_.WS/1MB,2)}}; Start-Sleep 2 }
       ```
  2. **Terminal 2: Kích hoạt kiểm thử ngâm tải k6 (Endurance Test):**
     * Ngâm tải liên tục 50 VUs trong suốt 30 phút theo tỷ lệ đọc chiếm chủ đạo (90% Search, 10% Detail):
       ```powershell
       # Terminal 2: Chạy k6 Endurance Test
       k6 run --out json=endurance_results_new.json endurance_test.js
       ```
     *(Trong buổi Live Demo trên lớp, có thể chạy bản rút gọn 30 VUs trong 30 giây với `--vus 30 --duration 30s` để quan sát ngay sự biến thiên và giải phóng RAM).*

* **Kết quả kỹ thuật ghi nhận được:**
  * **Thông số tải k6:** Xử lý liên tục **43,454 requests**, 100% checks thành công (86,856 / 86,856), tỷ lệ lỗi **$0.00%$**, $P95 = 1.70\text{ ms}$ duy trì phẳng lì suốt thời gian chạy.
  * **Chỉ số CPU máy chủ:** CPU trung bình chỉ **$0.24%$** (đỉnh cao nhất chỉ **$0.90%$**), chứng minh Backend xử lý bất đồng bộ I/O tối ưu.
  * **Hành vi Bộ nhớ RAM:** Bộ nhớ Node.js dao động ổn định trong khoảng hẹp **$87.5\text{ MB} \rightarrow 97.6\text{ MB}$**, sau khi dừng tải lập tức giải phóng về **$96.16\text{ MB}$** nhờ cơ chế Garbage Collection của V8 Engine $\rightarrow$ Chứng minh tuyệt đối hệ thống **không bị rò rỉ bộ nhớ (Zero Memory Leak)**.

---

### BƯỚC 10: Trình bày Điểm yếu & 3 Chế độ Thất bại của Công cụ (Failure Modes)
* **4 Điểm yếu cốt lõi của công cụ k6:**
  1. **Không có giao diện đồ họa trực quan (No Built-in GUI):**
     * k6 thuần túy là công cụ dòng lệnh (CLI). Khác với JMeter cung cấp giao diện đồ họa hoàn chỉnh để người kiểm thử kéo thả kịch bản và xem đồ thị tức thì, k6 đòi hỏi người dùng bắt buộc phải có kỹ năng lập trình JavaScript.
     * Để có biểu đồ giám sát trực quan thời gian thực, người dùng buộc phải cấu hình đẩy dữ liệu ra các hệ thống bên thứ ba phức tạp như Prometheus, InfluxDB và Grafana Dashboard.
  2. **Chỉ kiểm thử tầng giao thức, không mô phỏng hiển thị trình duyệt (Protocol-level Only):**
     * Theo mặc định, k6 chỉ gửi và nhận các gói tin ở tầng mạng HTTP/HTTPS/WebSockets. Công cụ không thực thi mã JavaScript phía Client (React/Vue), không tải toàn bộ ảnh/CSS và không render cây giao diện DOM.
     * Do đó, k6 chỉ phản ánh năng lực xử lý của máy chủ Backend API, không đo lường được các chỉ số trải nghiệm người dùng đầu cuối (User Experience Metrics) như First Contentful Paint (FCP) hay Largest Contentful Paint (LCP).
  3. **Hạn chế về hệ sinh thái giao thức truyền thống so với JMeter:**
     * k6 tập trung tối ưu cho các giao thức Web/API hiện đại (HTTP/1.1, HTTP/2, WebSockets, gRPC).
     * k6 không hỗ trợ sẵn các giao thức doanh nghiệp và dịch vụ truyền thống như Apache JMeter (kết nối trực tiếp cơ sở dữ liệu qua JDBC, hàng đợi tin nhắn JMS, FTP, SMTP mail server hay LDAP). Khi cần kiểm thử hiệu năng trực tiếp cho Database hay Message Broker, k6 đòi hỏi phải viết thêm extension bằng mã Go phức tạp.
  4. **Không tự động thu thập được chỉ số phần cứng nội tại của Server (Server-side Resource Metrics):**
     * k6 chỉ đóng vai trò là bên gửi tải từ bên ngoài (Black-box load generator) nên chỉ đo được thời gian phản hồi và tỷ lệ lỗi mạng. Các yêu cầu thu thập CPU Usage (< 80%), Memory Usage (< 300 MB) và DB Query Time của máy chủ EShop trong Proposal không thể lấy trực tiếp từ k6 mà bắt buộc phải kết hợp thêm công cụ giám sát hệ thống độc lập trên máy chủ.
* **3 Chế độ Thất bại (Failure Modes) theo chuẩn Trigger - Symptom - Detection - Mitigation:**
  1. **Failure Mode 1 (Coordinated Omission trong Closed Model):** Server chậm khiến k6 tự động giảm tốc độ bắn request, báo cáo 0% lỗi che giấu sự sụt giảm thông lượng. *(Khắc phục: Giám sát Throughput hoặc dùng Open Model `constant-arrival-rate`)*.
     * **Thao tác 1: Chạy Closed Model để thấy cạm bẫy Coordinated Omission:**
       ```powershell
       k6 run failure_mode1_demo.js
       ```
     * **Thao tác 2: Chạy Open Model để thấy lượng tải thực tế:**
       ```powershell
       k6 run -e MODE=open failure_mode1_demo.js
       ```
  2. **Failure Mode 2 (Lỗi Silent HTTP 200):** Server trả mã 200 nhưng body chứa lỗi nghiệp vụ. *(Khắc phục: Viết Deep Assertions kiểm tra `orderId`)*.
  3. **Failure Mode 3 (Nghẽn cổng mạng máy phát tải):** Chạy 500 VUs local làm nghẽn socket TCP `TIME_WAIT` của Windows, gây hiểu lầm server bị chậm. *(Khắc phục: Tinh chỉnh registry socket hoặc tách máy test)*.
     * **Thao tác 1: Chạy k6 tắt Keep-Alive:**
       ```powershell
       k6 run failure_mode3_demo.js
       ```
     * **Thao tác 2: Kiểm tra số lượng cổng TIME_WAIT bị kẹt:**
       ```powershell
       netstat -ano | findstr 3000 | findstr TIME_WAIT | measure-object -line
       ```
* 🏷️ **CHÚ THÍCH ĐÁP ỨNG RUBRIC:**
  * **[Yêu cầu Rubric]:** *Chỉ rõ những trường hợp công cụ có điểm yếu, không giải quyết tốt mục tiêu đặt ra & 3 Chế độ thất bại (bắt buộc theo Rubric T05).*

---