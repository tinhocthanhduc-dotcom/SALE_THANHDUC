# Lưu trữ Sheets staging — hợp đồng thử nghiệm
Mã đã viết và kiểm thử bằng workbook giả lập. Chưa tạo file/project staging hoặc ghi Google Sheets thực tế.

## Cấu trúc yêu cầu (không tự tạo hay nâng cấp)
- ERP_META A1:B2: hàng 1 `environment`, `token`; hàng 2 `STAGING`, token của project staging.
- ERP_STATE và ERP_JOURNAL hàng 1: `attempt_id`, `kind`, `chunk_index`, `chunk_count`, `checksum`, `payload`.
- Preallocate rows phù hợp; adapter không thêm tab, thêm cột, đổi format, quyền hoặc xoá dữ liệu.
- Payload chia nhỏ tối đa 16.000 đơn vị UTF-16/cell và không cắt đôi surrogate pair. Prototype giới hạn 1.000.000 đơn vị UTF-16/snapshot, 10.000 hàng/tab. Đụng giới hạn báo STAGING_CAPACITY_EXCEEDED, không tự mở rộng.

## Trình tự lưu và phục hồi
Dưới một project lock: đọc phiên bản hiện tại → kiểm tra lệnh/quyền/version/idempotency → ghi toàn bộ after-image vào ERP_JOURNAL, flush → ghi manifest PREPARED và kiểm checksum → ghi snapshot ERP_STATE, manifest SNAPSHOT và kiểm checksum → đánh dấu COMMITTED → trả receipt.
DATA không có manifest hoàn chỉnh bị bỏ qua và giữ lại để kiểm tra; không xoá orphan tự động. PREPARED có dữ liệu đầy đủ là ý định bền vững: recovery roll-forward rồi retry command key trả receipt đã lưu. State khớp after-image thì không tạo lại đơn/cấp số. Sai hash, thiếu chunk hoặc thiếu state đã COMMITTED báo RECOVERY_CONFLICT; không fallback thành sổ trống.
Không hứa transaction xuyên workbook. Prototype ghi snapshot tổng state append-only cho kiểm chứng, không phải bảng quan hệ vận hành cuối cùng. Scanning lịch sử và lưu cả after-image tăng theo số đơn; cần benchmark, normalized tables và retention/compaction có kế hoạch trước pilot. Không dùng mẫu này cho lưu tài chính production.

## Các guard trong output GAS
- ERP_ENV=STAGING và ERP_ENABLE_STAGING_WRITES=true phải được cấu hình rõ ràng; mặc định tắt.
- ERP_STAGING_SCRIPT_ID phải trùng ScriptApp.getScriptId().
- ERP_STAGING_SPREADSHEET_ID phải trùng workbook và khác 5 ID legacy đã biết; ERP_STAGING_MARKER_TOKEN phải khớp marker trong file.
- Dùng LockService.getScriptLock, flush trước release. Chỉ bảo vệ writer cùng project; cấm hai GAS project cùng ghi staging workbook.
- Không có doGet/doPost hoặc trigger. Hàm ghi fixture/recovery có hậu tố `_`, dùng từ editor của project staging đã xác minh; không có API nhận actor client.
- Ba hàm `erpStagingRepository_`, `erpRunPersistentFixtureDemo_`, `erpRecoverStaging_` nằm trong output build riêng. Không copy vào project legacy.

## Kiểm thử đã chạy
58/58 test local PASS (toàn bộ suite). Ca mới gồm reopen/replay không ghi thêm, lỗi tại các checkpoint và sau chunks, partial setValues, checksum lỗi, mất committed state, schema/marker/legacy ID guard, capacity, lock, stale version, Unicode; GAS default write disable và wrong project guard chạy trong Node VM.
Không gọi Google API trong các test. Chưa xác minh timeout/quota/flush/visibility trên Apps Script thực tế. Chưa có auth/session/UI, bảng masters bền vững hoặc chuyển đổi VAT/ngày theo nguồn.

## Khi có staging thật
Xác minh project và file mới độc lập, cấu hình marker và properties, chạy fixture trước; fault injection và recovery kiểm trên staging. Chỉ đọc shadow nguồn legacy sau khi xác nhận deployment binding. Không cho production commands tới khi nghiệm thu auth, durability, concurrency, capacity và audit. Merge PR không phải phép deploy hoặc ghi production.
