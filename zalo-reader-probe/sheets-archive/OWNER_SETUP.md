# Cài tự lưu Google Sheets — 5 bước

Chỉ lưu bản đọc, chưa AI/chưa ghi kho. Cần một file riêng do chủ sở hữu. Không dùng file Kho, Finance hoặc Danh bạ.

## 1. Tạo file riêng

Mở https://sheets.new, đặt tên **THANH_DUC_ZALO_BAN_DOC**. Không bật chia sẻ công khai. Trong file chọn **Tiện ích mở rộng → Apps Script**.

## 2. Dán mã và tạo bảng

Mở file `sheets-archive/Code.gs` trong gói ZIP bằng Notepad. Sao chép toàn bộ, thay nội dung Code.gs của project mới. Lưu project tên **THANH_DUC_ZALO_ARCHIVE**.

Trên thanh chọn hàm, chọn **setupZaloArchive** → **Chạy** → cấp quyền Google theo tài khoản của chủ. Hàm tạo tab ZR_BAN_DOC trong đúng file đang mở. Chạy lại không xóa dữ liệu. Không sửa tên header.

## 3. Lấy khóa kết nối riêng

Chọn **createZaloArchiveConnection** → **Chạy**. Quay lại cửa sổ Google Sheet để thấy hộp thoại. Sao chép khóa vào nơi riêng tạm thời, không gửi vào chat/log. Khóa chỉ hiện trong hộp thoại; chạy lại tạo khóa mới và khóa cũ ngừng dùng. Không cần OpenAI API key.

Khóa kết nối lưu trong Script Properties của project và trong tiện ích để ký HMAC. Chỉ người quản trị được quyền sửa project này. File xuất bản đọc không chứa khóa.

## 4. Triển khai máy chủ lưu

Trong Apps Script chọn **Triển khai → Triển khai mới → Ứng dụng web**:

- Thực thi bằng: **Tôi** (chủ file).
- Ai có quyền truy cập: **Bất kỳ ai**. URL truy cập được công khai nhưng mọi thao tác ghi phải có chữ ký HMAC hợp lệ, thời gian lệch không quá 5 phút và nội dung khớp SHA-256. Không có dữ liệu công khai khi mở link.
- Bấm Triển khai, sao chép URL kết thúc bằng **/exec**. Không dùng URL /dev hoặc link Sheet.

Nếu chính sách Workspace không cho chọn Bất kỳ ai, dừng tại đây và báo lại để dùng gateway có xác thực khác; không đổi chia sẻ file dữ liệu sang công khai.

## 5. Nối tiện ích và thử

Cập nhật tiện ích 0.11: chép đè đúng thư mục cũ → chrome://extensions → Tải lại → F5 Zalo.

Mở tiện ích → **Tự lưu Google Sheets** → dán URL /exec và khóa từ bước 3 → tích **Bật tự gửi** → **Lưu cấu hình**. Chrome hỏi quyền script.google.com/script.googleusercontent.com thì cấp quyền cho tính năng này. Bấm **Kiểm tra kết nối**, phải hiện OK và ID đúng file đã tạo. Bấm **Gửi các bản chưa đồng bộ**; xem tab ZR_BAN_DOC có dữ liệu. Bấm lại không thêm dòng trùng.

Sau đó giữ lịch mỗi giờ 09:00–19:00 đã cài: sau mỗi lần đọc, bản chưa gửi sẽ tự chuyển lên. Alarm mỗi phút cũng thử gửi hàng đợi, không mở Zalo ngoài lịch. Tối đa 3 bản mỗi lượt; hết mạng thì giữ trên máy, thử lại 1/2/4/8/15 phút; có thể bấm gửi thủ công để thử ngay. Chưa đồng bộ phiếu nháp đã sửa, chỉ đồng bộ bản đọc gốc. Không gọi OpenAI.

## Xem dữ liệu, bảo vệ và giới hạn

- Mỗi dòng là một bản chụp khung tin, không phải một tin nhắn hay phiếu kho. Khác nội dung có thể chứa các tin cũ lặp lại. Mã ID chống lặp cả bản, chưa chống lặp từng tin.
- Nội dung chia thành 4 cột JSON để dưới giới hạn ký tự mỗi ô và tránh công thức. Chọn dòng → menu **Bản đọc Zalo → Xem bản đọc dòng đang chọn** để đọc đầy đủ. Tải lại Sheet nếu chưa thấy menu.
- Chưa có màn xem Sheet trong cuộc chat; ChatGPT không tự truy cập file này. Bước AI về sau cần kết nối xử lý riêng, chưa được bật.
- Chữ ký sai bị chặn trước khi mở Sheet; replay cùng bản trả receipt cũ. Mất phản hồi sau ghi vẫn thử lại không tạo thêm dòng. Endpoint công khai có thể bị gọi phá quota; HMAC chặn ghi trái phép, không thay cho gateway chống lạm dụng khi dùng quy mô lớn.
- Tắt **Bật tự gửi** và Lưu để ngừng tải bản đọc lên. Không xóa bản trên Sheet hay trên máy. Đổi khóa server thì cần dán khóa mới vào tiện ích. Chưa hỗ trợ đổi đích sau khi đã gửi để tránh ghi nhầm file.
- Bộ nhớ bản đọc trên máy vẫn có giới hạn cũ 100 bản / khoảng 900.000 ký tự; chưa tự xóa sau đồng bộ. Khi gần đầy, xuất dự phòng và kiểm tra đủ dữ liệu Sheets trước khi tự xóa bản cũ trong tiện ích. Không gỡ tiện ích để cập nhật.
- Chưa kiểm thử Google thật bản này. Cần chủ thử một bản, mất mạng/gửi lại và đối chiếu nội dung; không tuyên bố đã có đồng bộ thật trước bước 5.

## Khôi phục

Tắt tự gửi trong tiện ích, giữ file dữ liệu. Có thể quay về ZIP 0.10 (cùng thư mục, Reload, F5 Zalo); bản đọc/nháp cũ và dữ liệu Sheet không bị xóa. Có thể tắt deployment máy chủ hoặc tạo khóa mới để chặn thiết bị cũ. Không xóa Script Properties khi còn cần xác thực.
