# Điều phối dịch vụ – mốc 1, ngày 13/10/2026

Đã xây mã chạy local có máy chủ, khác bản ERP HTML offline. Client không tự chọn vai trò, máy chủ xác thực nhân viên và kiểm quyền truy vấn/command/ảnh. Chưa triển khai Apps Script hoặc chạy dữ liệu thật.

| Đã có | Kiểm chứng |
|---|---|
| Mật khẩu PBKDF2 với salt, phiên/khóa/logout/thu hồi | Hash khớp Node crypto; khóa 5 lần, hết phiên và inactive/version bị chặn |
| Khách/máy/đơn có số TD tự cấp | FK, snapshot, version/idempotency và quyền máy chủ |
| Giao, nhận, hẹn, bắt đầu, không làm được, chờ linh kiện | Lưu phân công/lịch/lần đến; không giả xác nhận kho |
| Chuyển thợ | Chờ điều phối duyệt; giữ lịch sử; thợ cũ mất quyền cả replay |
| Ảnh sau và biên bản nghiệm thu | File private, đúng đơn/actor/lần đến; replay/recovery không mất file đã được journal nhận |
| Gói GAS staging | Bundle parse trong Node VM; route default deny và 5 project legacy bị chặn |

16 kiểm thử Node mới đạt local. 12 kịch bản trong một luồng Chromium end-to-end đạt: đăng nhập, tạo hồ sơ, giao/nhận/hẹn/bắt đầu, chuyển thợ, chặn người cũ, ảnh, nghiệm thu, reload và mobile. 71 kiểm thử ERP cũ đạt sau khi repository nhận domain injection; ERP UI không đổi.

## Chưa có

GAS UAT/triển khai, thư mục/project/file staging thực tế, tài khoản thử nghiệm trên Google, benchmark PBKDF2/Sheets/Drive, cấu hình/quản trị tài khoản trên UI, line công/giá/phí, vật tư thực dùng/cấp/nhận/trả, tiếp tục sau chờ linh kiện, thu/nộp quỹ, ký vẽ, backup lịch, nhập dữ liệu nguồn và đóng hồ sơ tài chính. Nghiệm thu mốc này giữ hồ sơ Chờ đối soát, không đồng nghĩa hoàn tất toàn bộ SPEC_V1_1.

## Mốc tiếp theo

1. Giá/phí 0–200k và dòng công theo đặc tả; báo giá khách đồng ý và quyền duyệt được chốt.
2. Quản trị tài khoản/cấu hình, danh mục và định mức, nhận/cấp/trả vật tư.
3. Thu/nộp quỹ, đối soát và điều kiện đóng hồ sơ.
4. Staging Google riêng và UAT: cài gói, cấu hình marker/properties/tài khoản qua editor, chạy fixture/auth/concurrency/recovery/ảnh/quota/backup. Không dùng secret GitHub CLASPRC_JSON làm phiên nhân viên hoặc tự deploy legacy.

README ghi cách tải/chạy local và cấu hình GAS. Tài khoản local là fixture công khai, không đưa lên Google. Tham chiếu docs/service-dispatch/SPEC_V1_1.md; các hạn mức/quyền còn mở không được xem là phê duyệt vận hành.

## Project Google đã tạo – 13/10/2026

Theo yêu cầu tạo Apps Script của người dùng, workflow Create separate service dispatch Apps Script staging (run 38404000213) đã tạo project riêng, push mã và deploy web app thành công. Metadata ID/link không có credential lưu ở ops/service-staging-20261013-01.project.json; registry dùng lại project/deployment khi chạy lại, không đụng 5 app legacy. Workflow kiểm thử cùng commit thành công.

Chưa khởi tạo Sheets/Drive/account trên Google vì mật khẩu admin phải được chủ project chọn trong Script Properties DISPATCH_INITIAL_PASSWORD, rồi chạy setupDispatchStaging từ editor và cấp quyền theo lời nhắc. Chưa nghiệm thu nghiệp vụ Google runtime hoặc dữ liệu thật. Helper chặn legacy/unknown setup workbook, giữ tài nguyên đã được helper tạo, xóa mật khẩu tạm và chỉ lưu hash/salt. Username khởi tạo là admin; không dùng mật khẩu mẫu local.
