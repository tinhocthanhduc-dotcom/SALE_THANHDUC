# Ô tìm và chọn dùng chung — 15/10/2026

Chỉ thay giao diện Điều phối. Không thay API, command, quyền, ID, dữ liệu hay mã máy chủ.

## Cách dùng

- Khách: gõ tên có/không dấu, điện thoại hoặc địa chỉ; chọn kết quả. Tên và số điện thoại hiện cùng dòng, × bỏ chọn. Không tìm thấy có **+ Tạo khách mới**, điền sẵn tên/điện thoại vừa gõ; lưu hoặc hủy vẫn giữ nháp đơn. Đổi khách cập nhật máy theo khách; một máy còn hoạt động tự chọn như cũ.
- Máy: khi nhiều máy, tìm model/serial. Hàng: tìm mã TD/tên, kết quả hiện mã, tên, đơn vị, kho và tồn tham khảo; đổi kho cập nhật danh sách. Hàng ngoài danh mục vẫn là lựa chọn riêng theo luồng cũ; gõ chữ tìm không tự thành tên hàng hoặc ID.
- Finance: tìm tên/mã ở cả nguồn Điều phối, ID Finance và tài khoản ngân hàng. Các select dài khác tự dùng cùng thành phần; danh sách ngắn dưới 5 lựa chọn dùng nút ngang, giữ các nút chọn nhanh đã có.
- Mỗi popup tối đa 20 kết quả, không phân biệt hoa/thường hoặc dấu tiếng Việt (gồm đ); Arrow Up/Down + Enter để chọn, Esc đóng popup, Tab tới × hoặc tạo khách. Combobox/listbox, aria-expanded/activedescendant, thông báo số kết quả và radiogroup cho nút ngắn. Chữ 16px, hàng kết quả tối thiểu 52px, nút ngắn 48px.
- Gõ mà chưa chọn không lưu được. ID vẫn nằm ở select gốc cho FormData và change handlers; kiểm tra server giữ nguyên. Select gốc ẩn về thị giác và khỏi cây truy cập, input tìm không có name nên không đưa chữ tìm vào payload.

## Triển khai

`ChoiceUI` trong ui.js.txt quản lý một adapter dùng chung: dò native select, lọc cục bộ, bàn phím, xác thực và cập nhật options động. MutationObserver chỉ theo dõi thay đổi cấu trúc/select và gom cập nhật; không gọi API khi gõ. Popup đang mở được bảo vệ khỏi polling vẽ lại. Không copy picker riêng theo từng form.

`stockPicker`, `mappingFields`, `select`, `startInline` cung cấp metadata/nháp cho adapter; `submitForm` xác thực trước khi gửi. CSS `.choice-*` ở cuối ui.html.txt. Không thêm thư viện.

## Kiểm chứng

Chạy `ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/choice-browser.cjs`. Có 9 nhóm mới: giới hạn 20; tên có/không dấu/hoa, số điện thoại/địa chỉ; model/serial và đổi khách; bỏ chọn/chặn gõ tự do/Esc; Tab/Enter tạo khách và hủy giữ nháp; tạo khách giữ yêu cầu/địa chỉ; TD/kho/tồn/hàng ngoài; nút ngắn/bàn phím/390px; Finance tên/mã. Không có pageerror. Có thể đặt `DISPATCH_CHOICE_SCREENSHOTS` để lưu ảnh khách/hàng ở 390px, chỉ dùng fixture mẫu.

Đạt local **138/138 Node, 21 bộ trình duyệt**, build GAS và so sánh Code.gs byte-identical v53. [Kết quả chi tiết](LOCAL_VERIFICATION.json). Đây là fixture local, chưa phải UAT Google.

Hồi quy: chạy toàn bộ các file *-browser.cjs và browser.cjs trong CI, gồm bộ mới. Bài test cũ đổi tìm khách sang popup thay vì đếm options đã lọc; kiểm ảnh phân biệt nút loại ảnh và nút upload, vẫn yêu cầu không có nút upload thủ công. Không nới kiểm nghiệp vụ, quyền, retry, version hay chống trùng.

## Khôi phục

Chỉ UI, không migration/reset. Có thể triển khai lại giao diện v53 nếu cần; giữ nguyên Script Properties, dữ liệu, ảnh, người dùng và bảng gán. Không chạy setup lại. Không thay Kho/Finance/AI thật hoặc consumer COPY trong thay đổi này.
