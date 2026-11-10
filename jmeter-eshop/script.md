# KỊCH BẢN THUYẾT TRÌNH & DEMO KIỂM THỬ HIỆU NĂNG VỚI APACHE JMETER (SEMINAR SCRIPT)

* **Môn học:** Kiểm thử phần mềm (CS423 / CSC15003) – FIT@HCMUS
* **Chủ đề:** T05 - Performance Testing (Seminar Nhóm 07)
* **Hệ thống kiểm thử (SUT):** EShop Backend (`http://localhost:3000`)
* **Công cụ báo cáo:** Apache JMeter v5.6.3 + Script Giám sát Phần cứng tự phát triển (`monitor_server.ps1`)
* **Thời lượng thuyết trình & demo dự kiến:** 10 – 15 phút

---

## 📑 MỤC LỤC KỊCH BẢN

- [I. Chuẩn bị Môi trường Demo Trước Giờ G (Checklist)](#i-chuẩn-bị-môi-trường-demo-trước-giờ-g-checklist)
- [II. Từ điển Khái niệm Nhanh để Giải thích Trước Lớp (Cheat Sheet)](#ii-từ-điển-khái-niệm-nhanh-để-giải-thích-trước-lớp-cheat-sheet)
- [III. Các "Điểm Nóng Lý Thuyết" Đắt Giá để Nói Lúc Demo](#iii-các-điểm-nóng-lý-thuyết-đắt-giá-để-nói-lúc-demo)
  - [1. Vì sao lại lấy kết quả Baseline Test để làm Báo cáo SLO?](#1-vì-sao-lại-lấy-kết-quả-baseline-test-để-làm-báo-cáo-slo)
  - [2. Trong Spike Test đã bao hàm Stress Test như thế nào? (Mô hình 4 giai đoạn)](#2-trong-spike-test-đã-bao-hàm-stress-test-như-thế-nào-mô-hình-4-giai-đoạn)
  - [3. Endurance Test: Vì sao phải "ngâm tải" và điểm yếu cố hữu của JMeter/k6?](#3-endurance-test-vì-sao-phải-ngâm-tải-và-điểm-yếu-cố-hữu-của-jmeterk6)
- [IV. Quy trình Thực chiến Demo 4 Bước (Kèm Lời thoại Speaker Notes)](#iv-quy-trình-thực-chiến-demo-4-bước-kèm-lời-thoại-speaker-notes)
  - [Bước 1: Demo Smoke Test trên GUI (Trực quan hóa 3 Trụ cột & Token Correlation)](#bước-1-demo-smoke-test-trên-gui-trực-quan-hóa-3-trụ-cột--token-correlation)
  - [Bước 2: Demo Baseline Load Test trên CLI & Nghiệm thu Báo cáo SLO](#bước-2-demo-baseline-load-test-trên-cli--nghiệm-thu-báo-cáo-slo)
  - [Bước 3: Demo Spike Test & Bắt điểm nghẽn Database Lock SQLite](#bước-3-demo-spike-test--bắt-điểm-nghẽn-database-lock-sqlite)
  - [Bước 4: Demo Endurance Test & Tự động xuất Báo cáo Giám sát RAM/CPU HTML](#bước-4-demo-endurance-test--tự-động-xuất-báo-cáo-giám-sát-ramcpu-html)
- [V. Bảng Tóm tắt Câu hỏi Dự kiến Giảng viên & Cách Phản biện (Q&A Defense)](#v-bảng-tóm-tắt-câu-hỏi-dự-kiến-giảng-viên--cách-phản-biện-qa-defense)

---

## I. CHUẨN BỊ MÔI TRƯỜNG DEMO TRƯỚC GIỜ G (CHECKLIST)

Để buổi demo diễn ra trơn tru, không bị lỗi "chết server" hoặc xung đột cổng trước mặt Thầy và lớp, hãy chuẩn bị sẵn **3 cửa sổ PowerShell** chia màn hình:

```text
┌──────────────────────────────────────┬──────────────────────────────────────┐
│  CỬA SỔ 1 (Bật Backend SUT)          │  CỬA SỔ 2 (Giám sát Phần cứng)       │
│  cd eshop-sut/backend                │  cd jmeter-eshop                     │
│  npm start                           │  .\monitor_server.ps1 -AutoOpen      │
├──────────────────────────────────────┴──────────────────────────────────────┤
│  CỬA SỔ 3 (Thực thi JMeter CLI & Mở GUI Debug)                              │
│  cd jmeter-eshop                                                            │
│  jmeter (Mở GUI sẵn) hoặc chạy các lệnh CLI                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

* **Check 1:** Mở trình duyệt gõ `http://localhost:3000/api/products` thấy JSON trả về $\rightarrow$ Backend đã sẵn sàng.
* **Check 2:** Cửa sổ JMeter GUI đã mở sẵn file [`smoke_test.jmx`](./smoke_test.jmx) và chọn sẵn tab `View Results Tree`.
* **Check 3:** Đã dọn dẹp các thư mục kết quả cũ nếu có:
  ```powershell
  Remove-Item -Recurse -Force results_smoke, results_baseline, results_spike, results_endurance -ErrorAction SilentlyContinue
  ```

---

## II. TỪ ĐIỂN KHÁI NIỆM NHANH ĐỂ GIẢI THÍCH TRƯỚC LỚP (CHEAT SHEET)

Khi thuyết trình, hãy dùng các thuật ngữ chuẩn quốc tế dưới đây để ghi điểm chuyên môn:

1. **Virtual User (VU) vs Thread:**
   * Trong JMeter, **1 VU tương ứng với 1 Java Thread vật lý** của JVM. JMeter áp dụng mô hình Thread-based (khác với k6 dùng Goroutines siêu nhẹ).
2. **Ramp-up Time (Thời gian gia nhiệt):**
   * Thời gian để toàn bộ số luồng được kích hoạt từ từ. Ví dụ: 50 VUs với Ramp-up 30s nghĩa là cứ mỗi giây sẽ có khoảng 1.67 user mới tham gia vào hệ thống, tránh tạo sốc tải ngay giây đầu tiên.
3. **Think Time & Jitter:**
   * Thời gian nghỉ ngơi của người dùng thật giữa các cú click (đọc nội dung, suy nghĩ). Nhóm sử dụng `UniformRandomTimer` (ngẫu nhiên 500ms - 1500ms) để tải không bị rập khuôn đều đặn như robot.
4. **Throughput (TPS / RPS):**
   * Số lượng giao dịch (Transactions Per Second) hoặc request mà server xử lý thành công trong 1 giây.
5. **Latency vs Response Time:**
   * **Latency (Độ trễ mạng):** Thời gian từ khi gửi byte đầu tiên đến khi nhận được byte đầu tiên từ server.
   * **Response Time (Thời gian phản hồi đầy đủ):** Thời gian tính từ lúc bắt đầu gửi request cho đến khi client nhận được byte dữ liệu cuối cùng của response.
6. **Percentiles ($P_{50}, P_{90}, P_{95}, P_{99}$ - Bách phân vị):**
   * Trong kiểm thử hiệu năng chuyên nghiệp, **tuyệt đối không dùng giá trị Trung bình (Average / Mean)** để đánh giá chất lượng dịch vụ, mà bắt buộc phải dùng **Percentiles (Bách phân vị)**.
   * **Vì sao con số Trung bình (Average) là "kẻ nói dối" (The Flaw of Averages)?**
     - *Ví dụ chứng minh:* Giả sử ta gửi 100 requests lên EShop:
       + 99 requests phản hồi siêu nhanh trong **$10\text{ ms}$**.
       + Đúng 1 request duy nhất bị nghẽn mạng hoặc đơ mất **$10.000\text{ ms}$** (10 giây).
     - *Công thức tính trung bình:*
       $$\text{Average} = \frac{99 \times 10 + 10.000}{100} = 109.9\text{ ms}$$
     - *Nghịch lý:* Nhìn vào con số **$109.9\text{ ms}$**, ban quản lý hoặc khách hàng sẽ lầm tưởng hệ thống chạy rất mượt ($< 500\text{ ms}$). Nhưng thực tế, **đã có 1 vị khách hàng bị "đứng hình" suốt 10 giây và thoát web bỏ mua hàng!** Số trung bình đã xóa mờ và che giấu hoàn toàn trải nghiệm tồi tệ của khách hàng đó (hiện tượng **Outlier** / **Long-tail latency**).
   * **Percentile (Bách phân vị) giải quyết bài toán này ra sao?**
     - Công cụ kiểm thử (k6, JMeter) thu thập toàn bộ thời gian phản hồi của mọi request, sau đó **sắp xếp theo thứ tự tăng dần từ nhanh nhất đến chậm nhất** trên thang đo từ $0\%$ đến $100\%$:
     ```text
     [ Nhanh nhất ] -------------------- [ P50 ] ------------ [ P95 ] --- [ P99 ] - [ Chậm nhất ]
          1ms                             5ms                  25ms        150ms        2000ms
                                           ^                    ^            ^
                                    50% người dùng        95% người dùng   1% khách hàng
                                    thấy nhanh hơn        thấy nhanh hơn   chịu chậm nhất
     ```
   * **Ý nghĩa từng mốc bách phân vị chuẩn:**
     - **$P_{50}$ (50th Percentile / Median - Trung vị):**
       + Mốc thời gian nằm chính giữa danh sách (vị trí $50\%$).
       + *Ý nghĩa:* Đại diện cho **trải nghiệm của người dùng phổ thông**. $50\%$ số lượt truy cập có tốc độ nhanh hơn hoặc bằng con số này. Khác với Average, $P_{50}$ hoàn toàn miễn nhiễm với các request bị đột biến cá biệt ở 2 đầu cực.
     - **$P_{90} / P_{95}$ (95th Percentile - Chuẩn vàng đo cam kết dịch vụ SLO/SLA):**
       + Mốc thời gian của request nằm ở vị trí $95\%$.
       + *Ý nghĩa:* **$95\%$ tổng số request của người dùng có tốc độ phản hồi nhanh hơn con số này**, chỉ có duy nhất $5\%$ các request chậm nhất vượt qua mốc này.
       + *Tại sao các Big Tech (Google, Amazon, Microsoft) chọn $P_{95}$ làm thước đo SLO chuẩn?* Vì $P_{95}$ loại trừ được 5% nhiễu ngẫu nhiên (nấc mạng chập chờn của ISP, thiết bị client yếu), nhưng vẫn bảo vệ được 95% đại đa số khách hàng. Trong đồ án môn học FIT@HCMUS, chuẩn SLO bắt buộc là:
         $$\mathbf{P_{95} < 500\text{ ms}}$$
     - **$P_{99}$ (99th Percentile - Trải nghiệm cận biên xấu nhất / Worst-case Tail Latency):**
       + Mốc thời gian nằm ở vị trí $99\%$, đại diện cho **$1\%$ khách hàng chịu trải nghiệm chậm chạp và tồi tệ nhất** trên hệ thống.
       + *Kỹ sư hiệu năng xem $P_{99}$ để làm gì?* $P_{99}$ là **"chiếc kính lúp"** giúp phát hiện sớm các quả bom nổ chậm trong backend:
         1. Tiến trình dọn rác bộ nhớ (*V8 Garbage Collection Stop-the-world pauses*) của Node.js làm khựng luồng Event Loop.
         2. Hiện tượng nghẽn hàng đợi (*Queue backlog*) và tranh chấp khóa ghi SQLite (`SQLITE_BUSY: database is locked`) khi nhiều user cùng checkout đồng thời.
         3. Hiện tượng cạn kiệt Connection Pool hoặc TCP Socket exhaustion.
   * **Quan sát ở đâu trong JMeter?**
     - Trong bảng HTML Report dashboard của JMeter (`results_baseline/dashboard/index.html`), mở mục **Statistics** $\rightarrow$ xem trực tiếp 3 cột: **`90th pct`**, **`95th pct`**, **`99th pct`**.
7. **APDEX (Application Performance Index):**
   * Điểm số từ $0.0$ đến $1.0$ đo lường độ hài lòng người dùng. 
   * Với ngưỡng $T = 500\text{ms}$ (Hài lòng) và $F = 1500\text{ms}$ (Thất vọng): Điểm số $\ge 0.85$ là Good, $\ge 0.94$ là Excellent.

---

## III. CÁC "ĐIỂM NÓNG LÝ THUYẾT" ĐẮT GIÁ ĐỂ NÓI LÚC DEMO

Đây là các điểm mấu chốt để trả lời câu hỏi *"Tại sao nhóm lại thiết kế kịch bản như vậy?"*:

### 1. Vì sao lại lấy kết quả Baseline Test để làm Báo cáo SLO?

* **Bản chất của SLO (Service Level Objective):** Là chỉ tiêu cam kết chất lượng dịch vụ mà đội ngũ kỹ thuật đưa ra cho hệ thống trong **điều kiện vận hành bình thường hàng ngày**.
* **Lý do chọn Baseline Test:**
  - Kịch bản Baseline được thiết kế theo **Workload Model thực tế**: $70\%$ người dùng Tìm kiếm $\rightarrow$ $25\%$ Xem chi tiết $\rightarrow$ chỉ $5\%$ Thanh toán.
  - Số lượng 50 VUs duy trì liên tục trong 5 phút phản ánh đúng lưu lượng truy cập giờ cao điểm tiêu chuẩn của EShop.
  - **Không bao giờ dùng Spike hay Stress Test để làm căn cứ SLO:** Vì Spike/Stress là bài test cố tình ép hệ thống vào trạng thái quá tải cực đoan để tìm điểm sập. Cam kết SLA/SLO phải dựa trên trạng thái tải bền vững hàng ngày của doanh nghiệp.

---

### 2. Trong Spike Test đã bao hàm Stress Test như thế nào? (Mô hình 4 giai đoạn)

* **Bản chất mối quan hệ giữa Stress Test và Spike Test:**
  - **Stress Test (Kiểm thử độ chịu tải cực hạn):** Tăng tải vượt xa năng lực thông thường nhằm tìm ra **Breaking Point (Điểm gãy / Điểm sập)** của hệ thống, xem hệ thống suy giảm hiệu năng (degrade) hay sụp đổ (crash) ở đâu.
  - **Spike Test (Kiểm thử sốc tải đột biến):** Không chỉ ép hệ thống chịu mức tải vượt ngưỡng, mà còn ép nó chịu sự **thay đổi gia tốc tải tức thời (Traffic Shock)** trong thời gian cực ngắn (mô phỏng mở bán Flash Sale 12h trưa, săn vé concert, hay mở cổng đăng ký học phần tín chỉ).
  - 👉 **Spike Test chính là Stress Test nhưng ở cấp độ khắc nghiệt và toàn diện hơn:** Thay vì tăng tải từ từ theo bậc thang, Spike Test đưa tải nhảy vọt thẳng lên mức **Stress cực đại (500 VUs - gấp 10 lần ngày thường)**, sau đó **"giam giữ" tải tại đỉnh đó**. Do đó:
    $$\text{Spike Test} = \text{Stress Test (Ép tìm điểm gãy)} + \text{Sốc tải tức thời (Traffic Shock)} + \text{Đo khả năng tự hồi phục (Recovery)}$$

* **Mô hình 4 giai đoạn kỹ thuật (The 4-Stage Curve):**

```text
  Số lượng VUs
       ^
  500  |                ┌──────────────────────────┐ (GIAI ĐOẠN 3: Peak Plateau - NƠI STRESS TEST DIỄN RA)
       |               /                            \
       |              /                              \
       |             / (GIAI ĐOẠN 2:                  \ (GIAI ĐOẠN 4: 
       |            /   Spike Surge)                   \   Recovery Phase)
   50  |  ─────────┘                                    └──────────
       | (GIAI ĐOẠN 1: Base Load)
    0  +────────────────────────────────────────────────────────────> Thời gian (Phút)
           0m -> 1m       1m -> 1m30s     1m30s -> 3m30s   3m30s -> 5m
```

  1. **Giai đoạn 1 - Base Load (Tải nền - 50 VUs trong 1 phút):**
     - Đưa hệ thống vào trạng thái hoạt động ổn định thường ngày để làm **mốc tham chiếu chuẩn (Baseline Benchmark)**: CPU thấp (~10-15%), Error Rate = 0%, $P_{95} < 100\text{ms}$. Có giai đoạn này mới có cơ sở khoa học để so sánh mức độ tổn thương của hệ thống khi bị sốc tải.
  2. **Giai đoạn 2 - Spike Surge (Bùng nổ sốc tải - Nhảy vọt từ 50 lên 500 VUs trong 30 giây):**
     - Mô phỏng hiệu ứng giờ vàng Flash Sale. Kiểm tra xem Network Socket, TCP SYN Queue và cơ chế Event Loop của Node.js có bị nghẽn tức thì trước sự thay đổi gia tốc tải quá đột ngột hay không.
  3. **Giai đoạn 3 - Peak Plateau (Giam tải cực đại 500 VUs trong 2 phút) $\rightarrow$ ĐÂY CHÍNH LÀ NƠI THỰC HIỆN STRESS TEST:**
     - Hệ thống bị đẩy vượt xa năng lực chịu đựng thông thường (gấp 10 lần) và bị "giam giữ" liên tục trong 2 phút.
     - **Vạch trần điểm nghẽn kiến trúc cốt tử của EShop:** **Tranh chấp khóa tệp SQLite (`SQLITE_BUSY: database is locked`)**.
       + SQLite là cơ sở dữ liệu serverless lưu trên 1 file đơn (`database.sqlite`). Nó có cơ chế: nhiều luồng được đọc cùng lúc (*Shared Lock*), nhưng **chỉ duy nhất 1 luồng được phép ghi tại một thời điểm (*Exclusive Lock*)**.
       + Khi 500 user cùng dồn dập bấm Checkout và áp mã giảm giá `SAVE10`, hàng chục transaction `INSERT INTO orders` và `UPDATE coupon_usage` chen lấn tranh giành khóa file.
       + Hàng đợi ghi bị quá thời gian timeout (5000ms), SQLite ném lỗi `SQLITE_BUSY: database is locked` $\rightarrow$ Endpoint checkout trả về HTTP 500, Response Time vọt từ $20\text{ms}$ lên $> 3000\text{ms}$.
       + 👉 *Đúng chuẩn mục tiêu của Stress Test: Tìm ra chính xác điểm gãy (Breaking Point) của backend!*
  4. **Giai đoạn 4 - Recovery (Phục hồi tự thân - Giảm tải về 0 trong 1.5 phút):**
     - Đo lường tính dẻo dai (Resilience) và khả năng "tự chữa lành" (Self-healing).
     - *Câu hỏi kỹ thuật:* Sau cơn bão Flash Sale, khi tải rút đi, server có tự trở về trạng thái bình thường không, hay bị treo cứng (Deadlock / CPU 100%) buộc kỹ sư phải restart thủ công?
     - Thực nghiệm chứng minh: Sau khi giảm tải, các transaction tồn đọng được giải phóng hết, Response Time của EShop quay về $< 100\text{ms}$, Error Rate về 0%, hệ thống tự hồi phục hoàn hảo mà không cần can thiệp.
* **Mô hình 4 giai đoạn kỹ thuật (The 4-Stage Curve):**

```text
  Số lượng VUs
       ^
  500  |                ┌──────────────────────────┐ (GIAI ĐOẠN 3: Peak Plateau - NƠI STRESS TEST DIỄN RA)
       |               /                            \
       |              /                              \
       |             / (GIAI ĐOẠN 2:                  \ (GIAI ĐOẠN 4: 
       |            /   Spike Surge)                   \   Recovery Phase)
   50  |  ─────────┘                                    └──────────
       | (GIAI ĐOẠN 1: Base Load)
    0  +────────────────────────────────────────────────────────────> Thời gian (Phút)
           0m -> 1m       1m -> 1m30s     1m30s -> 3m30s   3m30s -> 5m
```

  1. **Giai đoạn 1 - Base Load (Tải nền - 50 VUs trong 1 phút):**
     - Đưa hệ thống vào trạng thái hoạt động ổn định thường ngày để làm **mốc tham chiếu chuẩn (Baseline Benchmark)**: CPU thấp (~10-15%), Error Rate = 0%, $P_{95} < 100\text{ms}$. Có giai đoạn này mới có cơ sở khoa học để so sánh mức độ tổn thương của hệ thống khi bị sốc tải.
  2. **Giai đoạn 2 - Spike Surge (Bùng nổ sốc tải - Nhảy vọt từ 50 lên 500 VUs trong 30 giây):**
     - Mô phỏng hiệu ứng giờ vàng Flash Sale. Kiểm tra xem Network Socket, TCP SYN Queue và cơ chế Event Loop của Node.js có bị nghẽn tức thì trước sự thay đổi gia tốc tải quá đột ngột hay không.
  3. **Giai đoạn 3 - Peak Plateau (Giam tải cực đại 500 VUs trong 2 phút) $\rightarrow$ ĐÂY CHÍNH LÀ NƠI THỰC HIỆN STRESS TEST:**
     - Hệ thống bị đẩy vượt xa năng lực chịu đựng thông thường (gấp 10 lần) và bị "giam giữ" liên tục trong 2 phút.
     - **Vạch trần điểm nghẽn kiến trúc cốt tử của EShop:** **Tranh chấp khóa tệp SQLite (`SQLITE_BUSY: database is locked`)**.
       + SQLite là cơ sở dữ liệu serverless lưu trên 1 file đơn (`database.sqlite`). Nó có cơ chế: nhiều luồng được đọc cùng lúc (*Shared Lock*), nhưng **chỉ duy nhất 1 luồng được phép ghi tại một thời điểm (*Exclusive Lock*)**.
       + Khi 500 user cùng dồn dập bấm Checkout và áp mã giảm giá `SAVE10`, hàng chục transaction `INSERT INTO orders` và `UPDATE coupon_usage` chen lấn tranh giành khóa file.
       + Hàng đợi ghi bị quá thời gian timeout (5000ms), SQLite ném lỗi `SQLITE_BUSY: database is locked` $\rightarrow$ Endpoint checkout trả về HTTP 500, Response Time vọt từ $20\text{ms}$ lên $> 3000\text{ms}$.
       + 👉 *Đúng chuẩn mục tiêu của Stress Test: Tìm ra chính xác điểm gãy (Breaking Point) của backend!*
  4. **Giai đoạn 4 - Recovery (Phục hồi tự thân - Giảm tải về 0 trong 1.5 phút):**
     - Đo lường tính dẻo dai (Resilience) và khả năng "tự chữa lành" (Self-healing).
     - *Câu hỏi kỹ thuật:* Sau cơn bão Flash Sale, khi tải rút đi, server có tự trở về trạng thái bình thường không, hay bị treo cứng (Deadlock / CPU 100%) buộc kỹ sư phải restart thủ công?
     - Thực nghiệm chứng minh: Sau khi giảm tải, các transaction tồn đọng được giải phóng hết, Response Time của EShop quay về $< 100\text{ms}$, Error Rate về 0%, hệ thống tự hồi phục hoàn hảo mà không cần can thiệp.

---

### 3. Endurance Test: Vì sao phải "ngâm tải" và điểm yếu cố hữu của JMeter/k6?

* **Bản chất của Endurance / Soak Test:** Rò rỉ bộ nhớ (Memory Leak) trong Node.js (V8 Engine) hoặc Connection Leak trong SQLite Pool là **lỗi tích lũy theo thời gian (Accumulative Bug)**. Trong các bài test ngắn 1-2 phút, RAM chỉ tăng vài MB nên không thể nào phát hiện được. Phải ngâm tải liên tục 30 phút thì "độ dốc rò rỉ" (Leak Slope) mới lộ rõ.
* **Điểm yếu cố hữu của JMeter (cũng như k6):**
  - Cả Apache JMeter lẫn Grafana k6 đều thuần túy là **Black-box Client Load Generator**. Chúng chỉ đứng từ bên ngoài gửi request qua mạng và đo thời gian phản hồi của gói tin HTTP.
  - Chúng **hoàn toàn không thể nhìn thấy bên trong máy chủ**: Không biết tiến trình Node.js đang ngốn bao nhiêu MB RAM, V8 Heap có bị phình to không, hay CPU của máy chủ có đang bị 100% không!
* **Giải pháp đột phá của Nhóm 07 (The Secret Sauce):**
  - Nhóm không phụ thuộc vào các plugin ngoài nặng nề, mà **tự phát triển công cụ giám sát chuyên dụng [`monitor_server.ps1`](./monitor_server.ps1)**.
  - Script này bám sát PID cổng 3000, lấy mẫu mỗi 2 giây và **tự động vẽ Dashboard HTML tương tác (`hardware_report.html`)**.
  - **Kết hợp 2 góc nhìn:**
    $$\text{Client-side (JMeter Dashboard)} + \text{Server-side (Hardware Report)} \Longrightarrow \text{Bức tranh kiểm thử 360 độ hoàn chỉnh!}$$

---

## IV. QUY TRÌNH THỰC CHIẾN DEMO 4 BƯỚC (KÈM LỜI THOẠI SPEAKER NOTES)

> [!IMPORTANT]
> ### 🎯 3 TRỤ CỘT BẮT BUỘC TRONG MỌI CÔNG CỤ PERFORMANCE TESTING ĐƯỢC THỂ HIỆN XUYÊN SUỐT 4 BÀI TEST:
> 
> 1. **Trụ cột 1 - Record & Playback (Bắt & Tái hiện luồng thao tác):**
>    - **Trong k6:** Tester mở trình duyệt, bật công cụ **Network DevTools**, thực hiện trọn vẹn 1 luồng mua sắm trên web rồi tải file **`recording.har`** (HTTP Archive) về $\rightarrow$ File HAR này được dùng làm bản thiết kế (blueprint) để tạo ra các script kiểm thử (`smoke_test.js`, `baseline_load.js`, `spike_test.js`, `endurance_test.js`).
>    - **Trong JMeter:** Tester sử dụng component **`HTTP(S) Test Script Recorder`** lắng nghe trên cổng `8888` (kèm template [`recording_template.jmx`](./recording_template.jmx)) để bắt trực tiếp các gói tin HTTP từ trình duyệt đưa vào `Recording Controller` $\rightarrow$ Tinh chỉnh thành các kịch bản `.jmx`.
> 
> 2. **Trụ cột 2 - Data-Driven Testing (Dữ liệu điều khiển qua `users.csv`):**
>    - **Với Smoke Test (1 VU):** Do chỉ có duy nhất 1 người dùng ảo thực hiện 1 lần, việc dùng tài khoản mặc định tĩnh (`john@example.com`) vẫn chạy hoàn toàn bình thường mà không cần nạp nhiều dữ liệu.
>    - **Với Baseline Test (50 VUs) - Giải quyết xung đột mã giảm giá `SAVE10`:**
>      - *Quy tắc nghiệp vụ cốt tử của EShop:* Mỗi tài khoản người dùng chỉ được sử dụng mã giảm giá `SAVE10` **đúng 1 lần duy nhất** (lưu trong bảng `coupon_usage` của SQLite).
>      - *Hậu quả nếu KHÔNG có Data-Driven:* Nếu 50 VUs cùng dùng chung 1 tài khoản tĩnh, 1 request đầu tiên sẽ thành công, còn **49 requests còn lại sẽ bị server từ chối thẳng thừng với mã lỗi HTTP 400 (`Mã coupon đã được sử dụng`)**, đồng thời gây nghẽn khóa ghi SQLite.
>      - *Giải pháp Data-Driven:* Nhóm nạp file [`users.csv`](./users.csv) (trong JMeter dùng `CSV Data Set Config`, trong k6 dùng `SharedArray`) để cấp phát 50 cặp email/mật khẩu và `user_id` hoàn toàn độc lập cho 50 VUs, giải quyết triệt để lỗi logic nghiệp vụ.
>    - **Với Spike Test (500 VUs):** Khi 500 VUs cùng ập vào dồn dập, nguy cơ xung đột dữ liệu và cạn kiệt tài khoản tăng gấp 10 lần. Nhóm đã cấu hình nạp sẵn danh sách tài khoản ngay từ đầu với chế độ `Recycle on EOF: true` và `Sharing Mode: All threads`, đảm bảo 500 luồng luôn có dữ liệu độc lập để thực thi.
> 
> 3. **Trụ cột 3 - Checkpoints & Assertions (Đánh giá điều kiện Pass/Fail):**
>    - **Trong k6:** Sử dụng hàm `check()` (kiểm tra status 200, JWT token, JSON body) và khối `thresholds` (đặt ngưỡng tiêu chuẩn cam kết SLO: `p(95)<500ms`, tỷ lệ lỗi `http_req_failed < 0.01`).
>    - **Trong JMeter:**
>      - **Checkpoints cấp Request (Assertions):** Thêm các component `Response Assertion` (xác thực HTTP Status Code 200/201, Text Response không chứa chuỗi lỗi) và `JSON PostProcessor` (xác thực trường `$.token` tồn tại). Nếu bất kỳ điều kiện nào thất bại, JMeter sẽ lập tức đánh dấu Sampler sang màu đỏ và ghi nhận vào tỷ lệ lỗi.
>      - **Checkpoints cấp Toàn cục / SLO (Tương đương Thresholds):** Đánh giá trực tiếp trên **JMeter HTML Dashboard**: Cột **Error %** phải đạt $0.00\%$ (vượt qua checkpoint tỷ lệ lỗi), cột **95th pct** phải $< 500\text{ms}$ (vượt qua checkpoint thời gian phản hồi SLO), và điểm **APDEX** phải $\ge 0.85$ (Tolerable) hoặc $\ge 0.94$ (Excellent).
>      - **Checkpoints cấp Hạ tầng (Server-side):** Thông qua công cụ tự phát triển `monitor_server.ps1`, hệ thống tự động kiểm tra: Nếu mức tăng RAM $\Delta\text{RAM} < 25\text{MB} \rightarrow$ Đạt chuẩn `STABLE (Ổn định)` (Màu xanh), nếu $\Delta\text{RAM} > 50\text{MB} \rightarrow$ Cảnh báo `POTENTIAL LEAK` (Màu đỏ).

---

### BƯỚC 1: Demo Smoke Test trên GUI (Trực quan hóa 3 Trụ cột, Checkpoints & Correlation)

* **Mục tiêu:** Chạy kiểm thử sức khỏe (Health Check) 7 API của EShop với 1 Virtual User.
* **Thể hiện 3 Trụ cột tại bước này:**
  - **Record & Playback:** Trình diễn luồng 7 API được bắt nguồn từ bản thiết kế ghi nhận qua browser (file HAR trong k6 hoặc `HTTP(S) Test Script Recorder` trong JMeter).
  - **Data-Driven (Mức cơ sở 1 VU):** Giải thích với 1 VU thì 1 dòng tài khoản trong `users.csv` là đủ, nhưng mở đầu giải thích tại sao sang bài Baseline bắt buộc phải nạp cả tập dữ liệu.
  - **Checkpoints / Assertions:** Chỉ ra component `Response Assertion` gắn dưới mỗi HTTP Sampler (xác nhận HTTP Status Code = 200). Khi chạy xong, cả 7 sampler đều hiển thị **màu xanh lá cây (Pass)** trong `View Results Tree`.
  - **Token Correlation:** Chỉ ra cơ chế bóc tách JWT Token động tại `POST /api/login` bằng `JSON PostProcessor` và tự động đính kèm vào Header `Authorization: Bearer <token>` ở các bước sau.
* **Thao tác thực hiện trên JMeter GUI:**
  1. Mở file [`smoke_test.jmx`](./smoke_test.jmx) trên giao diện đồ họa JMeter.
  2. Bấm vào nút **Start ▶ (màu xanh)** trên thanh công cụ.
  3. Chọn thành phần **`View Results Tree`** để quan sát 7 sampler lần lượt chuyển sang màu xanh lá cây.
  4. Bấm vào `1. POST /api/login` $\rightarrow$ chọn tab **Response data** $\rightarrow$ chỉ vào chuỗi JWT Token mà server trả về.
  5. Bấm vào `4. POST /api/cart` $\rightarrow$ chọn tab **Request** $\rightarrow$ chỉ vào header `Authorization: Bearer <token>` được điền tự động nhờ biến `${JWT_TOKEN}`.
* 🎙️ **LỜI THOẠI GỢI Ý (SPEAKER NOTE):**
  > *"Kính thưa Thầy và các bạn, đây là kịch bản Smoke Test chạy với 1 Virtual User trên giao diện JMeter để xác thực tính toàn vẹn của 7 API nghiệp vụ. Kịch bản này thể hiện trọn vẹn **3 trụ cột cốt lõi** của một công cụ kiểm thử hiệu năng:*
  > * *Thứ nhất là **Record & Playback**: Toàn bộ luồng 7 bước này được nhóm bắt lại từ thao tác thực tế trên trình duyệt (thông qua file HAR và HTTP Test Script Recorder), sau đó tinh chỉnh để phát lại.*
  > * *Thứ hai là **Token Correlation**: Tại bước đăng nhập, component JSON PostProcessor bóc tách mã JWT Token động từ server và tự động truyền vào Header Authorization cho các request giỏ hàng và thanh toán phía sau.*
  > * *Thứ ba là **Checkpoints & Assertions**: Dưới mỗi API đều có Response Assertion kiểm tra mã trạng thái HTTP 200. Như Thầy và các bạn thấy trên cây View Results Tree, cả 7 request đều hiển thị màu xanh lá cây, nghĩa là mọi checkpoint đều vượt qua và hệ thống EShop đã sẵn sàng cho các bài đo tải tiếp theo!"*

---

### BƯỚC 2: Demo Baseline Load Test trên CLI (Giải quyết Bài toán Coupon bằng Data-Driven & Nghiệm thu SLO Checkpoints)

* **Mục tiêu:** Chạy tải chuẩn 50 VUs duy trì liên tục trong 5 phút ở chế độ Non-GUI CLI và mở HTML Dashboard để nghiệm thu các chỉ số cam kết SLO.
* **Thể hiện 3 Trụ cột tại bước này:**
  - **Data-Driven Testing giải quyết xung đột Coupon `SAVE10`:**
    - Trình bày rõ: Nếu chạy 50 VUs mà dùng chung 1 tài khoản tĩnh, 49 VUs sẽ bị lỗi mã giảm giá đã dùng (HTTP 400).
    - Nhờ có component **`CSV Data Set Config`** nạp file `users.csv` (tương tự `SharedArray` của k6), mỗi VU nhận 1 cặp tài khoản riêng biệt, đảm bảo 50 VUs đều áp mã giảm giá thành công 100%.
  - **Checkpoints / Thresholds cấp Toàn cục (Nghiệm thu SLO):**
    - Mở Dashboard báo cáo HTML và chỉ ra các điều kiện đánh giá Pass/Fail:
      1. **Checkpoint Tỷ lệ Lỗi (Error Rate):** Cột **Error % = 0.00%** (Vượt qua yêu cầu không có request nào bị lỗi, tương đương threshold `http_req_failed < 0.01` trong k6).
      2. **Checkpoint Phân vị Thời gian (Response Time SLO):** Cột **95th pct < 500ms** (Vượt qua cam kết chất lượng dịch vụ $P_{95} < 500\text{ms}$).
      3. **Chỉ số APDEX:** Đạt $\ge 0.95$ (Màu xanh Excellent - người dùng hoàn toàn hài lòng).
* **Thao tác thực hiện trên Terminal (PowerShell):**
  1. Mở Cửa sổ 3 (PowerShell), chạy lệnh Non-GUI CLI:
     ```powershell
     # Bước 1: Đảm bảo thư mục kết quả tồn tại
     mkdir results_baseline -ErrorAction SilentlyContinue

     # Bước 2: Chạy Baseline Load Test và tự động sinh HTML Dashboard
     jmeter -n -t baseline_load.jmx -l results_baseline/baseline.jtl -e -o results_baseline/dashboard/
     ```
  2. *(Khi demo trước lớp, để tiết kiệm thời gian, mở ngay Dashboard kết quả đã nghiệm thu sẵn)*:
     ```powershell
     Start-Process results_baseline/dashboard/index.html
     ```
  3. Trên trình duyệt, chỉ chuột vào:
     - Bảng **APDEX (Application Performance Index):** Điểm số đạt `0.98` (Màu xanh lá - Xuất sắc).
     - Bảng **Statistics Summary:** Chỉ vào 2 cột quan trọng nhất: **`Error % = 0.00%`** và **`95th pct < 500ms`**.
     - Biểu đồ **Response Times Over Time:** Đường đồ thị phẳng và ổn định suốt thời gian chạy.
* 🎙️ **LỜI THOẠI GỢI Ý (SPEAKER NOTE):**
  > *"Bước tiếp theo, nhóm triển khai bài Baseline Load Test với 50 người dùng ảo chạy trong 5 phút. Khi lấy số liệu nghiệm thu chính thức, nhóm bắt buộc chạy ở chế độ **Non-GUI CLI** để loại bỏ hiện tượng nghẽn tài nguyên do đồ họa GUI.*
  > *Ở bài test này, **trụ cột Data-Driven Testing phát huy vai trò quyết định**: Do quy tắc nghiệp vụ của EShop quy định mã giảm giá SAVE10 chỉ được dùng 1 lần cho 1 user, nếu không có cơ chế Data-Driven nạp file `users.csv`, 49 user ảo sẽ lập tức bị báo lỗi 400. Nhờ cấu hình CSV Data Set Config, 50 VUs đều có danh tính độc lập và hoàn tất đơn hàng thành công.*
  > *Đồng thời, đối chiếu với **Trụ cột Checkpoints & Thresholds**: Trên bảng thống kê HTML Dashboard, tỷ lệ lỗi Error Rate đạt tuyệt đối **0.00%**, phân vị thời gian phản hồi **$P_{95}$ đạt mức an toàn dưới 500ms**, và chỉ số hài lòng APDEX đạt mức xuất sắc trên 0.95. Điều này chứng minh hệ thống EShop hoàn toàn đáp ứng các cam kết dịch vụ SLO trong điều kiện tải bình thường!"*

---

### BƯỚC 3: Demo Spike Test & Bắt điểm nghẽn Database Lock SQLite (Data-Driven 500 VUs & Checkpoint ngưỡng chịu lỗi)

* **Mục tiêu:** Kích hoạt quá tải đột biến từ 50 lên 500 VUs chỉ trong 10 giây để vạch trần điểm nghẽn của kiến trúc SQLite và kiểm tra khả năng tự phục hồi.
* **Thể hiện 3 Trụ cột tại bước này:**
  - **Data-Driven mở rộng 500 VUs:** Nạp sẵn dữ liệu tài khoản từ đầu với cơ chế vòng lặp dữ liệu `Recycle on EOF: true` và `Sharing Mode: All threads`, đảm bảo 500 luồng không bị cạn dữ liệu hay xung đột tài khoản khi tấn công dồn dập vào hệ thống.
  - **Checkpoints / Thresholds trong điều kiện Sốc tải & Quá tải (Spike & Stress):**
    - Khác với bài Baseline (đòi hỏi 100% xanh), trong bài Spike Test, các Checkpoints phản ứng thế nào khi hệ thống bị đẩy vượt ngưỡng chịu đựng?
    - **Vạch trần điểm nghẽn SQLite Lock:**
      * SQLite dùng cơ chế khóa tệp đơn luồng ghi (Single-writer exclusive lock). Khi 500 user cùng checkout đồng thời, hàng chục transaction tranh chấp ghi vào file `database.sqlite`.
      * Checkpoint phát hiện: Endpoint `/api/checkout` bị quá thời gian timeout (5s), ném lỗi `SQLITE_BUSY: database is locked`, khiến tỷ lệ lỗi **Error Rate tăng lên ~5-8%** và Response Time của checkout vọt lên $> 3000\text{ms}$.
    - **Checkpoint Phục hồi tự thân (Self-healing Checkpoint ở Giai đoạn 4):** Khi tải giảm về mức nền, các Checkpoints tự động xanh trở lại, Response Time quay về $< 100\text{ms}$ mà không cần can thiệp restart server.
* **Thao tác thực hiện trên Terminal (PowerShell):**
  1. Chạy lệnh Spike Test và mở Dashboard:
     ```powershell
     mkdir results_spike -ErrorAction SilentlyContinue
     jmeter -n -t spike_test.jmx -l results_spike/spike.jtl -e -o results_spike/dashboard/
     Start-Process results_spike/dashboard/index.html
     ```
  2. Trên Dashboard, chỉ vào biểu đồ **Response Times Over Time** (cột mốc thời gian phản hồi dựng đứng tại thời điểm 500 VUs) và biểu đồ **Error Rate** (xuất hiện các giao dịch checkout thất bại do SQLite bị khóa).
* 🎙️ **LỜI THOẠI GỢI Ý (SPEAKER NOTE):**
  > *"Để kiểm tra giới hạn chịu đựng cực hạn, nhóm triển khai bài Spike Test tăng vọt từ 50 lên 500 VUs chỉ trong 10 giây. Kịch bản này đã bao hàm cả bài Stress Test thông qua mô hình 4 giai đoạn kỹ thuật:*
  > *Ở mức tải 500 VUs, nhóm vẫn áp dụng Data-Driven nạp sẵn 500 VUs để dữ liệu không bị cạn. Tuy nhiên, lúc này **hệ thống Checkpoints đã vạch trần điểm nghẽn kiến trúc cốt tử của EShop**: Do SQLite sử dụng cơ chế khóa file đơn luồng ghi, khi 500 người dùng cùng bấm thanh toán dồn dập, tranh chấp khóa tệp đã kích hoạt lỗi `SQLITE_BUSY: database is locked`. Checkpoint ghi nhận tỷ lệ lỗi checkout tăng lên và độ trễ vượt trần 3 giây.*
  > *Điểm sáng kỹ thuật nằm ở Giai đoạn 4: Ngay khi cơn sốc tải qua đi và lưu lượng giảm về mức nền, hệ thống đã tự giải phóng hàng đợi, các Checkpoints lập tức xanh trở lại và thời gian phản hồi hạ về dưới 100ms. Điều này chứng minh EShop có khả năng phục hồi tự thân (Self-healing) rất tốt mà không bị treo cứng tiến trình!"*

---

### BƯỚC 4: Demo Endurance Test & Tự động xuất Báo cáo Giám sát RAM/CPU HTML (Khắc phục hạn chế Black-box)

* **Mục tiêu:** Kiểm định độ bền vận hành, phát hiện lỗi rò rỉ bộ nhớ (Memory Leak) và trình diễn giải pháp giám sát phần cứng máy chủ tự phát triển.
* **Thể hiện Trụ cột Checkpoint ở cấp độ Hạ tầng (Infrastructure Assertions):**
  - **Điểm yếu Black-box của công cụ kiểm thử:** Cả JMeter và k6 đều chỉ có Checkpoints ở tầng mạng HTTP (Status Code, Response Time). Chúng hoàn toàn "mù" trước phần cứng bên trong máy chủ (không biết tiến trình Node.js có bị rò rỉ RAM hay CPU 100% không).
  - **Infrastructure Checkpoint của Nhóm 07:** Script PowerShell [`monitor_server.ps1`](./monitor_server.ps1) đóng vai trò là một Checkpoint hạ tầng chuyên nghiệp:
    - Nếu RAM tăng trưởng $\Delta\text{RAM} < 25\text{MB} \rightarrow$ Tự động nghiệm thu đạt chuẩn **`STABLE (Ổn định)`** (Màu xanh).
    - Nếu RAM tăng trưởng $\Delta\text{RAM} > 50\text{MB} \rightarrow$ Tự động cảnh báo **`POTENTIAL LEAK (Nguy cơ rò rỉ bộ nhớ)`** (Màu đỏ).
* **Thao tác thực hiện:**
  1. Tại Cửa sổ 2: Khởi động công cụ giám sát:
     ```powershell
     .\monitor_server.ps1 -AutoOpen
     ```
     *(Màn hình console bắt đầu hiển thị các dòng log giám sát RAM và CPU mỗi 2 giây).*
  2. Tại Cửa sổ 3: Kích hoạt Endurance Test (chạy demo nhanh 30 giây trước lớp):
     ```powershell
     mkdir results_endurance -ErrorAction SilentlyContinue
     jmeter -n -t endurance_test.jmx -JTHREADS=20 -JDURATION=30 -JRAMP_TIME=5 -l results_endurance/endurance.jtl -e -o results_endurance/dashboard/
     ```
  3. Khi JMeter chạy xong $\rightarrow$ Quay lại Cửa sổ 2 nhấn **`Ctrl + C`**.
  4. Trình duyệt tự động mở trang **`hardware_report.html`** với 2 biểu đồ đường tương tác của Chart.js!
  5. Chỉ vào ô **Tăng trưởng RAM (Delta Growth)** và nhãn **Kết luận (STABLE - Ổn định)**.
* 🎙️ **LỜI THOẠI GỢI Ý (SPEAKER NOTE):**
  > *"Cuối cùng là bài Endurance Test nhằm kiểm định độ bền và phát hiện rò rỉ bộ nhớ. Điểm yếu cố hữu lớn nhất của cả JMeter lẫn k6 là tính chất thuần Black-box: chúng không thể đo lường mức độ tiêu thụ tài nguyên bên trong máy chủ.*
  > *Để khắc phục triệt để và bổ sung **Trụ cột Checkpoint ở cấp độ Hạ tầng**, nhóm em đã tự phát triển công cụ `monitor_server.ps1`. Script này bám sát tiến trình Node.js của EShop, đo lường liên tục và ngay khi kết thúc test sẽ tự động phân tích độ dốc tăng trưởng RAM để xuất ra trang Dashboard HTML trực quan này.*
  > *Nhìn vào biểu đồ biến thiên RAM, đường đồ thị nằm ngang sau chu kỳ dọn rác của V8 Garbage Collector và mức tăng trưởng chỉ dừng ở mức an toàn dưới 10MB (nhãn STABLE màu xanh). Kết hợp giữa báo cáo mạng của JMeter và báo cáo phần cứng của nhóm, ta có được một bức tranh kiểm thử hiệu năng 360 độ hoàn chỉnh nhất!"*

---

## V. BẢNG TÓM TẮT CÂU HỎI DỰ KIẾN GIẢNG VIÊN & CÁCH PHẢN BIỆN (Q&A DEFENSE)

| Giảng viên / Ban giám khảo hỏi | Nhóm trả lời & Phản biện kỹ thuật |
| :--- | :--- |
| **Q1: "Tại sao kịch bản của các em không chạy trực tiếp trên GUI mà phải chạy qua dòng lệnh CLI?"** | Dạ thưa Thầy, theo tài liệu chính thức của Apache, việc hiển thị giao diện GUI tiêu tốn rất nhiều CPU và RAM của máy test để vẽ đồ họa, dẫn đến hiện tượng nghẽn cổ chai ngay tại máy client và làm sai lệch chỉ số đo lường. GUI chỉ dùng để soạn thảo và gỡ lỗi, còn CLI Non-GUI là bắt buộc khi lấy số liệu đo tải chuẩn xác. |
| **Q2: "Nếu SQLite bị nghẽn khóa ghi như vậy trong Spike Test, giải pháp kiến trúc khắc phục là gì?"** | Dạ thưa Thầy, có 3 giải pháp: (1) Nâng cấp SQLite sang cơ sở dữ liệu Client-Server hỗ trợ ghi đồng thời như PostgreSQL/MySQL; (2) Áp dụng kiến trúc Message Queue (như Redis/RabbitMQ) để xếp hàng các yêu cầu checkout; (3) Bật chế độ WAL (Write-Ahead Logging) trên SQLite để luồng đọc và ghi không khóa lẫn nhau. |
| **Q3: "Tại sao nhóm lại dùng tỷ lệ 70% Search - 25% Detail - 5% Checkout mà không phải 33% đều nhau?"** | Dạ thưa Thầy, trong thực tế các sàn thương mại điện tử (Amazon, Shopee), hành vi người dùng chủ yếu là lướt xem và so sánh giá (Browse/Search chiếm số đông), tỷ lệ chuyển đổi mua hàng (Conversion Rate) ngoài đời thực thường chỉ dao động từ 2% đến 5%. Nếu chia đều 33% thì kịch bản bị phi thực tế và làm sai lệch mô hình tải của doanh nghiệp. |
| **Q4: "Làm thế nào các em đảm bảo việc chạy test nhiều user không bị trùng mã giảm giá SAVE10?"** | Dạ thưa Thầy, nhóm áp dụng cơ chế Data-Driven Testing: mỗi Virtual User trong JMeter được cấp phát một tài khoản duy nhất từ tệp `users.csv` thông qua `CSV Data Set Config`. Do mỗi user có `user_id` riêng biệt, hệ thống sẽ ghi nhận lịch sử sử dụng độc lập mà không bị xung đột. |
| **Q5: "Giữa JMeter và k6, nhóm đánh giá công cụ nào phù hợp hơn cho dự án hiện đại?"** | Dạ thưa Thầy, k6 vượt trội về hiệu năng phần cứng nhờ Goroutines của Go (tiêu thụ ít RAM hơn gấp nhiều lần so với luồng JVM của JMeter) và rất dễ viết code JavaScript đưa vào CI/CD pipeline. Tuy nhiên, JMeter vẫn giữ ưu thế về hệ sinh thái plugin lâu đời, hỗ trợ nhiều giao thức và giao diện kéo thả trực quan phù hợp cho người mới bắt đầu. |
| **Q6: "Trong kịch bản có bài Spike Test, vậy bài Stress Test của nhóm nằm ở đâu?"** | Dạ thưa Thầy, bài Stress Test đã được tích hợp trọn vẹn vào Giai đoạn 3 (Peak Plateau) của Spike Test: hệ thống bị giam ở mức 500 VUs (gấp 10 lần bình thường) suốt 2 phút để tìm ra điểm gãy (tranh chấp khóa ghi đơn luồng SQLite). Mô hình này vừa tìm được điểm gãy của Stress Test, vừa đo được độ sốc tải và thời gian tự phục hồi. |

