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

23/23 kiểm thử Node đạt, không bỏ qua; gồm domain, HTTP/auth, recovery và GAS bundle/bridge với workbook giả lập. 21 kịch bản Chromium end-to-end đạt, không có page error. 71/71 kiểm thử ERP cũ đạt. Kết quả lưu `test-results.txt` và `browser-results.json`. Đây là kiểm chứng local/giả lập GAS, không thay thế nghiệm thu runtime Google.

Quyền command/query/ảnh kiểm tra trên máy chủ. Số đơn TD tự cấp; phân công/lịch/lần đến được lưu; chuyển thợ giữ trách nhiệm người cũ đến khi duyệt rồi thu hồi quyền. Nghiệm thu cần ảnh sau và biên bản của lần đến hiện tại. Ảnh private, replay/recovery giữ file đã được journal nhận. Các guard staging/marker và chặn 5 project legacy vẫn giữ.

## Phần còn lại

Giá/phí kiểm tra 0–200k, báo giá và duyệt; dòng công; định mức/cấp/nhận/trả vật tư và tiếp tục sau Chờ linh kiện; thu tiền/nộp quỹ/đối soát; quản trị tài khoản trên UI; ký vẽ, backup lịch và nhập dữ liệu nguồn. Nghiệm thu hiện giữ hồ sơ Chờ đối soát, không đồng nghĩa đóng hồ sơ tài chính hoặc hoàn thành toàn bộ SPEC_V1_1.

Tiếp tục UAT Google với tài khoản thợ được cấp bằng `provisionDispatchUser`, kiểm tra các điểm sửa và chạy benchmark trong editor. Không cần chạy lại setup hoặc đổi mật khẩu sau cập nhật mã. Tài khoản fixture local công khai không được đưa lên Google.
