# BÁO CÁO SLO 1 TRANG (1-PAGE SLO REPORT)
## ĐỀ TÀI T05: PERFORMANCE TESTING – ESHOP SUT (NHÓM 07)

* **Môn học:** Software Testing (CS423 / CSC15003) – Khoa CNTT, ĐHKHTN (FIT@HCMUS)
* **Sinh viên phụ trách:** Trương Thành Phát (MSSV: 23120319) – Technical & AI Lead
* **Công cụ thực nghiệm:** Grafana k6 v2.2.0 (Native Windows CLI)
* **Hệ thống SUT:** EShop (Backend Node.js + SQLite tại `http://localhost:3000`)
* **Ngày thực hiện:** 23/10/2026

---

## 1. Bảng Ma trận Thực thi Kiểm thử (Test Execution Matrix)

| Kịch bản kiểm thử | Cấu hình Virtual Users (VUs) | Thời gian chạy | Tổng HTTP Requests | Tỷ lệ lỗi (Error Rate) | Tỷ lệ Checks đạt | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Smoke Test** | 1 VU | 1 phút | 8 reqs | **0.00%** | **100% (13/13)** | **PASS** |
| **2. Baseline Load** | 50 VUs | 5 phút | 7,570 reqs | **0.00%** | **100% (14,807/14,807)** | **PASS** |
| **3. Spike Test** | 50 $\rightarrow$ 500 VUs | 5 phút | 59,621 reqs | **0.00%** | **100% (52,090/52,090)** | **PASS** |

---

## 2. Bảng Đối chiếu Tiêu chuẩn SLO Cam kết (Đối chiếu bài Baseline 50 VUs)

| Tiêu chuẩn SLO | Ngưỡng cam kết (Target SLO) | Kết quả đo thực tế (Actual) | Đánh giá | Ghi chú kỹ thuật |
| :--- | :---: | :---: | :---: | :--- |
| **Độ trễ phản hồi P95** | $\mathbf{< 500\text{ ms}}$ | **3.95 ms** | **PASS** | Vượt xa cam kết ($P95$ thực tế chỉ bằng $\approx 0.8\%$ mức trần cho phép). |
| **Tỷ lệ lỗi HTTP** | $\mathbf{< 1.0\%}$ | **0.00%** (0 / 7,570 reqs) | **PASS** | 100% các request đều phản hồi HTTP 200 thành công. |
| **Thông lượng (Throughput)** | $\mathbf{\ge 20\text{ req/s}}$ | **25.16 req/s** | **PASS** | Vượt mức thông lượng yêu cầu của bài toán EShop. |
| **Tải vi xử lý (CPU Backend)** | $\mathbf{< 80\%}$ | **12% – 16%** | **PASS** | Tiến trình Node.js chạy êm ái trên máy chủ thử nghiệm. |
| **Mức chiếm dụng RAM** | $\mathbf{< 300\text{ MB}}$ | **~87.4 MB** | **PASS** | Không phát hiện rò rỉ bộ nhớ (Memory Leak) trong suốt quá trình chạy. |

---

## 3. Bảng Chi tiết Hiệu năng theo từng API Endpoint (Baseline 50 VUs)

*Tổng số đơn hàng đặt thành công:* **331 đơn hàng** (Tỷ lệ Checkout chuẩn: $5.1\%$).

| Tên Endpoint | Phương thức | Số lượt gọi (Count) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) | Tỷ lệ lỗi |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `POST /api/login` | `POST` | 50 | 1.9 ms | 3.2 ms | 3.2 ms | 17.8 ms | 18.2 ms | 0.00% |
| `GET /api/products?search` | `GET` | 4,544 | 1.5 ms | 1.9 ms | 2.0 ms | 3.3 ms | 11.2 ms | 0.00% |
| `GET /api/products/:id` | `GET` | 1,651 | 1.4 ms | 1.9 ms | 2.0 ms | 4.5 ms | 9.4 ms | 0.00% |
| `POST /api/cart` | `POST` | 331 | 1.4 ms | 1.9 ms | 2.0 ms | 2.5 ms | 6.8 ms | 0.00% |
| `POST /api/apply-coupon` | `POST` | 331 | 1.9 ms | 2.8 ms | 2.9 ms | 5.0 ms | 8.1 ms | 0.00% |
| `POST /api/checkout` | `POST` | 331 | 5.0 ms | 10.4 ms | **13.6 ms** | **23.4 ms** | **30.5 ms** | 0.00% |
| `GET /api/orders/my-orders` | `GET` | 331 | 1.6 ms | 2.5 ms | 2.7 ms | 4.1 ms | 7.9 ms | 0.00% |

> **Nhận xét chuyên sâu:** Endpoint `POST /api/checkout` có độ trễ $P95 = 13.6\text{ ms}$ và $P99 = 23.4\text{ ms}$ (cao nhất trong toàn bộ 7 API). Điều này hoàn toàn khớp với dự đoán lý thuyết: Checkout là tác vụ **Ghi dữ liệu (Write operation)** xuống bảng `orders` của SQLite, đòi hỏi cơ chế đồng bộ ổ đĩa và khóa tệp, trong khi các API còn lại là tác vụ Đọc/Ghi bộ nhớ tạm (`SELECT` / In-memory cart).

---

## 4. Phân tích So sánh Năng lực Chịu tải: Baseline (50 VUs) vs Spike (500 VUs)

| Chỉ số đo đạc | Baseline Load (50 VUs) | Spike Test (500 VUs) | Tỷ lệ tăng trưởng | Phân tích hành vi hệ thống |
| :--- | :---: | :---: | :---: | :--- |
| **Tổng số HTTP Requests** | 7,570 requests | **59,621 requests** | **$\times 7.9$ lần** | Hệ thống xử lý khối lượng request khổng lồ trong cùng 5 phút. |
| **Thông lượng (Throughput)** | 25.16 req/s | **197.86 req/s** | **$\times 7.9$ lần** | Node.js Event-Driven thể hiện khả năng phục vụ non-blocking xuất sắc. |
| **Độ trễ P95 toàn cục** | 3.95 ms | **4.12 ms** | $+4.3\%$ | Độ trễ hầu như không bị suy giảm đáng kể dù tải tăng gấp 10 lần. |
| **Số đơn hàng tạo thành công** | 331 đơn hàng | **2,510 đơn hàng** | **$\times 7.6$ lần** | 2,510 đơn hàng được ghi thành công vào CSDL `database.sqlite`. |
| **Tỷ lệ lỗi tổng thể** | 0.00% | **0.00%** | Giữ vững 0% | Hệ thống tự phục hồi hoàn toàn sau pha sốc tải đỉnh 500 VUs. |

---

## 5. Kết luận & Khuyến nghị Kiến trúc (Architectural Takeaways)

1. **Kết luận Đánh giá SLO:** Hệ thống EShop **ĐẠT CHUẨN 100% (PASS)** đối với toàn bộ 5 tiêu chí SLO cam kết cho mốc Milestone M5.
2. **Khuyến nghị cho môi trường Production:**
   * Hiện tại, với SQLite trên ổ cứng SSD NVMe local, cơ chế hàng đợi bất đồng bộ của thư viện `sqlite3` trong Node.js đã xử lý tuần tự 2,510 lượt checkout mà không bị timeout.
   * Tuy nhiên, trên môi trường Production thực tế với hàng nghìn người dùng phân tán và độ trễ mạng thực, **SQLite (single-file lock) sẽ trở thành điểm nghẽn nghiêm trọng (Single Point of Contention)**. Cần chuyển đổi sang hệ CSDL phân tán có hỗ trợ Connection Pooling như **PostgreSQL** kết hợp phân tách cơ chế Read Replica và Write Master.
