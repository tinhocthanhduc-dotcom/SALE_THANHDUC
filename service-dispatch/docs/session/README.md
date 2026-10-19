# Giữ phiên sau F5 — staging

## Cách hoạt động

GAS client lưu `dispatch-session-v1` trong localStorage: token, expires_at do server cấp, actor ID và màn đang xem (tab/đơn/khách, vị trí cuộn). Tất cả truy cập localStorage/sessionStorage đều try/catch. Token được giữ trong bộ nhớ để thao tác khi storage bị chặn. Khi mở lại, client kiểm hạn rồi query; server kiểm quyền thật. AUTH_REQUIRED xóa phiên trên máy và hiện đăng nhập. Phản hồi đến muộn của phiên đã đăng xuất không được xóa hay khôi phục phiên mới.

Chuẩn bị sẵn mã dự phòng ngắn hạn trong fragment ngay khi đăng nhập và sau mỗi lần khôi phục, vì localStorage có thể dùng được lúc đăng nhập nhưng bị chặn ở lần F5 sau. Ưu tiên localStorage còn hạn; nếu không đọc được thì dùng fragment URL `#dispatch_resume=...&dispatch_view=...` qua google.script.history.replace. Đọc fragment qua google.script.url.getLocation, không đọc URL iframe để tìm phiên. Token thật không được đặt vào URL; link sao chép gửi Zalo bỏ fragment. Trang dùng Referrer-Policy no-referrer.

Login cấp mã nối phiên 64 ký tự hex ngẫu nhiên. Server chỉ lưu hash mã và hạn min(10 phút, hạn phiên), trong đúng bản ghi phiên: user_id/user_version vẫn giữ nguyên. Các thao tác `resume` và `resume_ticket` lấy ScriptLock, không mở Sheets/Drive; Script Properties chỉ ghi những bản ghi thực sự thay đổi. Khi khôi phục từ localStorage, query xác nhận quyền rồi cấp lại mã dự phòng cho lần F5 kế tiếp. Đổi mã xóa phiên/token cũ, cấp token và mã mới trong cùng khóa; phát lại mã cũ bị từ chối. Hạn phiên mới bằng hạn phiên gốc, không phải thêm 8 giờ. Giới hạn 100 phiên không đổi; nối phiên thay một phiên thay vì tạo thêm phiên thứ 101. Renew mã khi app đang hiện, gần hết 5 phút, qua cơ chế poll/focus hiện có. Không có cơ chế gia hạn nền khi điện thoại tắt màn hình.

Khóa mật khẩu sai 5 lần / 15 phút giữ nguyên. Nhân viên bị tắt hoặc tăng user.version sau đổi mật khẩu thì cả token lẫn mã nối phiên đều bị từ chối. Logout hủy bản ghi phiên (bao gồm mã), xóa storage và fragment. Nếu mạng lỗi trong lúc logout, client vẫn xóa dữ liệu trên máy và hiện lỗi; không thể cam kết đã hủy phiên phía server khi server chưa nhận được yêu cầu.

## Giới hạn và bảo mật của phương án URL

Mã nối phiên vẫn là thông tin xác thực ngắn hạn: ai lấy được mã trước khi dùng có thể đổi nó trong 10 phút. Fragment giúp tránh gửi mã trong HTTP URL/Referer; mã một lần, hash trên server, giữ nguyên hạn 8 giờ, bỏ khỏi link chia sẻ và ràng buộc user_version giảm phạm vi rủi ro. Không đưa token 8 giờ vào URL và không log mã/token.

Với storage bị chặn, nếu đóng/ẩn app trên 10 phút thì mã có thể hết hạn và cần đăng nhập lại. Nếu cả localStorage lẫn Google history/url API bị chặn (ví dụ một webview nhúng), hiện cảnh báo không giữ được phiên; không hạ kiểm tra xác thực. Có thể mở URL web app trực tiếp trong trình duyệt thay vì webview và cho phép lưu trữ. Không hứa F5 giữ phiên khi cả hai cơ chế đều không dùng được.

Mã chỉ được đổi một lần. Mất phản hồi sau khi server đã đổi mã có thể buộc đăng nhập lại; không hỗ trợ replay trả lại token đã cấp vì sẽ làm yếu quy tắc một lần. Nối phiên trên tab khác bằng bản sao URL sẽ thu hồi token của tab cũ. localStorage thông thường dùng chung theo origin; người dùng thiết bị chung cần đăng xuất.

## Triển khai / khôi phục

Không chạy setup, không reset tài khoản hoặc dữ liệu. Phiên server cũ vẫn có cấu trúc tương thích; client đang dùng sessionStorage cũ có thể cần đăng nhập một lần để lấy record mới có expires_at. Nâng cấp Code.gs và Index.html đồng thời trên cùng staging. Rollback code cũ vẫn đọc được user_id/user_version/expires_at và bỏ qua hai trường resume_hash/resume_expires_at; mã nối phiên không còn endpoint đổi sau rollback. Không khôi phục workbook cũ.

## Kiểm chứng

- Node auth: đổi một lần, hai yêu cầu cùng mã chỉ một thành công dưới lock, token cũ bị hủy, hết hạn 10 phút/8 giờ, disabled/version/logout, 100 phiên, không lưu mã/token thô.
- Compiled GAS: resume_ticket/resume chạy qua dispatchApi và Script Properties, replay/old token bị chặn, cùng deadline.
- Chromium 390px, built GAS HTML trong iframe sandbox: localStorage + F5 giữ đơn đang mở; storages ném SecurityError vẫn nối qua mock google.script.history/url; giữ tab Tài khoản; mã cũ bị chặn; renew khi focus; hết hạn/disabled/version/logout; AUTH_REQUIRED cũ không xóa login mới. Google callback/history là mock, backend Auth thật.
- Node cookie runner tiếp tục dùng HttpOnly/SameSite cookie, không chuyển sang token trong JSON; đồng hồ nghiệp vụ fixture được tiêm để ca hẹn ngày mai không phụ thuộc ngày chạy.

**Chưa kiểm thử Google thật trên Chrome máy tính, Chrome Android hoặc Safari iPhone.** Kiểm thử Chromium ở trên không thay cho xác nhận thiết bị thật. Sau triển khai cần chủ thử login → mở một đơn → F5 → logout → F5 trên từng thiết bị; thử storage bị chặn và URL fallback thực tế trong Apps Script, không chia sẻ URL có mã nối phiên.
