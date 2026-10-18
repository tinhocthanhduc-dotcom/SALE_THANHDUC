# Thử đọc hai nhóm Zalo — bản 0.7

Đây là tiện ích Chrome thử khả năng đọc DOM của Zalo Web trên máy chủ tài khoản. Không phải bot đã vận hành. Không kết nối Kho, không gửi tin, không chốt phiếu và chưa cài lịch 11:55/15:55/18:55.

## Bản 0.7: bước 4 có viền nhưng bấm không lưu

Chép đè file vào đúng thư mục tiện ích cũ → chrome://extensions → Tải lại tiện ích → F5 Zalo. Không gỡ tiện ích, không cần xóa dữ liệu đã đọc.

Chọn Kho 58 → bước 4 → bấm dòng nhóm 58 bên trái; chờ xác nhận **Mở nhóm ✓**. Làm tương tự Kho 145 rồi **Quét hai nhóm một lần**. Trong lúc chọn, cú bấm không mở nhóm để tránh dòng bị dựng lại trước khi lưu. Nếu chưa hợp lệ, viền giữ lại và hiện “Chưa lưu: …”; chọn lại dòng hoặc Esc để hủy. Mở chế độ chọn sẽ dừng tự quét/theo dõi; bật lại sau khi kiểm tra quét một lần thành công.

38/38 kiểm thử mô phỏng đạt. Chưa xác nhận bản 0.7 trên Zalo thật của chủ.

## Bản 0.6: nhóm đã chuyển nhưng báo chưa xác minh khung

Chủ xác nhận v0.5 đã chuyển nhóm rồi báo timeout. Đã xử lý hai trường hợp trong code: khung được giữ trong DOM nhưng đang ẩn (mở lại cùng chữ, không cần đợi chữ đổi); khung bị tạo lại với ID khác sau chuyển. Lưu đường dẫn cấu trúc từ đúng header/pane do chủ chọn, chỉ dùng lại khi tên nhóm khớp chính xác và khung thực sự hiển thị, không nằm trong sidebar. Không tìm nội dung toàn trang hay bỏ bước kiểm tên nhóm.

Cập nhật: chép đè v0.6 vào thư mục cũ → tải lại tiện ích → F5 Zalo → thử Quét hai nhóm một lần. Không cần chọn lại bước 4 vì nút mở nhóm đã hoạt động. Đọc thử thủ công sẽ tự học thêm đường dẫn cho cấu hình cũ. Nếu thông báo mới chỉ rõ khung tên hoặc khung tin đổi đường dẫn, mở đúng kho đó chọn lại bước 1/2 tương ứng, bấm Đọc thử rồi quét lại.

Khung hiển thị được kiểm tra cả display/visibility/opacity, aria-hidden và vị trí ngoài màn hình. Lỗi timeout mới nêu Kho 58/145 và phân biệt tên nhóm chưa đúng, mất khung tin hoặc chữ chưa ổn định. Không lưu khi không xác minh được. Vẫn chưa xác nhận v0.6 trên Zalo thật.

## Bản 0.5: sửa gán dòng mở nhóm và tự chuyển hai nhóm

Lỗi chủ báo: “Chưa chọn đúng tên nhóm trong danh sách bên trái”. Bản trước dùng chung một lỗi cho thiếu bước 4, chọn cả dòng có preview và nút mở không hợp lệ; đồng thời chỉ nhấn click nên có thể không mở layout dùng mousedown.

Sau cập nhật, giữ tên nhóm/khung tin đã đọc tốt. Với Kho 58 rồi Kho 145, bấm **4. Chọn dòng nhóm ở danh sách trái** và bấm dòng nhóm đó (có thể bấm cả phần xem trước/ảnh đại diện). Công cụ tìm nhãn khớp chính xác tên đã gán trong vùng sidebar được chọn; không tìm gần đúng. Mỗi kho phải hiện **Mở nhóm ✓**. Sau đó thử **Quét hai nhóm một lần**, đối chiếu kết quả, rồi mới bật tự quét.

Có lưu phạm vi danh sách bên trái để tìm lại nhãn đúng khi thứ tự chat đổi; không tìm toàn trang, không tự đoán khi có nhiều nhãn trùng tên. Phát chuỗi pointer/mouse xuống/lên/click đến đúng nhãn, không cấp quyền debugger hay giả isTrusted. Zalo có thể yêu cầu thao tác native mà DOM event không đáp ứng; trường hợp đó sẽ timeout rõ thay vì coi là đã mở. Chưa xác nhận v0.5 trên Zalo thật.

Thông báo mới chỉ rõ Kho 58/145 thiếu bước nào; popup hiển thị tình trạng tên nhóm/khung tin/nút mở. Cập nhật vẫn bằng chép đè cùng thư mục → tải lại tiện ích → F5 Zalo. Bước 4 cần chọn lại cả hai nhóm để lưu vùng danh sách mới.

## Bản 0.4: ẩn mã biểu tượng Zalo

Mặc định bỏ các dòng chỉ chứa /-strong, /-heart, :>, :o, :-((, :-h (kể cả nhiều mã cùng dòng). Không xóa dòng có chữ hàng hóa hoặc số lượng; mã lạ không tự đoán. Popup và màn hình đầy đủ đều dùng chung bộ lọc. Màn đầy đủ có **Hiện bản gốc (cả mã biểu tượng)** để đối chiếu.

Bộ nhớ vẫn giữ text gốc và khóa snapshot như cũ. File xuất thêm cleaned_text đã lọc cho mỗi bản; text gốc không bị sửa. Cập nhật bằng cách chép đè v0.4 vào đúng thư mục tiện ích đã cài, bấm tải lại tiện ích và F5 Zalo. Các bản cũ đã lưu cũng được lọc khi xem, không cần đọc lại.

## Bản 0.3: sửa thiếu tin cuối trong phần xem trước

Bản 0.1/0.2 lưu cả khung chữ đã chọn nhưng popup chỉ hiện 1.400 ký tự đầu. Bản 0.3 bỏ giới hạn xem trước và tự cuộn tới cuối, hiển thị số ký tự, thêm **Mở bản đọc đầy đủ** ở tab riêng (chọn xem cả bản cũ, Ctrl+F để tìm).

Cập nhật: chép đè file v0.3 vào đúng thư mục tiện ích cũ → chrome://extensions bấm tải lại tiện ích → F5 Zalo. Không xóa dữ liệu/cấu hình. Bấm Đọc thử rồi kiểm tra dòng cuối (ví dụ tin thứ 17) trong phần xem trước hoặc màn đầy đủ. Nếu cả bản đầy đủ vẫn không có tin đó thì khung đã chọn chưa bao hết phần tin Zalo đã tải; cần chọn lại khung, không coi là chỉ lỗi hiển thị. Chưa tự quét lịch sử hoặc đồng bộ tin từ Zalo PC. Nếu chính Zalo Web chưa hiện các tin có trên điện thoại/PC, dùng chức năng **Đồng bộ tin nhắn gần đây** của Zalo (nếu đang hiện) trước; tiện ích không tự tạo/lấy tin chưa được Zalo Web tải.

Mở tab xem đầy đủ sẽ làm tab Zalo ẩn và tạm dừng vòng quét cho tới khi quay lại. Thông báo **Quét hai nhóm** được tách khỏi trạng thái đọc nhóm đang mở; lỗi nút mở nhóm không đồng nghĩa lưu bản đọc thủ công thất bại.

## Cập nhật từ bản 0.1

Giải nén ZIP v0.2 vào thư mục cố định, vào chrome://extensions gỡ bản cũ rồi tải tiện ích đã giải nén từ thư mục mới. Nếu muốn giữ bộ nhớ/cấu hình cũ, thay các file của bản cũ bằng file v0.2 trong đúng thư mục đã cài rồi bấm nút tải lại tiện ích; không cần gỡ. Sau đó F5 Zalo Web. Xuất dữ liệu cũ trước khi gỡ vì bộ nhớ tiện ích gỡ ra sẽ mất.

Để không phải tự mở từng nhóm mỗi lượt:

1. Giữ cấu hình tên nhóm + khung tin hiện có cho từng kho (nếu đổi giao diện thì chọn lại).
2. Với từng lựa chọn Kho 58/Kho 145, bấm **4. Chọn dòng nhóm ở danh sách trái**, rồi bấm dòng nhóm tương ứng ở danh sách chat bên trái. Có thể chọn tên hoặc phần xem trước của dòng. Lúc chọn, tiện ích chỉ lưu nút mở nhóm, không mở hay gửi tin.
3. Bấm **Quét hai nhóm một lần**. Tiện ích tự mở 58 rồi 145, chờ tên và khung chữ phù hợp, rồi lưu bản đọc. Nếu nhóm không nằm trong phần danh sách đang tải hoặc vị trí đổi thì cần chọn lại; không tự tìm gần đúng.
4. Đối chiếu hai bản đọc trước khi bật **Tự quét hai nhóm (khoảng 30 giây)**. Giữ tab Zalo hiển thị, không thu nhỏ Chrome/cho máy ngủ. Chỉ dùng một tab để thử. **Dừng tất cả** để tắt.
5. Chuyển nhóm có thể đánh dấu tin đã đọc trong Zalo. Không dùng chế độ này trên tab đang chat công việc. Tiện ích dừng nếu anh thao tác trong lúc chuyển nhóm hoặc có chữ đang soạn; không tự gửi hoặc xóa chữ đó.

Quét hai nhóm vẫn chỉ lấy phần DOM đã tải, không chứng minh có đủ tin giữa các lượt. Cần đối chiếu thực tế; chưa dùng để ghi sổ. Nhóm trùng tên cần phân biệt/đổi tên trước vì bản thử chưa xác minh ID nhóm.

## Cài trên Windows (không cần Node/Python)

1. Tải ZIP, giải nén thành một thư mục cố định. Thư mục chọn để cài phải chứa `manifest.json`.
2. Mở Chrome, nhập `chrome://extensions` trên thanh địa chỉ. Bật **Chế độ dành cho nhà phát triển**.
3. Bấm **Tải tiện ích đã giải nén** / **Load unpacked**, chọn thư mục ở bước 1. Ghim **Thành Đức · Thử đọc Zalo** qua biểu tượng mảnh ghép.
4. Mở `https://chat.zalo.me`, đăng nhập trực tiếp với Zalo, rồi tải lại trang. Không gửi mật khẩu, QR đăng nhập, cookie hoặc hồ sơ Chrome cho ai.
5. Mở đúng nhóm Kho 58. Bấm tiện ích, chọn **Kho 58 → 1. Chọn tên nhóm**. Popup đóng: bấm riêng tên nhóm ở đầu cuộc trò chuyện.
6. Mở tiện ích lần nữa → **2. Chọn khung tin**. Di chuột vào vùng chứa tin. Dùng phím ↑ để mở rộng tới khung chứa nhiều tin, ↓ để thu nhỏ; viền cam chỉ vùng sẽ đọc. Bấm chuột để chốt, Esc để hủy. Không chọn cả trang, thanh danh sách chat hoặc ô soạn tin.
7. Bấm **3. Đọc thử**. Xem tên nhóm và đoạn xem trước: phải khớp nhóm đang mở, không lẫn nội dung nhóm khác. Bấm lại không tăng số bản lưu nếu nội dung giữ nguyên.
8. Chọn **Theo dõi nhóm đang mở mỗi 15 giây**, chờ một tin chữ mới thực tế xuất hiện; kiểm tra bản mới có phần chữ đó. Không cần gửi tin bằng công cụ này. Đổi qua cuộc trò chuyện khác phải hiện dừng/sai nhóm, không lưu nội dung chat khác dưới tên Kho 58.
9. Mở nhóm Kho 145 và làm lại bước 5–8 với lựa chọn **Kho 145**. Chế độ theo dõi nhóm đang mở không tự chuyển nhóm; chế độ quét hai nhóm phải cấu hình nút mở theo phần cập nhật ở trên. Máy ngủ, Chrome đóng hoặc tab ẩn thì không được coi là đang thu nhận.
10. F5 Zalo rồi thử lại với nhóm đã cấu hình. Nếu Zalo đổi DOM/selector thì chọn vùng lại; chưa được coi là quét bù đầy đủ. Có thể xuất JSON bằng **Xuất kết quả ra máy**, nhưng file có nội dung nhóm thật, chỉ giữ trên máy. Chỉ cần báo lại số bản/đọc đúng hay sai, không cần gửi tin kho thật.

## Điều kiện đạt thử nghiệm trên Zalo thật

- Đúng tên và chữ của hai nhóm trong bản xem trước, không lẫn nhóm khác.
- Tin mới khi nhóm đang mở được đọc sau một lượt 15 giây (browser có thể trì hoãn timer).
- Đọc lại cùng nội dung không tạo thêm cùng bản snapshot; đây chưa phải chống trùng từng tin.
- F5/đăng nhập lại: còn dữ liệu đã lưu, hoặc có lỗi rõ để chọn vùng lại, không đọc nhầm.
- Không tự nhấn Gửi, không thay ô soạn tin, không sửa Kho.

## Giới hạn và bộ nhớ

Chỉ đọc chữ trong khung DOM Zalo đã tải. Không có API riêng, không đọc cookie, không OCR ảnh/file/ghi âm, không tự cuộn/quét toàn bộ lịch sử, không xác minh người gửi hoặc ID tin, không nhận thông báo trực tiếp đồng thời từ hai nhóm: chế độ mới mở tuần tự hai nhóm; tab phải hiển thị. Snapshot thay đổi có thể do cuộn/tải thêm chứ không phải có tin mới. Phải đối chiếu thủ công; chưa dùng dữ liệu này để tự ghi sổ.

Dữ liệu/config chỉ lưu trong chrome.storage.local của tiện ích, tối đa 100 bản hoặc khoảng 900.000 ký tự JSON, đầy thì dừng lưu thay vì xóa bản cũ. Không gửi dữ liệu sang server/AI. Một tab Zalo để thử; chưa hỗ trợ ghi đồng thời từ nhiều tab. Nút xóa chỉ xóa dữ liệu thử của nhóm đã chọn, không xóa tin Zalo. Gỡ tiện ích sẽ mất bộ nhớ cục bộ nếu chưa xuất.

Bản thử chưa xác minh chạy được trên Zalo thật/Chrome Windows. Test phát triển dùng dữ liệu TEST và Chromium giả lập trang; máy cloud không có phiên Zalo của chủ. Để tự động hóa lâu dài cần chứng minh nguồn tin đủ đầy, ID/chống trùng tin, lấy bù lịch sử và khả năng chuyển nhóm trước.

## Phát triển

Không đổi các app Sales/Kho/Finance/Điều phối. Dùng checkout hiện có, không tạo worktree. Core test không cần cài thư viện:

`node --test zalo-reader-probe/test/core.test.cjs`

Browser test dùng Playwright và Chromium đã có trong môi trường; có thể đặt PROBE_PLAYWRIGHT_MODULE tới module Playwright và PROBE_CHROMIUM tới executable. Không cần server chạy nền:

`node --test zalo-reader-probe/test/core.test.cjs zalo-reader-probe/test/browser.cjs`

Đóng gói (không đóng gói dữ liệu, cookie hoặc profile):

`python zalo-reader-probe/package.py`
