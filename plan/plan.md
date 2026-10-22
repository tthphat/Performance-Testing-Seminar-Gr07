# KẾ HOẠCH THỰC HIỆN SEMINAR: T05 - PERFORMANCE TESTING (NHÓM 07)

* **Môn học:** Software Testing (CS423 / CSC15003)
* **Giảng viên:** Trương Phước Lộc – Lâm Quang Vũ
* **Chủ đề:** T05 - Performance Testing
* **Bộ công cụ thực nghiệm:** Apache JMeter (Traditional Main) + ChatGPT & k6 (AI-Augmented) + Locust (Backup)
* **Hệ thống kiểm thử (SUT):** EShop (Node.js + SQLite backend)
* **Thành viên nhóm 07:**
  1. **Thái Thiên Phú (23120327):** Team Leader / Integration & Traditional Tool Lead (Apache JMeter)
  2. **Trương Thành Phát (23120319):** Technical & AI Lead / AI-Augmented Tool Lead (ChatGPT + k6)
  3. **Lục Hoàng Tuấn (23120393):** Documentation & Presentation Lead / Backup Tool Lead (Locust)

---

## 1. Kế hoạch làm việc chi tiết (Workflow & Timeline)

Quy trình làm việc của nhóm kết hợp giữa **8 giai đoạn chuẩn của Seminar Track (S1 – S8)** và **các mốc đánh giá thực hành chung của môn học**:

### 1.1. Gặp mặt đầu môn & Giai đoạn S1 – Khảo sát công cụ và nộp Proposal (Tuần 2–3 đến Thứ Bảy Tuần 6, 23:59)
* Chủ động gặp giảng viên vào khoảng Tuần 2–3 để trình bày định hướng nội dung dự kiến và nhận góp ý hiệu chỉnh (nếu vắng mặt hoặc chuẩn bị sơ sài sẽ bị trừ $1/10$ điểm).
* Khảo sát tối thiểu 3 công cụ (JMeter, k6, Locust), lập ma trận so sánh theo 5 tiêu chí và nộp báo cáo đề xuất (`Tool_Survey_Proposal.md` / `Proposal_Report.pdf`) trong vòng 5 ngày làm việc sau khi nhận đề tài, hạn chót vào 23:59 Thứ Bảy Tuần 6.

### 1.2. Giai đoạn S2 – Giảng viên/Trợ giảng duyệt đề tài (Giữa Tuần 6)
* Nhận phản hồi từ giảng viên trong vòng 2 ngày làm việc với 3 trạng thái khả dĩ: `APPROVED` (chốt phạm vi, chuyển sang S3), `MINOR-CHANGE` (hiệu chỉnh đề xuất trong vòng 24 giờ rồi tiếp tục) hoặc `RECLAIM` (đổi hướng tiếp cận/công cụ).
* Toàn bộ thành viên cùng ghi nhận phản hồi và cập nhật lại bản Proposal theo yêu cầu.

### 1.3. Giai đoạn S3 – Nghiên cứu chuyên sâu, Thực nghiệm trên EShop & Nộp bài Tuần 6 (Tuần 6 – Tuần 10)
* **Mốc nộp bài chấm điểm Tuần 6:** Hoàn thiện tối thiểu $90\%$ khối lượng nội dung lý thuyết và thực nghiệm để nộp cho Giảng viên thực hành (GVTH) chấm cột điểm quan trọng ở Tuần 6 (nếu không nộp hoặc bài làm sơ sài dưới $90\%$ sẽ bị trừ $3/10$ điểm).
* **Hoàn thành 5 mốc kỹ thuật (M1 – M5) trên hệ thống EShop:**
  * *M1 & Thu thập HAR:* Cài đặt JMeter, k6, Locust, chạy thành công kịch bản mẫu và thu thập file HAR từ phiên thao tác thủ công trên EShop.
  * *M2 & Xây dựng kịch bản kiểm thử:* Chuyển đổi file HAR sang kịch bản k6 baseline và xây dựng kịch bản tương đương trên JMeter (`.jmx`) cho 7 API của EShop:
    * `GET /api/products?search=...`
    * `GET /api/products/:id`
    * `POST /api/login`
    * `POST /api/apply-coupon`
    * `POST /api/checkout`
    * `GET /api/orders/my-orders`
    * `POST /api/admin/import-products`
  * *Thực thi 4 kịch bản tải:*
    1. **Smoke test:** 1–2 VUs, 1 phút (kiểm tra JWT correlation, CSV data, assertion).
    2. **Baseline load:** 50 VUs, 5 phút ($70\%$ search/list, $25\%$ product detail, $5\%$ checkout).
    3. **Spike test:** Giữ 50 VUs trong 1 phút $\rightarrow$ tăng lên 500 VUs trong 30 giây $\rightarrow$ giữ 500 VUs trong 2 phút $\rightarrow$ giảm tải và quan sát phục hồi trong 1 phút 30 giây.
    4. **Endurance test:** 50 VUs, 30 phút ($90\%$ search/list, $10\%$ product detail).
  * *Đảm bảo độ phủ tính năng công cụ:* Thiết kế bài demo bao hàm đủ 3 thành phần: **Record and Playback**, **Data-driven** (dữ liệu CSV) và **Checkpoints** (assertions), đồng thời mỗi công cụ cần có ít nhất 3 kịch bản demo (cài đặt, chức năng cơ bản, luồng xử lý phức tạp).
  * *M3 & M4 (Yếu tố AI & Failure Modes):* Dùng ChatGPT chuyển đổi log HTTP/HAR hoặc giả định tải thành kịch bản mua sắm thực tế trên k6, sau đó kiểm toán (audit) và tinh chỉnh các phân phối thiếu thực tế, đồng thời ghi nhận ít nhất 3 lỗi sai lệch thực tế (failure modes) của công cụ.
  * *M5 & Báo cáo SLO:* Đo đạc thời gian thiết lập, thời gian chạy, tỷ lệ chập chờn (flake rate) và xuất báo cáo SLO 1 trang đối chiếu với ngưỡng yêu cầu ($P95 < 500\text{ ms}$, tỷ lệ lỗi $< 1\%$, thông lượng $20\text{–}40\text{ request/s}$, $\text{CPU} < 80\%$, $\text{RAM} < 300\text{ MB}$).

### 1.4. Giai đoạn S4 – Viết User Guide & Quay video Demo (Tuần 6 – Tuần 10)
* Biên soạn tài liệu hướng dẫn `User_Guide.md` bằng tiếng Anh (đầy đủ 7 phần theo chuẩn) và quay video `Demo_Screencast.mp4` dài 5–8 phút thuyết minh tiếng Anh, đồng thời đăng video lên YouTube để lấy link chèn vào slide.

### 1.5. Giai đoạn S5 – Trình bày thử với GVTH & Chia sẻ tài liệu trước Seminar (Trước buổi Seminar ít nhất 3 ngày làm việc)
* Chủ động hẹn và trình bày thử nội dung seminar với GVTH để nhận góp ý chỉnh sửa trước tuần báo cáo chính thức (nếu không nộp trước hoặc không trình bày thử sẽ bị trừ $4/10$ điểm).
* Tải bộ tài liệu gồm `User_Guide.md`, `Demo_Screencast.mp4`, `Activity_Worksheet.md` và `Seminar_Slides.pptx` lên thư mục Moodle chung, đồng thời đăng bài thông báo trước tối thiểu 3 ngày làm việc để các nhóm khác đọc trước.

### 1.6. Giai đoạn S6 – Báo cáo Seminar trực tiếp trên lớp (Tuần 7 – Tuần 11, thời lượng 45 phút)
* **0:00 – 0:10 (Pitch - 10 phút):** Giới thiệu tổng quan lý thuyết Performance Testing, lý do chọn công cụ, đối tượng sử dụng, các trường hợp công cụ gặp điểm yếu/thất bại và Case Study thực tế (sự cố cụm MySQL `mysql1` của GitHub tháng 02/2020).
* **0:10 – 0:20 (Live Demo - 10 phút):** Demo trực tiếp trên Terminal/IDE thật (không dùng slide, chuẩn bị sẵn video dự phòng nếu mất mạng) trên hệ thống EShop, bắt buộc trình diễn cả tính năng truyền thống (**JMeter**) lẫn tính năng kết hợp AI (**ChatGPT + k6**).
* **0:20 – 0:40 (Audience Hands-on Activity - 20 phút):** Điều phối hoạt động **"Workload Model Bake-off"** cho các nhóm sinh viên trên lớp thiết kế mô hình phân bổ tải ngày Black Friday cho EShop và chạy thử nghiệm `k6 dry-run` cho mô hình tốt nhất.
* **0:40 – 0:45 (Debrief & Q&A - 5 phút):** Thảo luận 4 câu hỏi tổng kết, giải đáp thắc mắc và giới thiệu phương án dự phòng **Locust**.

### 1.7. Giai đoạn S7 – Thu thập phản hồi khán giả & Đánh giá chéo (Ngay sau buổi Seminar)
* Thu lại phiếu bài tập (`Activity_Worksheet.md`) và tờ phản hồi 1 phút (`minute-paper`) từ các nhóm tham dự để tổng hợp thành báo cáo.
* Thực hiện đánh giá chéo (`Peer_Review.md`) cho 2 nhóm đối tác được phân công và tham gia đầy đủ tối thiểu $8/10$ buổi seminar của lớp (vắng quá 2 buổi sẽ bị giới hạn điểm tổng kết seminar ở mức tối đa $70\%$).

### 1.8. Giai đoạn S8 & Cuối kỳ – Nộp hồ sơ AI Audit, Phản tư & Nộp bài hiệu chỉnh (Trong 5 ngày làm việc sau Seminar & Tuần 12)
* Hoàn thành và nộp gói kiểm toán AI (`[AI-02]`, `[AI-03]`, `[AI-04]` / `Final_Reflection.md`) trong vòng 5 ngày làm việc sau buổi báo cáo trực tiếp.
* Rà soát, cập nhật toàn bộ tài liệu, mã nguồn và báo cáo để nộp bản hoàn chỉnh cuối môn học vào Tuần 12.

---

## 2. Danh mục các hạng mục cần nộp (Deliverables Checklist)

| Giai đoạn / Thời hạn | Tên file / Hạng mục nộp | Yêu cầu kỹ thuật & Nội dung bắt buộc |
| :--- | :--- | :--- |
| **Stage S1** (Thứ Bảy Tuần 6, 23:59) | `Tool_Survey_Proposal.md` / `Proposal_Report.pdf` | • Tối đa 1 trang theo chuẩn Seminar Track (nhóm đã hoàn thành bản `Proposal_Report.pdf` chi tiết).<br>• Nêu tên đề tài (T5 Performance Testing), tối thiểu 3 công cụ (JMeter, k6, Locust), ma trận so sánh 5 tiêu chí, lý do chọn và mục AI Disclosure. |
| **Tuần 6** (Chấm điểm đợt 1) & **Tuần 12** (Cuối môn) | **Báo cáo chi tiết, Báo cáo SLO 1 trang, Source Code & Minh chứng** | • Đạt tối thiểu $90\%$ nội dung seminar chính thức ở lần nộp Tuần 6.<br>• Bộ mã nguồn kịch bản kiểm thử: file `.jmx` (JMeter), file `.js` (k6), script Python (Locust), file HAR mẫu và dữ liệu CSV.<br>• Báo cáo kết quả thực nghiệm & SLO 1 trang: thống kê $P50$, $P95$, $P99$ theo endpoint, throughput, error rate, CPU/RAM, DB query time và biểu đồ tải.<br>• Bảng phân công công việc kèm minh chứng làm việc nhóm (log làm việc, commit, ảnh chụp màn hình). |
| **Stage S4 & S5** (Trước Seminar $\ge 3$ ngày làm việc) | `User_Guide.md` | • Viết bằng **tiếng Anh** gồm 7 mục bắt buộc:<br>  1. *Introduction*<br>  2. *Installation* (lệnh cài đặt chính xác, ghi chú OS, $\ge 1$ ảnh chụp màn hình)<br>  3. *First Test* (chạy end-to-end trên EShop trong $\le 15$ bước)<br>  4. *Advanced Usage* (cấu hình, plugin, chạy phân tán/song song)<br>  5. *Troubleshooting* ($\ge 3$ lỗi thực tế và cách sửa)<br>  6. *Failure Modes* (**bắt buộc**: $\ge 3$ tình huống công cụ báo kết quả sai/gây hiểu lầm kèm trigger, symptom, detection, mitigation)<br>  7. *References* (trích dẫn tài liệu gốc, không trích dẫn AI). |
| **Stage S4 & S5** (Trước Seminar $\ge 3$ ngày làm việc) | `Demo_Screencast.mp4` & **Link YouTube** | • Thời lượng **5 – 8 phút**, độ phân giải ưu tiên **1080p** (tối thiểu 720p), dung lượng $\le 100\text{ MB}$ (nén split-zip nếu lớn hơn).<br>• Thuyết minh **tiếng Anh**, không nhạc nền, nên có phụ đề, nền trắng chữ đen rõ nét, quay trực tiếp trên Terminal/IDE thật.<br>• Đăng video lên YouTube, nộp link và chèn link rõ ràng vào trong slide thuyết trình. |
| **Stage S5** (Trước Seminar $\ge 3$ ngày làm việc) | `Activity_Worksheet.md` & **Cheat-sheet 1 trang** | • Bài tập thực hành **"Workload Model Bake-off"** kèm đáp án (Answer Key) được chia khung thời gian chi tiết để các nhóm khác hoàn thành trong $\le 25$ phút mà không cần kết nối internet sau bước cài đặt.<br>• Chuẩn bị thêm tờ **Cheat-sheet 1 trang** và in sẵn bản giấy Worksheet cho các nhóm khán giả không mang laptop. |
| **Stage S5 & S6** (Trước Seminar $\ge 3$ ngày & Ngày báo cáo) | `Seminar_Slides.pptx` | • Thiết kế nền trắng chữ đen, cỡ chữ to rõ để dễ nhìn dưới ánh sáng mạnh tại phòng học.<br>• Theo quy định Seminar Track: giới hạn $\le 15$ slides theo template để ưu tiên thời gian cho Live Demo và hoạt động thực hành; đồng thời đảm bảo cô đọng đầy đủ lý thuyết, so sánh công cụ và link video demo theo yêu cầu của GV. |
| **Stage S7** (Sau buổi Seminar) | `Audience_Feedback_Aggregated.md` | • Tổng hợp kết quả bài làm trên Worksheet và nội dung phản hồi từ các phiếu `minute-paper` (1 điều học được, 1 điều còn chưa rõ, điểm đánh giá độ hữu ích từ 1–5) của các nhóm khán giả. |
| **Stage S8** (Trong 5 ngày làm việc sau Seminar) | `[AI-02]`, `[AI-03]`, `[AI-04]` / `Final_Reflection.md` | • Điền trực tiếp vào các biểu mẫu trong thư mục `Homeworks/AI Templates/_En/`:<br>  1. **[AI-02] AI Audit Report:** Báo cáo kiểm toán AI gồm 5 mục, tổng độ dài $\ge 600$ từ (nêu công cụ, tóm tắt prompt, kết quả và kiểm toán lỗi/giả định của AI).<br>  2. **[AI-03] AI Disclosure:** Bản khai báo sử dụng AI xuất file PDF có chữ ký thật của từng thành viên.<br>  3. **[AI-04] Reflective Statement (`Final_Reflection.md`):** Bài phản tư 300 từ bằng tiếng Anh về những điểm hiệu quả và hạn chế trong quá trình làm việc. |
| **Sau Seminar của nhóm đối tác** | `Peer_Review.md` | • Đánh giá chéo tài liệu `User_Guide.md` và video `Demo_Screencast.mp4` của 2 nhóm đối tác được phân công (nêu $\ge 3$ điểm mạnh cụ thể, $\ge 3$ đề xuất cải thiện gắn với từng mục trong guide và 1 câu hỏi dự kiến kèm câu trả lời). |

---

## 3. Bảng Task List phân công chi tiết cho 3 thành viên

### 3.1. Bảng phân công theo giai đoạn (Stage-by-Stage Task Matrix)

| Giai đoạn | Thái Thiên Phú (JMeter & Team Lead) | Trương Thành Phát (k6 & Technical/AI Lead) | Lục Hoàng Tuấn (Locust & Docs/Presentation Lead) |
| :--- | :--- | :--- | :--- |
| **S1: Khảo sát & Proposal** | • Khảo sát công cụ truyền thống **Apache JMeter**.<br>• Tổng hợp và rà soát chung bản Proposal của nhóm. | • Khảo sát công cụ AI-Augmented **k6 + ChatGPT**.<br>• Thiết kế kịch bản kiểm thử các API EShop và tổng hợp Proposal. | • Khảo sát công cụ dự phòng **Locust**.<br>• Biên soạn phần lý thuyết nền tảng, Case Study GitHub và tổng hợp Proposal. |
| **S2: Duyệt đề tài & Hiệu chỉnh** | • Làm đầu mối trao đổi với giảng viên/TA tại buổi gặp mặt đầu môn và nhận kết quả duyệt S2.<br>• Cập nhật phần JMeter và phạm vi đề tài trong Proposal. | • Ghi nhận feedback của giảng viên/TA về hướng áp dụng AI và kịch bản tải trên EShop.<br>• Cập nhật phần k6, AI và thông số kỹ thuật trong Proposal. | • Ghi nhận biên bản góp ý của giảng viên/TA.<br>• Cập nhật phần Locust, cấu trúc báo cáo và hoàn thiện định dạng Proposal. |
| **S3: Nghiên cứu sâu & Thực nghiệm EShop** | • Cài đặt, nghiên cứu chuyên sâu **Apache JMeter** (GUI & CLI mode).<br>• Xây dựng kịch bản `.jmx` cho 7 API EShop có đầy đủ Record & Playback, CSV Data-driven, JWT correlation và Assertions.<br>• Thực thi Smoke test, Baseline load (50 VUs), Spike test (50 $\rightarrow$ 500 VUs), Endurance test bằng JMeter và thu thập metrics.<br>• Ghi nhận lỗi thực tế và 3 failure modes của JMeter. | • Thiết lập môi trường **EShop SUT** (Node.js + SQLite) và thu thập file **HAR** từ phiên thao tác thủ công.<br>• Cài đặt **k6**, chuyển đổi HAR thành script k6 baseline và chạy kiểm thử 50 VUs / 500 VUs.<br>• Dùng **ChatGPT** sinh kịch bản mua sắm thực tế từ log/HAR, thực hiện **audit & refine** phân phối tải và ngưỡng thresholds.<br>• Tổng hợp số liệu ($P50$, $P95$, $P99$, Throughput, Error rate, CPU/RAM) thành **SLO Report 1 trang**. | • Cài đặt, nghiên cứu **Locust** (Python) và viết kịch bản mô phỏng người dùng dự phòng trên EShop.<br>• Chuẩn bị sẵn kịch bản chạy phân tán (distributed mode) và 3 mức demo (cài đặt, cơ bản, nâng cao) trên Locust.<br>• Quản lý nhật ký làm việc nhóm (team log), lưu trữ ảnh chụp màn hình, câu lệnh và minh chứng đóng góp của 3 thành viên. |
| **S4: Viết User Guide & Quay Demo** | • Viết phần **Apache JMeter** trong `User_Guide.md` (Installation, First Test, Advanced Usage, Troubleshooting, Failure Modes).<br>• Chuẩn bị kịch bản demo JMeter và ghi hình phần thực nghiệm JMeter. | • Viết phần **k6 + AI Workflow** trong `User_Guide.md` (cách prompt AI từ HAR/log, cách audit script k6, Failure Modes).<br>• Chuẩn bị kịch bản AI demo và ghi hình phần thực nghiệm k6 + ChatGPT. | • Viết phần **Locust**, *Introduction* và *References* trong `User_Guide.md`.<br>• Phụ trách hậu kỳ, biên tập, ghép nối và chỉnh sửa video `Demo_Screencast.mp4` (5–8 phút, $\le 100\text{ MB}$, thuyết minh tiếng Anh, nền trắng chữ đen) và đăng lên YouTube. |
| **S5: Chia sẻ trước Seminar & Báo cáo thử** | • Kiểm tra toàn bộ nội dung kỹ thuật, source code (`.jmx`, `.js`, `.py`) và hoàn thiện cấu trúc thư mục nộp bài.<br>• Cùng nhóm trình bày thử với GVTH trước tuần seminar. | • Thiết kế bài tập thực hành `Activity_Worksheet.md` (kèm Answer Key & script k6 dry-run cho bài "Workload Model Bake-off").<br>• Kiểm tra chéo slide/user guide và đăng bài chia sẻ lên **Moodle** trước $\ge 3$ ngày làm việc. | • Thiết kế `Seminar_Slides.pptx` ($\le 15$ slides cho buổi live + bản đầy đủ cho GV, nền trắng chữ đen) và **Cheat-sheet 1 trang**.<br>• Kiểm tra tính đầy đủ của toàn bộ tài liệu, in sẵn bản giấy Worksheet và gửi thông báo nhắc các nhóm khán giả đọc trước. |
| **S6: Báo cáo Seminar trực tiếp (45 phút)** | • **Vai trò Presenter & Demoer 1:** Trình bày phần **Pitch** (10 phút đầu) và thực hiện **JMeter Live Demo** trực tiếp trên EShop. | • **Vai trò Demoer 2 & Facilitator:** Thực hiện **AI/k6 Live Demo** trên EShop và trực tiếp hướng dẫn, điều phối hoạt động **Audience Hands-on ("Workload Model Bake-off")** trong 20 phút (chạy k6 dry-run cho nhóm thắng cuộc). | • **Vai trò Timekeeper & Support:** Quản lý thời gian từng phần, giới thiệu phương án **Locust/Backup**, điều phối phần **Debrief + Q&A** (5 phút cuối) và hỗ trợ kỹ thuật dưới lớp. |
| **S7: Hoạt động khán giả & Phản hồi** | • Đi xuống lớp hỗ trợ giải đáp thắc mắc kỹ thuật khi các nhóm khán giả làm bài tập thực hành.<br>• Phối hợp viết đánh giá chéo `Peer_Review.md` cho nhóm đối tác 1. | • Theo dõi tiến độ hoạt động của các nhóm, thu thập mô hình tỷ lệ tải (%-mix) của các nhóm lên bảng và thu thập feedback.<br>• Phối hợp viết đánh giá chéo `Peer_Review.md` cho nhóm đối tác 2. | • Thu lại toàn bộ phiếu bài tập và giấy phản hồi `minute-paper` cuối giờ.<br>• Tổng hợp dữ liệu thành file `Audience_Feedback_Aggregated.md`. |
| **S8 & Final: AI Audit, Phản tư & Tổng kết** | • Phụ trách chính soạn thảo **[AI-02] AI Audit Report** (5 phần, $\ge 600$ từ).<br>• Ký tên vào bản PDF **[AI-03]** cá nhân.<br>• **Kiểm tra tổng thể & Tích hợp cuối cùng (Team Leader / Integration)** để nộp bài hoàn chỉnh ở Tuần 12. | • Phụ trách chính tổng hợp **[AI-03] AI Disclosure** (hướng dẫn, rà soát thông tin khai báo prompt/tool và thu thập đủ chữ ký PDF của 3 thành viên).<br>• Rà soát toàn bộ khía cạnh kỹ thuật và kiểm toán kịch bản AI (**Technical & AI Lead**). | • Phụ trách chính viết **[AI-04] Reflective Statement** / `Final_Reflection.md` (300 từ tiếng Anh).<br>• Ký tên vào bản PDF **[AI-03]** cá nhân.<br>• Rà soát định dạng tài liệu, quy chuẩn trình bày và đóng gói hồ sơ (**Documentation & Presentation Lead**). |

---

### 3.2. Các lưu ý quan trọng để tránh bị trừ điểm đáng tiếc (Checklist kiểm soát rủi ro)

#### A. 6 lỗi bị trừ điểm tự động (Auto-penalty) & Quy định chuyên cần của Seminar Track
1. **Không sao chép nguyên văn kết quả do AI sinh ra vào `User_Guide.md` mà chưa qua chỉnh sửa và kiểm chứng bởi thành viên nhóm:**
   * **File yêu cầu:**
     * `Seminar_Workflow_Briefing.pdf` – Trang 10, mục *Top 6 pitfalls - auto-penalty* (Lỗi số 1: *"Copy-pasting AI output into the user guide unedited"*).
     * `Seminar_Guide.docx.pdf` – Trang 5, Mục 7 *AI Policy for the Seminar* (*"Every AI-generated artefact must be reviewed and edited by a human before submission. Direct copy-paste without editing = academic violation"*).
     * `seminar-general-requirement.pdf` – Trang 1, mục *Yêu cầu chính chủ* (*"Nhóm SV cần phải review kết quả AI phát sinh ra, đảm bảo nội dung chính xác, rõ ràng, nhận trách nhiệm trên tài liệu phát sinh"*).
     * `T05_Performance_Testing_InClass.pptx.pdf` – Trang 2, mục *Ground Rules for Today's Activity* (*"AI tools are allowed but every output must be cross-checked manually"*).

2. **Trong buổi Live Demo, bắt buộc phải chạy trực tiếp cả công cụ truyền thống (JMeter) lẫn công cụ AI (k6 + ChatGPT), tuyệt đối không chỉ demo 1 trong 2:**
   * **File yêu cầu:**
     * `Seminar_Workflow_Briefing.pdf` – Trang 3 (*Rule of pairing*) & Trang 10, mục *Top 6 pitfalls - auto-penalty* (Lỗi số 2: *"Demo'ing only the traditional tool OR only the AI tool - both required"*).
     * `Seminar_Guide.docx.pdf` – Trang 4, Mục 3 *The Ten Seminar Topics - Rule of pairing* (*"teams must demonstrate at least one feature from BOTH the traditional and the AI-augmented columns during their live demo"*).
     * `T05_Performance_Testing.docx.pdf` – Trang 3, Mục 9 *Topic-Specific Grading Notes* (*"Live demo MUST exercise at least one feature from the traditional tool AND one from the AI tool"*).

3. **Không được bỏ sót mục `Failure Modes` (nêu ít nhất 3 cách công cụ có thể báo kết quả sai hoặc gây hiểu lầm) trong `User_Guide.md`:**
   * **File yêu cầu:**
     * `Seminar_Workflow_Briefing.pdf` – Trang 6, mục *Stage S4 - User_Guide.md required Markdown sections* (Mục 6: *"Failure Modes (NEW): $\ge 3$ ways the tool can mislead you"*), Trang 9 (*Template 2*) & Trang 10, mục *Top 6 pitfalls - auto-penalty* (Lỗi số 3: *"Skipping the 'Failure Modes' section in the user guide"*).
     * `T05_Performance_Testing.docx.pdf` – Trang 3, Mục 9 *Topic-Specific Grading Notes* (*"User guide MUST include a 'failure modes' section listing 3 real ways the tool can mislead users"*).

4. **Không được dùng video quay sẵn để giả làm Live Demo trên lớp (Trợ giảng sẽ kiểm tra trực tiếp trên Terminal/IDE thật; video chỉ dùng làm phương án dự phòng khi sự cố mạng):**
   * **File yêu cầu:**
     * `Seminar_Workflow_Briefing.pdf` – Trang 6 (*Content: Real terminal/IDE - no pre-recorded fakes*), Trang 7 (*Stage S6 Tips: Demo on a real terminal/IDE; have a backup recording ready in case the network dies*) & Trang 10, mục *Top 6 pitfalls - auto-penalty* (Lỗi số 4: *"Pre-recording the 'live' demo (TAs check)"*).
     * `Seminar_Guide.docx.pdf` – Trang 3, Mục 2.1 *Stage S6 Live seminar* (*"0:10-0:20 Live demo on EShop (no slides; real terminal/IDE)"*) & Trang 5, Mục 6 *Rubric* (*"Demo runs end-to-end without scripted help"*).

5. **Đảm bảo bài tập `Activity_Worksheet.md` vừa sức để các nhóm bạn có thể hoàn thành trọn vẹn trong vòng 20–25 phút tại lớp (không cần internet sau bước cài đặt ban đầu):**
   * **File yêu cầu:**
     * `Seminar_Workflow_Briefing.pdf` – Trang 9 (*Template 3*) & Trang 10, mục *Top 6 pitfalls - auto-penalty* (Lỗi số 5: *"Activity worksheet that cannot finish in 25 min"*).
     * `T05_Performance_Testing.docx.pdf` – Trang 3, Mục 9 *Topic-Specific Grading Notes* (*"Activity worksheet MUST be reproducible by a peer team in $\le 25$ minutes without your help"*).
     * `Seminar_Guide.docx.pdf` – Trang 1, Mục 1 & Trang 5, Mục 6 *Rubric* (*"Activity is feasible in 15-25 min; audience can replicate"*).

6. **Không để trống bất kỳ mục nào trong báo cáo `[AI-02]` ($\ge 600$ từ, đủ 5 mục), không đưa thông tin nhạy cảm/MSSV/private key vào AI và phải có đủ chữ ký thật của cả 3 thành viên trong `[AI-03]`:**
   * **File yêu cầu:**
     * `Seminar_Workflow_Briefing.pdf` – Trang 8 (*Stage S8 - AI Audit pack*) & Trang 10, mục *Top 6 pitfalls - auto-penalty* (Lỗi số 6: *"Missing AI Disclosure or empty [AI-02] sections"*).
     * `Seminar_Guide.docx.pdf` – Trang 3, Mục 2.1 *Stage S8*, Trang 5, Mục 6 *Rubric* & Trang 6, Mục 7 *AI Policy* (*"Disclose tool, prompt summary, and outcome in [AI-02]. Do not paste private keys, student IDs, or course-secret content into AI tools"*).

7. **Không vắng mặt quá 2 buổi seminar của các nhóm khác và không quên đọc bài trước buổi học (khống chế tối đa $70\%$ điểm Seminar):**
   * **File yêu cầu:**
     * `Seminar_Guide.docx.pdf` – Trang 2, Mục 2.1 *Stage S5* & Trang 5, Mục 6 *Rubric - Audience attendance* (*"each team must attend at least 8 of the 10 live seminars and submit a 1-minute paper each time. Missing more than 2 seminars caps the team's Seminar component at $70\%$"*).
     * `Seminar_Workflow_Briefing.pdf` – Trang 7 (*S5 - Pre-share rule: Audience teams that don't skim the materials lose 1 attendance credit on the day*) & Trang 10.

---

#### B. Các mốc trừ điểm nặng theo tiến độ & quy chuẩn trình bày của môn học
1. **Trừ $1/10$ điểm nếu vắng mặt hoặc chuẩn bị sơ sài ở buổi gặp mặt đầu môn (Tuần 2–3):**
   * **File yêu cầu:** `seminar-general-requirement.pdf` – Trang 1, mục *Tiến độ và đánh giá - Gặp mặt đầu môn học*.
2. **Trừ $3/10$ điểm nếu không nộp bài chấm điểm ở Tuần 6 hoặc nội dung chưa đạt $90\%$ so với bài seminar chính thức:**
   * **File yêu cầu:** `seminar-general-requirement.pdf` – Trang 1 & Trang 2, mục *Tiến độ và đánh giá - Nộp bài chấm điểm: Tuần 6*.
3. **Trừ $4/10$ điểm nếu không nộp trước / không trình bày thử nội dung seminar với Giảng viên thực hành (GVTH) trước tuần báo cáo:**
   * **File yêu cầu:** `seminar-general-requirement.pdf` – Trang 2, mục *Tiến độ và đánh giá - Trình bày thử: Trước Tuần seminar*.
4. **Mất điểm trình bày nếu Slide quá ngắn (5–10 trang), thiếu minh chứng làm việc nhóm, thiếu 3 kịch bản demo/công cụ hoặc sai quy chuẩn hiển thị:**
   * **File yêu cầu:** `seminar-general-requirement.pdf` – Trang 1, mục *Yêu cầu chung*, *Yêu cầu về nội dung* (mỗi công cụ cần ít nhất 3 kịch bản demo: cài đặt, cơ bản, luồng phức tạp; đủ 3 phần: *Record and Playback*, *Data driven*, *Checkpoints*) & *Yêu cầu về trình bày* (slide chữ to rõ, nền trắng chữ đen; video nền trắng chữ đen, thuyết minh rõ ràng, đăng YouTube và chèn link vào slide).

---

#### C. Lưu ý kỹ thuật đặc thù khi chạy tải trên hệ thống EShop
* **Chú ý hiện tượng khóa cơ sở dữ liệu (SQLite single-connection / lock contention) khi chạy mức tải 50 VUs (Baseline) và 500 VUs (Spike):**
  * **File yêu cầu:**
    * `T05_Performance_Testing.docx.pdf` – Trang 1, Mục 1 *Overview* (*"Node.js + SQLite backend"*), Trang 2, Mục 6 *Study Milestones* (Mục 3: *"Run baseline 50 VU for 5 min on the local backend (be careful: SQLite + single connection)"*) & Mục 7 *Audience takeaways* (*"SQLite is fine for HW; production SUTs would need pooled Postgres + connection limits"*).
    * `T05_Performance_Testing_InClass.pptx.pdf` – Trang 2 (*Why this matters*), Trang 3 (*Expected takeaways*) & Trang 8 (*3 things to remember*).
    * `Proposal_Report.pdf` – Trang 6, Mục 10.2 *Test Scenario*, Mục 10.3 *Performance Requirements* & Trang 7, Mục 11 *Phân tích Bottleneck* (*"Database: Slow query, missing index, N+1 query, lock contention"* và *"Infrastructure: CPU/RAM limitation, connection pool limitation"*).