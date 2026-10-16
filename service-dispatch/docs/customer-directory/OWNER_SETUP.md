# Nối Điều phối staging → Danh bạ COPY

**Đổi khóa hoặc khôi phục sau lộ khóa:** dùng [hướng dẫn 5 bước mới](../../../docs/customer-directory/OWNER_SETUP.md), qua hộp thoại một lần.

Điều phối staging v68 đã triển khai. Danh bạ COPY: giao diện riêng tư v11; API riêng có HMAC v10. Điều phối dùng API riêng qua server. Chỉ hai project staging/COPY. Không chạy lại setup/reset, không quét/gộp nguồn, không sửa Sales/CARE/Finance/Kho thật. Danh bạ hiện tại đã chứa KTD; không nhập lại khách. Chỉ bật sau khi kiểm tra kết nối đạt. Khi chưa bật, staging giữ luồng cũ để chủ có thời gian cài; sau khi bật không tạo khách tạm hoặc đơn mới với khách thiếu KTD.

## Đã cài xong nhưng gặp DIRECTORY_UNAVAILABLE

Không làm lại bước 1–3. Sau khi bản Điều phối mới triển khai xong, mở project Điều phối → chọn **checkDispatchDirectoryConnection** → **Chạy**. Nếu thành công, chạy **enableDispatchCustomerDirectory**, rồi tải lại app. Kiểm tra `DISPATCH_CD_CHECK` có `ok: true`. API URL hiện tại được lưu trong `customer-directory/api.copy.json`.

## 1. Lấy danh sách người dùng Điều phối

Mở [project Điều phối staging](https://script.google.com/d/1k2pMSKKG1DF_r7p479O_VSZP3hOciVjCluZgoqM1pN7TOU0ArHeEgGZH/edit). Chạy **listDispatchDirectoryUsers** bằng tài khoản chủ. Sau Run, mở Project Settings → Script Properties và sao chép giá trị **DISPATCH_CD_USER_EXPORT**. Nếu chưa thấy thuộc tính mới, tải lại trang Project Settings. Đây là mảng id/name/roles/active của nhân viên, không có mật khẩu. Giữ nguyên ID; Apps Script editor không tự hiển thị giá trị return nên dùng thuộc tính này để copy.

## 2. Tạo actor và client bên Danh bạ

Mở [project Danh bạ COPY](https://script.google.com/d/1L65AaP41TWcRK52PlOjHUdWj82NaEHh5CKgQ9nYyJ998CMjR-rMxkXTW/edit) đang phục vụ [app Danh bạ](https://script.google.com/macros/s/AKfycbw8nUjBrRpt1iae-g272wA6Lg0Gd9JTvpKdcOVIr51xbMvSg8xSgoNbNtYZpspTusV2/exec). Project Settings → Script Properties: thêm **CD_DISPATCH_USERS**, giá trị là mảng ở bước 1. Run **configureDispatchDirectoryClient**.

Hàm tạo actor `dieuphoi:<id>` có tên đúng nhân viên: director → director; người khác → dispatcher. Actor này chỉ dùng qua HMAC, không tạo tài khoản Gmail. Hàm tạo client **DIEUPHOI**, chỉ cho phép các actor vừa cấu hình; không ghi dữ liệu khách. Chạy lại không đổi secret; đổi vai trò đã có bị chặn để chủ kiểm tra riêng. Tài khoản nghỉ việc phải tắt bên Điều phối và chạy lại danh sách/cấu hình để thu hồi actor khỏi client.

Sau Run, mở Script Properties bên Danh bạ, sao chép giá trị **CD_DISPATCH_ACTOR_MAP** để dùng bước 3 (cũng có trong return dispatch_actor_map). `CD_DISPATCH_USERS` tự xóa sau khi chạy. Nếu chưa thấy hàm mới, project chưa có bản cấu hình mới; không dán thay toàn bộ code bằng tay.

## 3. Cài bốn thuộc tính bên Điều phối

| Script Property | Giá trị |
|---|---|
| DISPATCH_CD_URL | URL `web_app_url` trong `customer-directory/api.copy.json` (API v9), không phải URL giao diện |
| DISPATCH_CD_SECRET | Dán khóa một lần qua hộp thoại **setDispatchDirectorySecret**, theo hướng dẫn mới |
| DISPATCH_CD_ACTORS | Giá trị **CD_DISPATCH_ACTOR_MAP** từ bước 2 |
| DISPATCH_CD_COPY_ACK | `CUSTOMER_DIRECTORY_COPY` |

Secret mới chỉ copy trực tiếp giữa hai hộp thoại bảo mật. Không gửi vào chat, không dán vào Sheet, không đưa vào GitHub/log. Không dùng DISPATCH_BRIDGE_HMAC của bộ nối Kho/Finance thay secret Danh bạ.

## 4. Kiểm tra rồi bật

Bên Điều phối Run **checkDispatchDirectoryConnection**, cấp quyền UrlFetch khi Google yêu cầu. Hàm chỉ gọi bootstrap có chữ ký, kiểm actor/role từng người, không tạo khách. Sau Run, xem Script Property **DISPATCH_CD_CHECK**: phải có `ok: true` và thời điểm mới. Nếu hàm lỗi thì Google hiển thị lỗi và thuộc tính giữ ok=false, không dùng kết quả cũ. Sau đó Run **enableDispatchCustomerDirectory** (kiểm lại rồi mới đặt DISPATCH_CD_ENABLED=true). Tải lại app Điều phối.

Lỗi DIRECTORY_ACTOR_UNMAPPED: kiểm ID/mapping và vai trò; không tự gán tất cả người dùng thành director. Sai chữ ký: copy lại đúng secret DIEUPHOI, không tạo secret mới ở một phía. DIRECTORY_UNAVAILABLE hoặc Google trả trang đăng nhập: kiểm URL deployment COPY và quyền chạy của tài khoản chủ. API riêng cho phép HTTP từ server đến doPost, rồi bắt buộc HMAC; không gửi OAuth bearer. Giao diện Danh bạ vẫn yêu cầu đăng nhập Google. Không bỏ HMAC. Trong chế độ COPY, server luôn dùng API riêng đã duyệt trong api.copy.json, kể cả thuộc tính URL còn giữ đường dẫn giao diện cũ; không cần sửa secret hoặc ánh xạ. Chưa kiểm thành công trên Google thì chưa bật. Hàm check cố ý không in response/secret.

**Giới hạn GAS:** UrlFetchApp không có tham số timeout 8 giây. Giao diện dừng chờ sau 8 giây và hiện Thử lại; request server có thể hoàn tất muộn. Bấm Thử lại trong cùng form giữ nguyên idempotency_key. Nếu cần ngắt HTTP thực sự sau 8 giây thì cần một proxy/backend khác; chưa thêm trong bản này.

## 5. Thử trên Google

- Tìm khách TEST hoặc một mã KTD đã có (gõ tối thiểu 2 ký tự). Dữ liệu TEST KTD-000201 là fixture test, không tự tạo/ghi đè mã này trên Google.
- Chọn khách, tạo đơn thử: kiểm customer_id và ma_khach_chung trong snapshot/order.
- Tạo khách thử qua + Tạo khách mới; bấm hai lần không tạo hai mã. Trùng SĐT/MST hiện khách có sẵn để chọn; chuyển loại/thêm liên hệ hoặc tạo riêng có lý do vẫn xử lý tại app Danh bạ theo quyền, không bỏ qua cảnh báo.
- Khách cũ: Khách / máy → mở khách → Gán mã KTD → tìm/chọn đúng hồ sơ. Không tự ghép theo tên; mã cũ/local ID và hồ sơ máy giữ nguyên.
- Sửa trong Danh bạ: dispatcher sửa SĐT/địa chỉ, director sửa tên/loại/MST. Quyền cột còn được Danh bạ kiểm lại. Địa chỉ làm của đơn không thay đổi.
- Sửa SĐT bên Danh bạ, sau 10 phút mở đơn/khách để thấy bản chụp mới; khi gộp A→B có sự kiện liên kết/gộp trên đơn.
- Tạm cấu hình URL COPY sai ở bản thử, kiểm lỗi/Thử lại; đơn đã có bản chụp vẫn nhận/bắt đầu/nghiệm thu được. Khôi phục URL đúng trước khi tiếp tục tạo khách.

Finance outbox mới kèm ma_khach_chung và ánh xạ mã theo order cho NQ nhiều đơn; giữ nguyên bảng gán ID_KH hiện tại. Chưa thay consumer/app Finance thật để ghép khách theo KTD.

## Khôi phục

Giữ bản sao workbook và Script Properties trước thử nghiệm. Muốn dừng kết nối: chủ đặt DISPATCH_CD_ENABLED=false, không xóa secret/mapping/bản chụp. Rollback code về bản staging trước không xóa trường KTD; không reset dữ liệu. Tắt kết nối là chế độ luồng cũ (có thể tạo khách local trở lại), chỉ dùng để khôi phục staging, không dùng để bỏ quy tắc mã chung khi chạy thật. Không tự khôi phục một workbook cũ làm mất đơn/thu tiền mới.

## Lưu ý khi thử lại thao tác ghi

Giữ nguyên form và nút Thử lại để tái sử dụng khóa cũ. Đóng form rồi tạo lại là một ý định mới; nếu lần trước đã tạo bên Danh bạ thì kiểm tra/chọn khách có sẵn trước. Nếu sửa form sau một lần chờ quá hạn mà giữ khóa cũ, server trả lỗi idempotency thay vì âm thầm tạo/sửa lần hai. Gán KTD được ghi ngay khi chọn kết quả; đóng form không đảo liên kết vừa ghi, lịch sử vẫn giữ.

## Chẩn đoán kết nối COPY (16/10/2026)

`DISPATCH_CD_TRANSPORT_CHECK` chỉ lưu đích API công khai, mã HTTP, loại phản hồi, mã lỗi và thời gian; không chứa secret, chữ ký, nội dung phản hồi hay dữ liệu khách. `DIRECTORY_HTTP_401/403` là lỗi quyền HTTP, `DIRECTORY_GOOGLE_LOGIN` là trang đăng nhập, `DIRECTORY_NON_JSON` là phản hồi không phải JSON, `DIRECTORY_NETWORK_ERROR` là lỗi UrlFetch. Google ContentService redirect chỉ được theo tới script.googleusercontent.com/macros/echo bằng GET và không mang theo envelope HMAC. Không chạy lại setup hoặc tạo lại actor/secret khi gặp lỗi đường truyền.

### DIRECTORY_NETWORK_ERROR ngay sau vài mili giây

Tải lại editor, chạy **checkDispatchDirectoryTransport**. Đây là GET không gửi secret hoặc dữ liệu khách. Chấp nhận quyền kết nối bên ngoài nếu Google hỏi. Nếu lỗi, gửi nguyên thông báo lỗi của lần chạy này: lỗi Google không bị đổi thành DIRECTORY_NETWORK_ERROR nữa. Khi probe thành công, chạy checkDispatchDirectoryConnection rồi enableDispatchCustomerDirectory. Không chạy lại setup hoặc tạo lại secret. Probe chưa chứng minh chữ ký/mapping đúng; bước check tiếp theo vẫn bắt buộc.

### HTTP404 trên probe

Sau bản sửa chặng chuyển hướng, `DISPATCH_CD_TRANSPORT_PROBE` ghi `initial_http_status` và `phase`; nếu đã chuyển đến ContentService thì có `redirect_http_status`. Khi probe lỗi, chỉ gửi thuộc tính chẩn đoán này để biết 404 ở API hay ở chặng lấy JSON. Không gửi URL redirect (có token đáp ứng), secret hoặc cấu hình client.
