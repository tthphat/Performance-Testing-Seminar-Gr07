# SỔ TAY HƯỚNG DẪN THỰC THI KIỂM THỬ HIỆU NĂNG VỚI APACHE JMETER (ESHOP SUT)

* **Môn học:** Software Testing (CS423 / CSC15003) – FIT@HCMUS
* **Chủ đề:** T05 - Performance Testing (Nhóm 07)
* **Công cụ:** Apache JMeter (v5.6+)
* **Hệ thống kiểm thử (SUT):** EShop Backend (`http://localhost:3000`)

---

## 1. Cài đặt và Chuẩn bị Môi trường

1. **Yêu cầu Java:**
   * Máy tính đã cài đặt Java 8 trở lên (kiểm tra bằng `java -version`, hệ thống đã sẵn sàng với Java 23).
2. **Cài đặt Apache JMeter:**
   * Tải bản zip **Binaries** từ trang chủ: [Apache JMeter Download](https://jmeter.apache.org/download_jmeter.cgi) (ví dụ: `apache-jmeter-5.6.3.zip`).
   * Giải nén vào một thư mục (ví dụ: `C:\tools\apache-jmeter-5.6.3`).
   * Thêm đường dẫn thư mục `bin` vào biến môi trường `PATH` của Windows để có thể gọi lệnh `jmeter` ở mọi nơi.

---

## 2. Đối chiếu 3 Trụ Cột Cốt Lõi (Theo GeneralRequest.md)

1. **Record & Playback:**
   * Sử dụng component **HTTP(S) Test Script Recorder** của JMeter để bắt request trực tiếp từ trình duyệt khi duyệt EShop.
2. **Data-Driven Testing:**
   * Component **CSV Data Set Config** nạp dữ liệu tài khoản từ `users.csv` (`USER_EMAIL`, `USER_PASSWORD`, `USER_ID`). Đảm bảo mỗi thread/VU dùng tài khoản riêng, không bị trùng mã giảm giá hoặc lock SQLite.
3. **Checkpoints / Assertions:**
   * **Response Assertion:** Xác nhận mã HTTP trả về là 200.
   * **JSON Path Assertion & JSON PostProcessor:** Kiểm tra tính tồn tại và trích xuất `$.token` (JWT Token) để truyền vào Header `Authorization: Bearer ${JWT_TOKEN}` cho các request tiếp theo, cũng như xác nhận mã đơn hàng `$.orderId`.

---

## 3. Các Kịch Bản Kiểm Thử Demo

| Kịch bản | File kịch bản | Cấu hình | Mục tiêu |
| :--- | :--- | :--- | :--- |
| **1. Smoke Test** | `smoke_test.jmx` | 1 VU (Thread), 1 Loop | Health check 7 API chính, xác thực luồng nghiệp vụ. |
| **2. Baseline Load Test** | `baseline_load.jmx` | 50 VUs, Ramp-up 30s, chạy 5 phút (300s) | Đo lường hiệu năng theo mô hình thực tế (70% Search, 25% Detail, 5% Checkout). |
| **3. Spike/Stress Test** | `spike_test.jmx` | 200–500 VUs tăng đột ngột trong 10s | Kích hoạt điểm nghẽn của SQLite và phân tích mức tiêu thụ RAM của JVM. |

---

## 4. Hướng Dẫn Thực Thi (GUI vs Non-GUI CLI)

### 4.1. Chế độ GUI (Chỉ dùng để Debug và Soạn thảo kịch bản)
* Chạy lệnh `jmeter` để mở giao diện đồ họa.
* Nhấn `File -> Open` và chọn file `.jmx`.
* Bấm nút **Start (mũi tên xanh)** và xem chi tiết phản hồi tại cây **View Results Tree**.
> **CẢNH BÁO:** Không bao giờ dùng GUI để chạy kiểm thử tải chính thức vì việc hiển thị giao diện đồ họa làm tốn CPU/RAM của máy test, làm sai lệch kết quả đo lường!

### 4.2. Chế độ Non-GUI CLI (Bắt buộc dùng khi đo kiểm tải & lấy số liệu)
Mở Terminal tại thư mục `jmeter-eshop`:

1. **Chạy Smoke Test:**
   ```powershell
   jmeter -n -t smoke_test.jmx -l results/smoke_result.jtl
   ```

2. **Chạy Baseline Load Test và Tự Động Sinh HTML Dashboard Báo Cáo:**
   ```powershell
   jmeter -n -t baseline_load.jmx -l results/baseline.jtl -e -o results/dashboard/
   ```
   * `-n`: Non-GUI mode.
   * `-t`: Đường dẫn file kịch bản JMX.
   * `-l`: File lưu trữ log kết quả raw (`.jtl`).
   * `-e -o results/dashboard/`: Tự động tổng hợp và sinh thư mục báo cáo đồ thị HTML trực quan.

3. **Xem Báo Cáo HTML:**
   * Mở file `results/dashboard/index.html` trên trình duyệt để chụp ảnh các biểu đồ:
     - APDEX (Application Performance Index)
     - Response Times Over Time & Percentiles ($P50, P90, P95, P99$)
     - Throughput (Transactions Per Second - TPS)
     - Error Rate (%)

---

## 5. Bảng So Sánh Kỹ Thuật: JMeter vs Grafana k6

Để đưa vào Slide seminar và Báo cáo so sánh công cụ:

| Tiêu chí | Apache JMeter | Grafana k6 |
| :--- | :--- | :--- |
| **Ngôn ngữ kịch bản** | XML (giao diện kéo thả GUI) | JavaScript / TypeScript (Code-as-test) |
| **Mô hình Concurrency** | **Thread-based** (1 User ảo = 1 OS/Java Thread) $\rightarrow$ Tiêu tốn nhiều RAM/CPU hơn khi đẩy lên cao (>1000 VU). | **Goroutines (Go-based)** $\rightarrow$ Rất nhẹ, 1 tiến trình có thể giả lập hàng chục ngàn VU. |
| **Hệ sinh thái Plugin** | Rất đồ sộ, lâu đời, hỗ trợ hầu hết giao thức (HTTP, JDBC, JMS, FTP, TCP,...). | Tập trung vào HTTP/gRPC/Websocket, hiện đại, tối ưu cho CI/CD pipeline. |
| **Báo cáo mặc định** | HTML Dashboard tĩnh rất chi tiết, có sẵn APDEX table. | Xuất ra Terminal, JSON, hoặc stream thời gian thực lên Grafana / InfluxDB. |
