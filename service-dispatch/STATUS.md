# Điều phối dịch vụ – trạng thái ngày 13/10/2026

App có máy chủ local và Apps Script staging riêng; Google đã khởi tạo và người dùng đã kiểm tra luồng nhận đơn, giao/nhận/hẹn/bắt đầu, chuyển thợ, ảnh và nghiệm thu. Project/deployment hiện tại lưu trong `ops/service-staging-20261013-01.project.json`. Cập nhật dùng lại project/deployment này, giữ nguyên Sheets, Drive, Script Properties và tài khoản.

## Sửa sau UAT

- Có hàm public `provisionDispatchUser`, kiểm tra Google active/effective user giống `setupDispatchStaging`. Cấp thợ qua hai Script Properties tạm, xóa sau xử lý; README hướng dẫn đúng hàm public. Chưa có màn hình quản trị tài khoản.
- Login băm ngoài ScriptLock, rồi đọc lại tài khoản, version, hash, salt, tham số và lockout trong khóa trước khi ghi. Kiểm thử thay đổi tài khoản/khóa đồng thời và số lần thất bại không bị ghi đè. Giữ PBKDF2-SHA256 600.000 vòng, tương thích tài khoản cũ.
- Thêm `benchmarkDispatchPassword` chỉ chủ project chạy được; đo chuỗi tổng hợp và log `hash_ms`, không đọc mật khẩu nhân viên. **Chưa có số đo thời gian GAS thực tế**: môi trường này không có phiên OAuth cục bộ để gọi function trên Google; workflow clasp chỉ push/deploy. Cần chạy phép đo trong editor trước khi quyết định thay thuật toán hoặc số vòng.
- Nhận đơn cho phép bỏ trống cả hai giờ, khu vực khách không bắt buộc. Khoảng giờ nhập một đầu hoặc sai thứ tự bị chặn. Thợ đã nhận đơn có giờ hẹn được Bắt đầu ngay; chưa hẹn cần chốt lịch trước.
- Điện thoại có link gọi, địa chỉ có Google Maps, lịch sử tiếng Việt và tên nhân viên, giờ không có giây, máy không serial không có dấu phân cách thừa.
- Form điện thoại báo lỗi ngay khi nhập chữ. Thợ chỉ thấy tab Việc của tôi; mở đơn đưa chi tiết vào tầm nhìn và có nút quay lại danh sách trên điện thoại.

## Kiểm chứng

28/28 kiểm thử Node đạt, không bỏ qua; gồm domain, HTTP/auth, recovery và GAS bundle/bridge với workbook giả lập. 25 kịch bản Chromium end-to-end đạt, không có page error. 71/71 kiểm thử ERP cũ đạt. Kết quả lưu `test-results.txt` và `browser-results.json`. Đây là kiểm chứng local/giả lập GAS, không thay thế nghiệm thu runtime Google.

Quyền command/query/ảnh kiểm tra trên máy chủ. Số đơn TD tự cấp; phân công/lịch/lần đến được lưu; chuyển thợ giữ trách nhiệm người cũ đến khi duyệt rồi thu hồi quyền. Nghiệm thu cần ảnh sau và biên bản của lần đến hiện tại. Ảnh private, replay/recovery giữ file đã được journal nhận. Các guard staging/marker và chặn 5 project legacy vẫn giữ.

## Phần còn lại

Giá/phí kiểm tra 0–200k, báo giá và duyệt; dòng công; định mức kho thợ, vật tư hỏng, xuất/nhận từng phần và đồng bộ app Kho; thu tiền/nộp quỹ/đối soát; quản trị tài khoản trên UI; ký vẽ, backup lịch và nhập dữ liệu nguồn. Nghiệm thu hiện giữ hồ sơ Chờ đối soát, không đồng nghĩa đóng hồ sơ tài chính hoặc hoàn thành toàn bộ SPEC_V1_1.

Tiếp tục UAT Google với tài khoản thợ được cấp bằng `provisionDispatchUser`, kiểm tra các điểm sửa và chạy benchmark trong editor. Không cần chạy lại setup hoặc đổi mật khẩu sau cập nhật mã. Tài khoản fixture local công khai không được đưa lên Google.

## Bổ sung bàn giao kho và thu máy cũ

Đã có trên mã staging: Kho/Giám đốc xuất đủ đề xuất với mã PX tự cấp → thợ nhận → tiếp tục cùng lần đến hoặc hẹn lại/new visit; ghi số thực dùng, tính dư và kho xác nhận trả với mã PN. Tạo biên nhận BN máy thu từ khách và kho nhận với mã NK, lưu tình trạng/phụ kiện, serial, mục đích và người đang giữ. Phiếu theo đơn được lưu trong journal/Sheets hiện tại; không đồng bộ tồn kho app Kho hoặc định giá máy cũ. Đơn đang Chờ linh kiện và tài khoản cũ được giữ nguyên.

Quyền kho/director, thợ được giao, replay/version, chặn tiếp tục khi chưa nhận, vật tư vượt số xuất, chặn chuyển bỏ lại tài sản và giám đốc duyệt hủy được kiểm thử. GAS bridge giả lập chạy thêm xuất/nhận/tiếp tục/ghi dùng/thu máy/nhận kho. Chromium chạy xuyên suốt thợ → kho → thợ, hoàn trả dư, chuyển thợ, máy cũ và nghiệm thu; không có page error. Cần UAT các bước mới trên Google. Admin hiện tại có vai trò director nên thử kho được ngay, không cần tạo tài khoản kho trước.

## Xử lý trắng màn hình sau gửi đăng nhập

Theo mô tả người dùng: giao diện trước đăng nhập hiện được, trắng sau gửi form. Chưa có log/Console của phiên Google để xác nhận nguyên nhân cụ thể. Đã chặn native navigation, nút riêng/Enter handler, khóa nút trước bootstrap/trong login, chỉ ẩn form sau query/render thành công, kiểm tra cấu trúc dữ liệu trả về và thông báo lỗi bootstrap độc lập.

28/28 Node và 25 kịch bản browser cũ vẫn đạt. Bộ browser mới kiểm gói GAS inline trong iframe sandbox với callback giả lập: 8 kịch bản, gồm đơn Chờ linh kiện hiện có, login/nút/Enter không điều hướng, lỗi bridge, null/malformed query giữ form và retry, bootstrap lỗi chặn submit và báo mã. Có kết quả `gas-ui-browser-results.json`. CI chạy thêm bộ này. Chưa xác minh đã hết lỗi trên Google thực tế; cần người dùng UAT bản cập nhật với phiên hiện tại.

## Chẩn đoán lỗi bootstrap trên Google

Người dùng thấy UI_RUNTIME_ERROR với nút đăng nhập bị khóa ngay khi tải: script chưa đến bước gắn handler. Artifact Index.html đã đối chiếu khớp nguồn, hai inline script parse được local. Chưa có dòng Console thực tế để xác định nguyên nhân. Bootstrap hiển thị thêm loại lỗi và dòng/cột; chỉ lỗi cú pháp hiển thị thông báo parser rút gọn, không log tài khoản/token/mật khẩu hoặc URL. Đây là bổ sung chẩn đoán, chưa phải xác nhận đã sửa nguyên nhân trên Google.

## Lỗi cú pháp trong Google document.write

Console người dùng xác nhận `SyntaxError: Failed to execute write on Document: missing ) after argument list`, trước khi script giao diện gắn handler. Cảnh báo unload không phải lỗi chặn đăng nhập. Chưa có bản nguồn đã được Google biến đổi để xác định ký tự gây lỗi.

Đã đổi đóng gói GAS: frontend được esbuild chuẩn hóa ES2017/ASCII, bỏ template literals; nguồn nằm trong payload base64 tĩnh và được loader nhỏ gắn qua script.text vào DOM. HTML truyền qua document.write không còn chứa mã ứng dụng với các chuỗi HTML lồng nhau. Loader kế thừa nonce nếu có; không eval mã từ người dùng hoặc tải thêm dịch vụ ngoài.

Kiểm thử GAS UI đổi sang document.write trong iframe sandbox, chạy đăng nhập, đơn Chờ linh kiện cũ, Enter, retry, dữ liệu lỗi và lỗi cú pháp thực sự ở bootstrap; thêm CSP nonce. 9 kịch bản đạt cùng 28/28 Node; cần người dùng UAT lại trên Google để xác nhận lỗi thực tế đã hết. Giữ nguyên cấu hình, tài khoản, dữ liệu và deployment.
