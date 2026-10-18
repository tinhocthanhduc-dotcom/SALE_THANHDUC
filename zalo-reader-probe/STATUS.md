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

## Bản 0.3 — sửa phần xem trước bị cắt

Ảnh chủ gửi có popup dừng trước các dòng cuối. Code popup dùng text.slice(0,1400), còn snapshot lưu nguyên phần DOM đã chọn (tối đa 50.000 ký tự). Đã bỏ cắt hiển thị, tự cuộn phần xem trước xuống cuối khi có bản mới, giữ vị trí khi chỉ đổi status, hiện độ dài và thêm trang extension local xem toàn bộ bản mới/cũ theo kho. Render bằng textContent, không tải dữ liệu ngoài.

Tách nhãn trạng thái quét hai nhóm, xóa thông báo lỗi chọn nút cũ khi đã gán lại nút. Không thay cách thu nhận, không tự cuộn Zalo/đồng bộ lịch sử, không tăng quyền tiện ích. Không coi việc có đủ chữ trong snapshot là chứng minh đủ tin từ Zalo.

21/21 test mô phỏng đạt (4 core + 17 browser), thêm bản chữ dài có dòng 16/17 sau mốc 1.400 ký tự, popup hiện đủ và ở cuối, mở viewer local và xem bản cũ theo kho, không thực thi HTML trong tin. Chưa kiểm chứng bản 0.3 trên Zalo thật/Windows. Cập nhật ZIP bằng cách chép đè cùng thư mục, tải lại tiện ích và F5 Zalo; không cần gỡ/xóa bộ nhớ.

## Bản 0.4 — lọc mã biểu tượng riêng dòng

Dùng chung core.readable trong popup, viewer và trường cleaned_text khi xuất JSON. Bỏ dòng chỉ gồm các mã do chủ chỉ ra: /-strong, /-heart, :>, :o, :-((, :-h, kể cả tổ hợp/whitespace. Giữ nguyên dòng có nội dung hàng hóa, số lượng, ký hiệu lạ và mã chen trong câu; không tự xóa số đếm hoặc suy đoán phản ứng. Text gốc, digest và receipt snapshot không đổi; dữ liệu cũ được lọc lúc xem. Viewer mặc định bản sạch, có checkbox hiện gốc.

24/24 test mô phỏng đạt (6 core + 18 browser), gồm mã riêng dòng/tổ hợp, không mất dòng hàng/số lượng, toggle bản gốc và không ghi đè storage. Không đổi quyền Chrome hoặc cách đọc nhóm, không ghi kho/gửi tin, chưa test v0.4 trên Zalo thật/Windows.

## Bản 0.5 — lỗi gán nút mở nhóm

Chủ xác nhận đọc thủ công cả hai nhóm nhưng tự quét báo NAV_UNSAFE. Code cũ yêu cầu target.innerText bằng nguyên tên nhóm; click phần preview/avatar hoặc thiếu config một kho đều trả cùng lỗi. Chưa xác định trên máy chủ là ca nào; bản vá xử lý và phân biệt các ca này.

Binding cho phép click dòng/preview/avatar, đi lên trong phạm vi an toàn để tìm nhãn đúng duy nhất, lưu vùng sidebar. Khi quét tìm đúng nhãn trong vùng này, tránh lệ thuộc vị trí dòng/nth selector; tên trùng hoặc thiếu nhãn thì dừng. Nhận pointer/mousedown/up/click trên đúng nhãn để hỗ trợ handler mousedown; không giả trusted input, không mở rộng quyền extension. Gán bước 4 lại để có scope mới; giữ toàn bộ snapshot và config header/pane cũ. Popup hiện tình trạng cấu hình từng phần và lỗi nêu kho/bước thiếu.

29/29 test mô phỏng đạt (6 core + 23 browser), thêm chọn preview cả dòng, sidebar reorder, mousedown-only, nhãn trùng và thiếu entry Kho 145. Bản v0.5 tự chuyển vẫn chưa thử Zalo thật/Windows; cần chủ thử lại sau gán bước 4. Không ghi kho/gửi tin, không thay chế độ chỉ đọc DOM đã tải.

## Bản 0.6 — đã chuyển nhóm nhưng timeout kiểm khung

Chủ xác nhận có chuyển nhóm trước khi v0.5 báo SWITCH_TIMEOUT. Chưa xác minh DOM thực của máy chủ; đã tìm thấy và sửa các trường hợp lỗi có thể tái hiện trong code: pane đích được cache ẩn, bật lại chữ không đổi; pane/header đổi ID; pane được thay node nhưng chữ giống nhau. Bản cũ lấy oldText ngay cả từ khung đích đang ẩn rồi đòi chữ phải khác, gây timeout giả.

Chỉ so chữ cũ từ khung đang hiển thị. Chấp nhận việc khung ẩn trở nên hiển thị hoặc thay node sau mở, vẫn đòi tên đích khớp và khung/chữ ổn định 700ms. Kiểm display/visibility/opacity, aria-hidden và viewport, từ chối sidebar. Lưu primary ID và đường dẫn cấu trúc của đúng vùng đã chọn; chỉ fallback đường dẫn này nếu đúng tag/header và vùng an toàn, không dò nội dung toàn trang. Chọn vùng/đọc thủ công tự học cấu hình thêm, không xóa snapshot hay bắt gán lại nút mở. Timeout mới nêu kho và phân biệt thiếu header, pane hoặc chưa thấy thay đổi ổn định.

35/35 test mô phỏng đạt (6 core + 29 browser), gồm dynamic IDs hai lần quét liên tiếp, pane mới cùng chữ, nâng config cũ, sai tiêu đề vẫn chặn, cache display:none và cache đẩy ngoài viewport. Node syntax và git diff check đạt. Chưa thử v0.6 trên Zalo thật/Windows; không coi việc vượt test giả lập là đã sửa xong trên máy chủ. Không ghi kho hoặc gửi tin.

## Bản 0.7 — bước 4 có viền, bấm dòng nhưng không lưu

Chủ xác nhận picker mở được nhưng click không lưu. Đã tái hiện trên fixture tình huống handler mousedown của trang dựng lại dòng trước khi lưu. Picker chặn pointerdown/mousedown khi chọn; entry chỉ đóng sau khi save thành công. Lựa chọn sai giữ viền và hiện lý do, cho chọn lại; Esc hủy. Mở picker dừng autoScan/watch và hủy lượt chuyển nhóm đang chờ. Giữ nguyên quyền storage, dữ liệu cũ và phạm vi chỉ đọc.

38/38 test đạt (6 core + 32 browser), thêm mousedown rerender, chọn sai rồi chọn lại, dừng watcher khi cấu hình. Chưa thử v0.7 trên Zalo thật/Windows; nguyên nhân trên máy chủ chưa được xác minh trực tiếp. Không ghi kho/gửi tin.

## Bản 0.8 — quét nền thử nghiệm

MV3 service worker dùng chrome.alarms mỗi phút, gửi background-tick tới đúng một tab chat.zalo.me đã mở, không kích hoạt cửa sổ. Chỉ bật khi autoScan đã bật. Background context cho phép document.hidden nhưng giữ kiểm tra tên nhóm, frame CSS đang hiển thị trong trang, nội dung ổn định, vùng đã gán và draft. Dừng tất cả vẫn có hiệu lực; lỗi nền ghi trạng thái rồi thử lại ở alarm sau. Không tự mở, reload hoặc đưa cửa sổ lên trước. Thêm quyền alarms; không thêm quyền đọc host ngoài Zalo.

Chưa thử native Chrome Windows hay Zalo thật bản 0.8. Thời điểm DOM đọc thành công không chứng minh tin Zalo mới nhất đã đồng bộ khi thu nhỏ. Máy ngủ, Chrome tắt hoặc tab bị đóng băng vẫn ngăn quét; chưa có lịch ba mốc hằng ngày. Cần chủ thu nhỏ 3 phút và đối chiếu tin mới với bản đọc.

Kiểm thử: 34 browser fixture đạt; 6 core + 2 worker đạt sau cập nhật kiểm tra manifest cho quyền alarms/service worker mới, tổng 42 test. Node syntax và ZIP integrity đạt. Không có kiểm thử native cài tiện ích trong cloud (policy chặn unpacked extension).

## Bản 0.9 — lịch và phiếu nháp, chưa nối Kho

Thêm trang drafts.html từ popup: xem nguyên văn, sửa ngày/loại/kho, dòng hàng, mã TD gõ tay (chưa xác minh), số lượng, ghi chú; lưu/đối chiếu/bỏ qua, lọc, xuất JSON. Parser bảo thủ cho dòng nhập/xuất/điều chuyển; ngày tương đối để trống. Không tự ghép điều chuyển liên nhóm, không có ID tin thật nên fingerprint chỉ giảm nháp trùng, không bảo đảm duy nhất nghiệp vụ. Worker single writer cho nháp riêng, serial và version khi sửa; không sửa raw. Không gửi dữ liệu ra ngoài. Bản đầu này chưa có danh mục Kho, duyệt nghiệp vụ hay ghi sổ; không tự coi nhãn REVIEWED là đã ghi kho.

Lịch quét opt-in ba mốc giờ Việt Nam dùng alarm mỗi phút, độc lập autoScan. Chỉ đánh dấu mốc xong khi content script thực sự quét thành công, lỗi thử lại; một lượt bù nội dung hiện tại có thể đánh dấu nhiều mốc trễ cùng ngày, không phục hồi lịch sử. Không bù ngày trước hoặc mốc trước lúc bật. Dừng tất cả/chọn cấu hình tắt lịch. Không thêm quyền mới. Chưa thử 0.9 native/Zalo thật; chủ đã xác nhận 0.8 quét nền ổn.

50/50 test đạt (36 browser, 6 core, 2 worker, 6 draft/lịch). Browser 390px kiểm tra không tràn ngang, nhập sửa/đối chiếu và raw không thực thi HTML. Ảnh dữ liệu giả lưu artifact Zalo-phieu-nhap-390.png. Syntax/diff và ZIP integrity đạt; chưa chứng nhận lịch đúng giờ trên Windows/Zalo thật.
