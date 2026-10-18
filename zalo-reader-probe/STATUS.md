# Bản thử đọc Zalo — 18/10/2026

Đã làm tiện ích Chrome MV3 chỉ đọc khung chữ của nhóm đang mở do chủ chọn. Không có selector Zalo đoán sẵn, không có tài khoản/secret, không API Zalo riêng hay kết nối Kho. Chỉ lưu chrome.storage.local và xuất JSON khi chủ bấm. Không đọc cookie hoặc ô nhập; không gửi tin, không tự điều hướng nhóm, không ghi sổ.

Có chọn header/khung bằng chuột và ↑/↓/Esc, xác minh lại header trước đọc, theo dõi 15s chỉ khi tab hiển thị, lưu snapshot kèm SHA256, bỏ snapshot giống nhau trong cùng nhóm; tách hai nhóm; bộ nhớ có trần và không tự xóa bản cũ; lỗi DOM/quyền lưu hiện rõ. Nội dung được hiển thị bằng textContent, không chèn HTML từ tin nhắn.

Kiểm tra: 13/13 test (4 core + 9 browser trên trang TEST mô phỏng) đạt; có test nút xuất JSON, chống đọc nhầm nhóm, không lấy nội dung sidebar/draft, thay DOM, quota và chọn vùng bằng bàn phím. JS syntax check đạt. Không đổi source các app hiện có, không cần chạy bộ ERP vì không đụng đường code/dependency của ERP.

Chưa test Zalo thật/Windows/phiên của chủ. Thử nạp extension thật vào Chromium cloud bị chính sách quản trị chặn (Extensions.loadUnpacked: Loading of unpacked extensions is disabled by the administrator); không thay chính sách để vượt qua. Các bài browser chạy code nội dung/popup với chrome.storage/tabs giả lập, không được coi là xác nhận nạp extension native thành công.

ZIP chỉ gồm allowlist 6 file tiện ích + hướng dẫn + VERIFICATION.json, không có profile/cookie/tin nhắn. README/HUONG_DAN.html ghi đầy đủ bước chủ thử trên máy Windows. Cần chủ xác nhận đúng chữ hai nhóm, tin mới, chuyển nhóm và F5 trước khi kết luận đọc được trên Zalo.

Giới hạn: chỉ snapshot DOM đã tải, chưa tách từng tin/người gửi/ID; cuộn hoặc tải thêm cũng làm snapshot đổi. Chưa đọc ảnh/file, chưa quét bù lịch sử, chưa tự chuyển hai nhóm, chưa chống trùng nghiệp vụ. Chưa cài lịch 11:55/15:55/18:55 và chưa dùng để tự ghi kho. Tiếp theo chỉ mở rộng sau khi có kết quả thử thật.

## Bản 0.2 — tự mở hai nhóm (18/10/2026)

Chủ đã báo bản 0.1 hiện được chữ khi mở đúng khung nhóm; chưa coi đây là xác nhận đọc đủ hai nhóm/lịch sử. Bổ sung chọn riêng tên nhóm ở danh sách bên trái, quét hai nhóm một lần và lặp khoảng 30–45 giây khi tab hiển thị. Người dùng phải chọn nút mở của cả hai nhóm; không tự tìm/đoán nhóm theo tên gần giống.

Chỉ nhấn nhãn nhóm đã gán có chữ khớp tên; từ chối control gửi tin, khung tin hoặc ô nhập. Sau chuyển nhóm phải thấy header đúng và chữ đã đổi/ổn định ít nhất 700ms; không suy ra điều này là chứng minh đọc hết lịch sử. Dừng nếu người dùng thao tác lúc đang chuyển hoặc có draft; có Dừng tất cả. Đọc kiểm tra lại header/khung sau SHA256 để tránh lưu khi vừa đổi nhóm. Không xóa draft, không gửi tin. Mở nhóm có thể đánh dấu đã đọc trên Zalo.

18/18 test mô phỏng đạt (4 core + 14 browser), gồm trễ render khung sau header, chọn sai nhãn sidebar, draft, thao tác xen vào và bật/dừng quét hai nhóm. Chưa thử tự chuyển trên Zalo thật/Windows; cloud vẫn bị chặn nạp extension native như ghi ở trên. Không đổi quyền extension hoặc app khác. Chưa bật lịch ghi kho hay ghi sổ.

Cập nhật giữ dữ liệu: giải nén v0.2, chép đè file vào đúng thư mục tiện ích cũ, chrome://extensions bấm tải lại tiện ích, F5 Zalo. Sau đó chọn thêm nút mở nhóm ở sidebar cho mỗi kho. Có thể cần chọn lại header/pane nếu DOM đã thay đổi.
