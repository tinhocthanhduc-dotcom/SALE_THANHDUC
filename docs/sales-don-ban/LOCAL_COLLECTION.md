# Đơn bán — Thu tiền trực tiếp

Bản cập nhật 19/10/2026.

- Giao diện đơn bán có thẻ tổng giá trị, đã thu và còn phải thu; hỗ trợ điện thoại.
- Không đọc Finance, KQ_SALES hay FINANCE_DB_ID.
- Thu tiền ghi phiếu trạng thái Đã Thu Tiền ngay tại Sales; thu đủ cập nhật DON_BAN thành Đơn thành công trong cùng journal phục hồi. Thu một phần giữ số dư.
- Giữ RPC baoThu, sheet BAO_THU và mã BT để tương thích lịch sử và chống ghi trùng. Giao diện gọi thuTien.
- Báo thu cũ CHỜ XÁC NHẬN không tự chuyển thành đã nhận: vẫn giữ chỗ số tiền. Kiểm tra, hủy báo thu cũ rồi ghi nhận tiền thực nhận. Phiếu đã thu không hỗ trợ hủy trực tiếp.

Kiểm thử: 2 ca nghiệp vụ, 3 ca regression và 1 ca Chromium (390px/1440px, mất phản hồi và thử lại không trùng) đạt.

Cài lên Apps Script Sales: thay DonBan.html và DonBanServer.js bằng bản trong gói; giữ nguyên code.js, Index.html và dữ liệu. Đảm bảo project chỉ có một bản server Đơn bán. Sau đó cập nhật deployment web app đang dùng. Bản này chưa triển khai lên ứng dụng thật.
