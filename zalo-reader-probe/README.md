# Thử đọc hai nhóm Zalo — bản 0.1

Đây là tiện ích Chrome thử khả năng đọc DOM của Zalo Web trên máy chủ tài khoản. Không phải bot đã vận hành. Không kết nối Kho, không gửi tin, không chốt phiếu và chưa cài lịch 11:55/15:55/18:55.

## Cài trên Windows (không cần Node/Python)

1. Tải ZIP, giải nén thành một thư mục cố định. Thư mục chọn để cài phải chứa `manifest.json`.
2. Mở Chrome, nhập `chrome://extensions` trên thanh địa chỉ. Bật **Chế độ dành cho nhà phát triển**.
3. Bấm **Tải tiện ích đã giải nén** / **Load unpacked**, chọn thư mục ở bước 1. Ghim **Thành Đức · Thử đọc Zalo** qua biểu tượng mảnh ghép.
4. Mở `https://chat.zalo.me`, đăng nhập trực tiếp với Zalo, rồi tải lại trang. Không gửi mật khẩu, QR đăng nhập, cookie hoặc hồ sơ Chrome cho ai.
5. Mở đúng nhóm Kho 58. Bấm tiện ích, chọn **Kho 58 → 1. Chọn tên nhóm**. Popup đóng: bấm riêng tên nhóm ở đầu cuộc trò chuyện.
6. Mở tiện ích lần nữa → **2. Chọn khung tin**. Di chuột vào vùng chứa tin. Dùng phím ↑ để mở rộng tới khung chứa nhiều tin, ↓ để thu nhỏ; viền cam chỉ vùng sẽ đọc. Bấm chuột để chốt, Esc để hủy. Không chọn cả trang, thanh danh sách chat hoặc ô soạn tin.
7. Bấm **3. Đọc thử**. Xem tên nhóm và đoạn xem trước: phải khớp nhóm đang mở, không lẫn nội dung nhóm khác. Bấm lại không tăng số bản lưu nếu nội dung giữ nguyên.
8. Chọn **Theo dõi nhóm đang mở mỗi 15 giây**, chờ một tin chữ mới thực tế xuất hiện; kiểm tra bản mới có phần chữ đó. Không cần gửi tin bằng công cụ này. Đổi qua cuộc trò chuyện khác phải hiện dừng/sai nhóm, không lưu nội dung chat khác dưới tên Kho 58.
9. Mở nhóm Kho 145 và làm lại bước 5–8 với lựa chọn **Kho 145**. Bản thử không tự chuyển nhóm; chỉ đọc nhóm đang mở trong tab đang hiển thị. Máy ngủ, Chrome đóng hoặc tab ẩn thì không được coi là đang thu nhận.
10. F5 Zalo rồi thử lại với nhóm đã cấu hình. Nếu Zalo đổi DOM/selector thì chọn vùng lại; chưa được coi là quét bù đầy đủ. Có thể xuất JSON bằng **Xuất kết quả ra máy**, nhưng file có nội dung nhóm thật, chỉ giữ trên máy. Chỉ cần báo lại số bản/đọc đúng hay sai, không cần gửi tin kho thật.

## Điều kiện đạt thử nghiệm trên Zalo thật

- Đúng tên và chữ của hai nhóm trong bản xem trước, không lẫn nhóm khác.
- Tin mới khi nhóm đang mở được đọc sau một lượt 15 giây (browser có thể trì hoãn timer).
- Đọc lại cùng nội dung không tạo thêm cùng bản snapshot; đây chưa phải chống trùng từng tin.
- F5/đăng nhập lại: còn dữ liệu đã lưu, hoặc có lỗi rõ để chọn vùng lại, không đọc nhầm.
- Không tự nhấn Gửi, không thay ô soạn tin, không sửa Kho.

## Giới hạn và bộ nhớ

Chỉ đọc chữ trong khung DOM Zalo đã tải. Không có API riêng, không đọc cookie, không OCR ảnh/file/ghi âm, không tự cuộn/quét toàn bộ lịch sử, không xác minh người gửi hoặc ID tin, không theo dõi đồng thời hai nhóm khi chỉ một nhóm đang mở. Snapshot thay đổi có thể do cuộn/tải thêm chứ không phải có tin mới. Phải đối chiếu thủ công; chưa dùng dữ liệu này để tự ghi sổ.

Dữ liệu/config chỉ lưu trong chrome.storage.local của tiện ích, tối đa 100 bản hoặc khoảng 900.000 ký tự JSON, đầy thì dừng lưu thay vì xóa bản cũ. Không gửi dữ liệu sang server/AI. Một tab Zalo để thử; chưa hỗ trợ ghi đồng thời từ nhiều tab. Nút xóa chỉ xóa dữ liệu thử của nhóm đã chọn, không xóa tin Zalo. Gỡ tiện ích sẽ mất bộ nhớ cục bộ nếu chưa xuất.

Bản thử chưa xác minh chạy được trên Zalo thật/Chrome Windows. Test phát triển dùng dữ liệu TEST và Chromium giả lập trang; máy cloud không có phiên Zalo của chủ. Để tự động hóa lâu dài cần chứng minh nguồn tin đủ đầy, ID/chống trùng tin, lấy bù lịch sử và khả năng chuyển nhóm trước.

## Phát triển

Không đổi các app Sales/Kho/Finance/Điều phối. Dùng checkout hiện có, không tạo worktree. Core test không cần cài thư viện:

`node --test zalo-reader-probe/test/core.test.cjs`

Browser test dùng Playwright và Chromium đã có trong môi trường; có thể đặt PROBE_PLAYWRIGHT_MODULE tới module Playwright và PROBE_CHROMIUM tới executable. Không cần server chạy nền:

`node --test zalo-reader-probe/test/core.test.cjs zalo-reader-probe/test/browser.cjs`

Đóng gói (không đóng gói dữ liệu, cookie hoặc profile):

`python zalo-reader-probe/package.py`
