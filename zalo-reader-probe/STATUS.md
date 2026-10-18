# Bản thử đọc Zalo — 18/10/2026

Đã làm tiện ích Chrome MV3 chỉ đọc khung chữ của nhóm đang mở do chủ chọn. Không có selector Zalo đoán sẵn, không có tài khoản/secret, không API Zalo riêng hay kết nối Kho. Chỉ lưu chrome.storage.local và xuất JSON khi chủ bấm. Không đọc cookie hoặc ô nhập; không gửi tin, không tự điều hướng nhóm, không ghi sổ.

Có chọn header/khung bằng chuột và ↑/↓/Esc, xác minh lại header trước đọc, theo dõi 15s chỉ khi tab hiển thị, lưu snapshot kèm SHA256, bỏ snapshot giống nhau trong cùng nhóm; tách hai nhóm; bộ nhớ có trần và không tự xóa bản cũ; lỗi DOM/quyền lưu hiện rõ. Nội dung được hiển thị bằng textContent, không chèn HTML từ tin nhắn.

Kiểm tra: 13/13 test (4 core + 9 browser trên trang TEST mô phỏng) đạt; có test nút xuất JSON, chống đọc nhầm nhóm, không lấy nội dung sidebar/draft, thay DOM, quota và chọn vùng bằng bàn phím. JS syntax check đạt. Không đổi source các app hiện có, không cần chạy bộ ERP vì không đụng đường code/dependency của ERP.

Chưa test Zalo thật/Windows/phiên của chủ. Thử nạp extension thật vào Chromium cloud bị chính sách quản trị chặn (Extensions.loadUnpacked: Loading of unpacked extensions is disabled by the administrator); không thay chính sách để vượt qua. Các bài browser chạy code nội dung/popup với chrome.storage/tabs giả lập, không được coi là xác nhận nạp extension native thành công.

ZIP chỉ gồm allowlist 6 file tiện ích + hướng dẫn + VERIFICATION.json, không có profile/cookie/tin nhắn. README/HUONG_DAN.html ghi đầy đủ bước chủ thử trên máy Windows. Cần chủ xác nhận đúng chữ hai nhóm, tin mới, chuyển nhóm và F5 trước khi kết luận đọc được trên Zalo.

Giới hạn: chỉ snapshot DOM đã tải, chưa tách từng tin/người gửi/ID; cuộn hoặc tải thêm cũng làm snapshot đổi. Chưa đọc ảnh/file, chưa quét bù lịch sử, chưa tự chuyển hai nhóm, chưa chống trùng nghiệp vụ. Chưa cài lịch 11:55/15:55/18:55 và chưa dùng để tự ghi kho. Tiếp theo chỉ mở rộng sau khi có kết quả thử thật.
