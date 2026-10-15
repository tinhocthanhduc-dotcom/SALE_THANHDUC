# Thiết kế điện thoại cho thợ — 15/10/2026

Nguồn: README.md và design/ trong gói thiết kế người dùng gửi ngày 15/10/2026. Prototype chỉ được mở trên web server tĩnh để tham khảo và bấm thử; React/Babel của prototype không được đưa vào app. Source hiện tại là `ui.html.txt` (index.html) và `ui.js.txt` (app.js); build GAS vẫn dùng loader hiện có.

## Bước (a) — token và khung chung

Chỉ hiển thị khi `body.is-tech` và viewport ≤750px. Giữ nguyên giao diện desktop và các vai trò điều phối/kho/kế toán/giám đốc. Token màu/kích thước trong một media query, font Be Vietnam Pro tải khi mở màn thợ mobile, fallback system-ui. Chữ tối thiểu 16px; CTA 62px; tab 64px; nội dung có container cuộn block bên trong khung flex để thẻ không co.

- Thanh trên: tiêu đề 22px, quay lại, đường vào Tài khoản, trạng thái mạng và thời gian query thành công gần nhất. Chip ảnh đọc queue hiện có, đếm cả ảnh đang tải/lỗi; không bịa phần trăm khi transport chưa có progress thực.
- Dải DỮ LIỆU THỬ chỉ hiện khi body khai báo environment=staging; các build hiện tại đều là staging. Không thay notice của vai trò khác.
- Hai tab gốc Việc của tôi / Tiền tôi giữ, số liệu từ projection đã cấp quyền. Trang con ẩn tab; Đã kết thúc / Đã đóng và Đăng xuất vẫn vào được qua Tài khoản.
- Thanh đáy tái sử dụng nút `.detail-cta` hoặc nút lập NQ gốc bằng di chuyển DOM, không clone nút/không thêm command. Khi quay về desktop trả nút về chỗ cũ. Giữ nextAction/photosReady và handler gốc. Dialog mở thì thanh CTA nền ẩn.
- Thành công tự tắt sau 2,4 giây riêng thợ mobile. Lỗi giữ lại theo hành vi app, không đổi thành toast tự mất. Khôi phục vị trí cuộn bên trong main khi query tự làm mới; polling/backoff/protected forms không đổi.

Các hàm app.js đã chỉnh: `message`, `refresh` (thời điểm hiển thị/vị trí cuộn), `resetLogin`, `render`, `account`, `patchPhotos` (cập nhật chip). Thêm `techMobile`, `updateTechHeader`, `updateTechCashAction`, `renderTechShell`; listener giao diện cho back, connectivity và viewport/dialog. Không đổi API, server, domain, xác thực, payload hay queue gửi ảnh.

## Các bước tiếp theo — chưa làm trong (a)

(b) `board`: nhóm Hôm nay/Sắp tới/Chờ linh kiện, thẻ và CTA việc gấp nhất. Trong (a), root dùng nút Tải lại danh sách; thẻ hiện tại vẫn giữ nguyên nội dung.

(c) `detail`, `openForm`: thẻ chi tiết, timeline và bottom sheet lịch hẹn.

(d) `updatePickupFields`, phần pickup của `openForm`: lấy hàng, stepper; giữ quy tắc lấy đủ mới được bắt đầu.

(e) phần complete của `openForm`, `chargeEditor`, `patchPhotos`: bố cục nghiệm thu; giữ đầy đủ consent và ảnh hiện có.

(f) `moneyForm`, `bankDetails`, `paymentList`: giao diện thu; dùng binding ngân hàng cố định của bản v38.

(g) `myCash`, `depositCards`: thẻ tiền giữ và phiếu NQ; giữ nguyên xác nhận số thực nhận.

(h) các màn trống/mất mạng: chỉ mô tả đúng khả năng app hiện có.

## Điểm mẫu khác nghiệp vụ — giữ hành vi app

- Polling hiện 20 giây và dừng khi ẩn; không đổi sang 30 giây theo chữ mẫu.
- App chưa có queue offline bền vững cho các command. Không hứa “đã lưu trên máy, tự gửi” cho thao tác ghi; ảnh queue hiện tại giữ nguyên, không thêm persistence.
- Tiền báo thu ban đầu để trống, thợ chủ động bấm Thu đủ; không mặc định thu hết. Danh mục tiền không được hard-code chỉ ba dòng mẫu, dùng các hình thức đang hoạt động.
- Nội dung chuyển khoản vẫn là mã đơn theo server; không đổi thành mã bỏ gạch + THANH TOAN.
- `customer_accepted` và `customer_agreed` là hai xác nhận khác nhau. Không gộp sai chỉ vì nhãn mẫu. Vẫn hỗ trợ nhiều dòng công/vật tư tính tiền và miễn phí có xác nhận.
- Phiếu nộp quỹ dùng NQ, không đổi thành PN theo dữ liệu giả của prototype (PN dành nghiệp vụ nhận kho).
- Lỗi vẫn giữ trên màn hình. Không đổi các quy tắc này trong công việc chỉ làm bố cục/CSS.

## Kiểm tra

`ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/technician-shell-browser.cjs` kiểm 390px, mép 750/751px, CTA/tab, số liệu thật từ fixture domain, giữ cuộn, tránh trùng command, form NQ, các đường vào lịch sử, chip queue/lỗi, chặn nghiệm thu khi ảnh chưa lưu và bốn vai trò khác. `DISPATCH_TECH_SCREENSHOTS=<thư mục ngoài checkout>` xuất ảnh 390px. Browser test nghiệp vụ chỉ cập nhật đường đi menu/selectors theo layout; không bỏ kiểm nghiệp vụ.
