# Đo đường tải ảnh – 14/10/2026

Số dưới đây là Chromium + Node/ổ đĩa local trên cloud workspace, **không phải độ trễ Google Apps Script/Drive/Sheets hoặc điện thoại thật**. Cùng fixture 200 đơn giả, ảnh nhiễu tổng hợp 4000×3000; đo một ảnh mỗi bản, không có độ trễ mạng giả. Bản trước lấy ui.js/service.cjs từ commit 9ccd8da; repository/auth dùng harness hiện tại. Kết quả một lần chạy, không phải benchmark thống kê hay cam kết tăng tốc. Các log chỉ có thời gian, số lượng và kích thước.

| Chỉ số local | Trước | Sau |
|---|---:|---:|
| JPEG chính | 367449 B | 132820 B |
| Thumbnail thêm | Không | 27244 B |
| Nén | 269.8 ms | 302.1 ms |
| Gửi + máy chủ trả kết quả | 80.4 ms | 37.4 ms |
| Xử lý upload máy chủ local | 21.2 ms | 14.5 ms |
| Refresh toàn bộ sau ảnh | 44.9 ms | 0 ms |
| Đọc snapshot trong upload | 3 | 2: 1 preflight + 1 dưới khóa |
| Đọc auth store trong upload | 2 | 1 |
| Query toàn bộ sau ảnh | 1 | 0 |

Trước: đọc snapshot tổng 2.58 ms, ghi file local 0.12 ms, transaction local gồm kiểm tra lại + journal/state 7.09 ms. Sau: snapshot preflight 0.92 ms, đọc lại dưới khóa 1 ms (Date.now làm tròn), ghi hai file local 0.45 ms, ghi journal/state không gồm đọc lại/projection 6.45 ms, projection riêng đơn 0.14 ms. Số ghi file local này không đại diện cho Drive; transaction local trước/sau có cách tách thời gian khác nhau, không so sánh trực tiếp hai cột transaction.

Ảnh nhiễu phải giảm chất lượng từ 0.7 xuống 0.2 để đạt giới hạn; ảnh này kiểm giới hạn dung lượng, không chứng minh độ rõ của biên bản thật. Nén chậm hơn trong mẫu này vì thử nhiều mức chất lượng và tạo thumbnail. Cần UAT ảnh chữ/chữ ký thực tế; lợi ích chắc chắn đã kiểm là giảm payload, lượt đọc và bỏ query sau ảnh.

GAS bridge VM kiểm upload mới có 2 recoveries và 1 getProperties, không có lần recoverLocked bổ sung để công bố counter. Bản GAS cũ có thêm lần recoverLocked đó (4 lần đọc cho upload), bên cạnh query sau ảnh. Vẫn cần đọc lại dưới ScriptLock để kiểm expected_version/thu hồi quyền/idempotency; không tái sử dụng snapshot cũ để ghi. SheetsRepository tiếp tục đọc/kiểm các chunks/journal trong transaction: 2 recoveries không có nghĩa chỉ 2 RPC Sheets.

## Tái chạy local

```
ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/photo-browser.cjs --before
ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/photo-browser.cjs --measure-only
ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/photo-browser.cjs
```

Bỏ ERP_TEST_CHROMIUM nếu đã cài Chromium của Playwright. --before cần lịch sử git chứa 9ccd8da. PHOTO_REPORT có thể đặt đường dẫn output JSON. Test cuối chọn 3 ảnh, mất phản hồi sau khi ảnh thứ 2 đã commit, thử lại cùng payload/key, xác nhận 3 evidence và 6 file private, không query toàn bộ; draft và input ảnh còn dùng được. Sau tải lại trang, chỉ 3 thumbnail được tải; bấm mới tải đầy đủ. Kiểm thử Node thêm race hai upload cùng key, stale version, cleanup và phục hồi journal giữ cả ảnh chính/thumbnail, thu hồi quyền ảnh.

## Đo trên Google còn cần thực hiện

Console trình duyệt có dispatch-photo-timing (compression_ms, bytes, thumbnail_bytes, quality, send_ms, auth_ms, snapshot_ms, locked_snapshot_ms, drive_ms, sheets_ms, projection_ms, total_ms, refresh_ms=0). dispatch-refresh-timing ghi thời gian query/refresh khi được yêu cầu riêng hoặc polling. Nhật ký Apps Script ghi dispatch-upload-timing với các trường số của máy chủ; không log tên khách/đơn, địa chỉ, base64, mật khẩu hay token. send_ms gồm network, khởi tạo service/GAS và máy chủ, không trừ từ timings để suy ra network chính xác.

Chưa có số đo Google trước/sau. Execution API hiện trả USER_ERROR / NOT_FOUND ở cả dev và deployed context, và môi trường không có phiên nhân viên Google để upload ảnh thật; không thay đổi quyền hay lấy mật khẩu. Khi UAT staging, lấy các dòng timing trong Console và nhật ký thực thi trên cùng mạng/ảnh/số đơn. Thời gian phía máy chủ có độ phân giải ms, 0 ms không có nghĩa bước đó không chạy. Lần lỗi/recovery có thể đọc thêm để xác định file đã được journal sở hữu; không xóa file nếu chưa chắc chắn.
