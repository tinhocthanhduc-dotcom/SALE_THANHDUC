# Thử đọc hai nhóm Zalo — bản 0.10

Đây là tiện ích Chrome thử khả năng đọc DOM của Zalo Web trên máy chủ tài khoản. Không phải bot đã vận hành. Không kết nối Kho, không gửi tin, không chốt phiếu và chưa cài lịch 11:55/15:55/18:55.

## Bản 0.10 — mỗi giờ 09:00–19:00, tạm mở cửa sổ để tải tin

1. Xuất dữ liệu dự phòng; chép đè file đúng thư mục cũ → chrome://extensions → Tải lại tiện ích → F5 Zalo. Không thêm quyền so với 0.9. Cấu hình và nháp giữ nguyên.
2. Mở **Phiếu nháp và lịch quét**, bật **Bật lịch mỗi giờ 09:00–19:00 · tạm mở cửa sổ Zalo**. Lịch cũ ba mốc không tự chạy theo chế độ mới; cần bật lại ô này một lần. Bản mới tắt quét liên tục cũ khi trang Zalo tải lần đầu, và ẩn các nút bật quét liên tục.
3. Lịch cố định giờ Việt Nam: **09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00**, mỗi ngày. Bắt đầu từ mốc tiếp theo sau lúc bật. Chỉ thử một lượt/mốc; không chạy lịch ngoài khung này, không quét bù mốc trước/ngày trước. Alarm kiểm tra mỗi phút nên không bảo đảm đúng giây; nếu máy ngủ/Chrome bị treo qua phút đầu giờ thì bỏ lỡ mốc, chờ giờ kế hoặc quét thủ công.
4. Giữ Chrome đang chạy, máy thức, đăng nhập và chỉ một tab Zalo. Nên dùng cửa sổ/app Zalo riêng. Không tự tạo tab khi tab đã đóng hoặc tự đăng nhập. Không có cửa sổ hợp lệ sẽ báo lỗi trong màn lịch.
5. Đến lịch, kiểm tra có tin đang soạn trước. Nếu an toàn, khôi phục cửa sổ đang thu nhỏ, chọn tab Zalo, đưa lên trước, chờ khoảng 3 giây cho Zalo tải tin rồi quét hai nhóm. Có thể gián đoạn màn hình vài giây. Việc hiện cửa sổ không chứng minh Zalo đã đồng bộ đủ tin; cần đối chiếu thực tế.
6. Quét xong trả tab trước và cửa sổ làm việc trước. **Chỉ thu nhỏ lại khi trước đó cửa sổ Zalo đã thu nhỏ**; cửa sổ đang mở bình thường không bị tự thu nhỏ. Nếu có bấm/gõ/cuộn/chạm vào Zalo, chuyển tab/cửa sổ hoặc không xác định được trạng thái, để nguyên cửa sổ, không giành lại tiêu điểm. Quét lỗi vẫn cố trả trạng thái cũ nếu an toàn. Chrome/worker bị dừng giữa chừng có thể để cửa sổ mở; không hứa khôi phục trong trường hợp đó.
7. Muốn thử ngay: dùng Quét hai nhóm một lần khi Zalo đang hiện. Để thử tự mở/thu nhỏ: bật lịch trước mốc đầu giờ tiếp theo, thu nhỏ cửa sổ Zalo và kiểm tra lượt đó. Không bấm vào cửa sổ trong lúc nó quét. Kiểm tra tin mới nhất trên Zalo so với bản đọc/nháp.
8. **Dừng tất cả/Dừng mọi chế độ quét** tắt lịch. Các thao tác chọn lại cấu hình cũng tắt lịch, cần bật lại sau khi cấu hình xong. Phiếu nháp vẫn chỉ lưu trên máy, chưa ghi kho.

## Bản 0.9 — lịch quét và phiếu nháp cục bộ

### Cập nhật và dùng

1. Xuất dữ liệu cũ để dự phòng. Giải nén đè đúng thư mục tiện ích cũ → chrome://extensions → Tải lại → F5 Zalo. Giữ cấu hình và bản đọc cũ, không gỡ tiện ích. Không thêm quyền so với 0.8.
2. Bấm **Phiếu nháp và lịch quét** trong tiện ích. Đây là trang quản lý riêng của tiện ích, dữ liệu nằm trên chính hồ sơ Chrome này; chưa đồng bộ sang máy khác.
3. Nếu chỉ muốn ba lượt mỗi ngày, bấm **Dừng mọi chế độ quét** trước, rồi bật **Bật lịch quét ba lần mỗi ngày**. Giữ một tab Zalo đăng nhập, máy thức và Chrome đang chạy. Lịch độc lập với nút Tự quét liên tục.
4. Lịch 11:55, 15:55, 18:55 theo Asia/Ho_Chi_Minh. Alarm kiểm tra mỗi phút nên có thể chạy trễ. Chỉ tính mốc sau lúc bật lịch. Nếu bỏ lỡ vì mạng/ngủ, thử quét bù một lượt nội dung hiện tại trong cùng ngày; không phục hồi lịch sử tại đúng giờ đã bỏ lỡ và không bù các ngày trước.
5. Có thể **Quét hai nhóm một lần** trong popup bất cứ lúc nào, rồi bấm **Tạo nháp từ các bản đọc đã lưu** trên trang nháp. Quét nền/lịch thành công cũng tự tạo gợi ý nháp.
6. Mở từng phiếu để đối chiếu nguyên văn, nhập ngày, sửa kho/loại, bỏ các đoạn người nhận hoặc ghi chú bị tách nhầm thành hàng, thêm/sửa từng hàng và số lượng. Gõ mã TD sau khi tự kiểm tra với app Kho. Chưa có kết nối để tìm mã TD/tồn kho, không được hiểu mã gõ vào là đã được Kho xác minh.
7. Phiếu điều chuyển: xác nhận kho đi/kho đến bằng tay. Nếu hai nhóm cùng có tin về một điều chuyển, chọn một nháp để đối chiếu và **Bỏ qua** nháp còn lại. Chưa tự ghép hai đầu.
8. Tích đã đối chiếu → **Đánh dấu đã đối chiếu**. Đây chỉ là nhãn, **không ghi kho**. Dùng **Lưu nháp** nếu chưa đủ thông tin. Có thể lọc Cần kiểm tra/Đã đối chiếu/Bỏ qua và xuất JSON dự phòng. Chưa có nhập lại file JSON hoặc công cụ khôi phục tự động.

### Giới hạn cần biết

- Nhận diện gợi ý các dòng có “nhập kho / xuất kho / điều chuyển”, ưu tiên dạng đánh số hoặc có dấu hai chấm. Nội dung khác có thể chưa thành nháp; luôn so bản đọc gốc. Chưa đọc ảnh/OCR, chưa quản lý từng ID tin thật.
- Chỉ tự nhận ngày viết rõ dd/mm/yyyy hoặc dd/mm/yy từ dòng ngày. “Hôm qua/Hôm nay” để trống, không đoán từ giờ chụp. Người thực hiện/nhận và hướng chuyển chưa tự suy luận, phải kiểm tra nguyên văn và ghi chú.
- Chống tạo lại nháp bằng kho + ngày trong ngữ cảnh bản đọc + nội dung chuẩn hóa. Không tạo lại khi quét lại cùng khung, giữ sửa tay; không bảo đảm hai tin giống hệt là hai giao dịch khác nhau. Tin sửa hoặc mất ngữ cảnh ngày có thể tạo nháp khác. Nháp ở hai kho không tự gộp.
- Nháp lưu tách khỏi bản đọc, tối đa khoảng 2 triệu ký tự; báo đầy thay vì xóa tự động. Xóa bản đọc ở popup không xóa nháp đã tạo. Không có thao tác xóa nháp, chỉ Bỏ qua. Xuất file chứa nội dung nội bộ: lưu ở nơi riêng.
- Worker là nơi ghi nháp, xếp hàng các lệnh và kiểm tra version khi hai cửa sổ cùng sửa. Tin gốc trong nháp giữ nguyên. Không phải sổ kho hay chứng từ đã duyệt nghiệp vụ.
- Quét thành công nghĩa là đọc được DOM đã tải, không bảo đảm Zalo đồng bộ đủ tin khi chạy nền. Tab đóng/ngủ/Chrome tắt có thể bỏ lỡ. Chủ đã báo 0.8 chạy nền ổn; 0.9 vẫn cần thử trên máy chủ.

## Bản 0.8 — thử quét nền mỗi phút

Thay file trong đúng thư mục cũ, tải lại tiện ích ở chrome://extensions (chấp nhận quyền alarms nếu Chrome hỏi), F5 Zalo rồi bấm **Tự quét hai nhóm**. Chỉ giữ một tab/cửa sổ Zalo. Sau đó có thể thử thu nhỏ và làm việc ở tab khác. Không cần gỡ tiện ích hay xóa dữ liệu.

Bộ hẹn giờ Chrome gọi quét khoảng mỗi phút, kể cả tab không được chọn; không kích hoạt cửa sổ hay gửi tin. Khi tab hiển thị, vòng quét cũ vẫn hoạt động. Dừng tất cả tắt cả quét nền. Tin đang soạn vẫn chặn chuyển nhóm. Lỗi nền không tự tắt chế độ, lần sau thử lại. Mở nhiều tab Zalo thì báo tạm dừng để tránh đọc nhầm tab. Không tự mở lại tab bị đóng hay đăng nhập hộ.

**Chưa phải lịch 11:55/15:55/18:55.** Máy ngủ/tắt hoặc Chrome đóng thì không quét; Chrome có thể trì hoãn alarm hoặc đóng băng tab. Đọc DOM thành công không chứng minh Zalo đã đồng bộ đủ tin mới. Không tự khôi phục/đưa cửa sổ lên trước, không tự tải lại trang. Quyền mới chỉ là alarms, host vẫn chỉ chat.zalo.me; không có API riêng, cookie hoặc tải dữ liệu ra ngoài.

**Thử trên máy chủ:** quét một lần trước; thu nhỏ Zalo 3 phút, mở lại kiểm tra giờ quét tăng. Đối chiếu một tin mới do người trong nhóm gửi trong thời gian thu nhỏ với bản đọc. Nếu giờ tăng nhưng thiếu tin mới, Zalo chưa cập nhật DOM nền: giữ cửa sổ hiển thị và báo lại. Không coi trạng thái “nội dung giống” là bằng chứng không có tin mới.

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
