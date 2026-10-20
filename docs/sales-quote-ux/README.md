# Cải tiến màn Báo giá Sales

- Click dòng sản phẩm, Enter/Space trên dòng, hoặc Enter trong ô tìm để thêm kết quả đầu. Nút Thêm vẫn hoạt động, không cộng hai lần do sự kiện nổi bọt; giữ xác nhận giá 0 và khóa nguồn SALE/KHO cũ.
- Chuyển nguyên khối ngày báo giá, hiệu lực, VAT và giảm giá xuống dưới hàng hóa; giữ ID, callback, payload và cách tính. Cột phải chỉ có tổng tiền và nút Lưu cao 56px.
- Lọc nhanh Tất cả / Hộp mực / Linh kiện / Dịch vụ sửa chữa; giao với từ khóa và dropdown nguồn/nhóm hiện có. Ưu tiên nhóm đã gán; hàng chưa có nhóm dùng tiền tố tên để lọc hiển thị. Không cập nhật phân loại sản phẩm trên server. Nhóm không khớp vẫn xem được ở Tất cả.

## Kiểm tra

`node --test test/quote-ui.browser.cjs`: **3/3 đạt**, Chromium headless, dữ liệu TEST. Kiểm tra chuột/Enter không nhân đôi, tìm không có kết quả, lọc chéo nguồn, không đưa máy in kèm hộp mực vào tab hộp mực, bố cục desktop/390px, giá 100.000 + VAT 8% − giảm 8.000 = 100.000. Ảnh `desktop.png`, `mobile-390.png`.

Bộ hồi quy Đơn bán có sẵn: `CHROMIUM_PATH=/usr/bin/chromium node --test test/don-ban/*.test.cjs test/don-ban/browser.cjs test/don-ban/collection-browser.cjs`: **38/53 đạt, 15 lỗi** (10 unit, 5 browser). Không sửa các test/hàm thu tiền trong việc này. Các unit lỗi không phụ thuộc Index.html; code.js/DonBan.js/DonBan.html không đổi. Đã chạy lại riêng browser test “money format/caret/paste...” bằng **Index.html từ HEAD trước sửa**, vẫn lỗi `false !== true` như bản sau sửa. Bộ test cũ còn kỳ vọng luồng chờ Finance trong khi commit hiện tại 01b0e8c đã đổi sang thu tiền trực tiếp; không tuyên bố toàn bộ hồi quy đạt.

Chưa deploy hoặc kiểm tra trên Google thật. Không thay đổi server, báo giá/PDF/hợp đồng, hoặc dữ liệu thật.

## Thử deploy sau khi chủ cho phép

Source `6aba576` đã push main, kích hoạt [run 39473744173](https://github.com/tinhocthanhduc-dotcom/SALE_THANHDUC/actions/runs/39473744173). GitHub chặn trước khi runner bắt đầu vì lỗi thanh toán/hạn mức Actions; không có bước push Apps Script nào chạy, app Google chưa được cập nhật. Máy này cũng không có credential Apps Script dùng được để deploy trực tiếp. Cần chủ xử lý Billing & plans rồi chạy lại run trên; không cần sửa lại code hoặc gửi khóa vào chat. Xem deployment-attempt.json.
