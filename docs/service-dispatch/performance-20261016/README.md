# Đo và sửa độ trễ Điều phối — 16/10/2026

## Phân biệt số đo

**Staging trước sửa:** chủ cung cấp các execution `dispatchApi` 41,0 / 37,2 / 19,3 / 13,0 / 14,0 giây. Không có phân rã giai đoạn, action cụ thể hoặc kích thước workbook trong các số này; không suy ra thời gian nhận đơn/tạo đơn từ chúng.

**Local, dữ liệu giả:** đo cùng domain, cùng 36 đơn và payload, bản cũ ở commit `55ced52` so với repository mới. Driver giả lập Sheets trong bộ nhớ, không có độ trễ Google. Retention mới chủ ý giữ tới 30 bản trước khi giảm về 20, nên số dòng hoạt động có thể lớn hơn nhưng IO nhỏ hơn.

| Chỉ số của lệnh ghi | Trước | Sau |
|---|---:|---:|
| Đọc Sheets (`getValues`/`getDisplayValues`) | 21 | 11 |
| Ký tự JSON trả từ các lần đọc | 30.922.296 | 772.558 |
| Snapshot decode | 125 | 4 |
| Lần gọi compact | 3 | 0 |
| Đọc archive | 3 | 0 |
| Snapshot hiện tại, ký tự | 164.526 | 164.526 |
| Dòng STATE/JOURNAL/ARCHIVE của fixture | 182 / 182 / 65 | 210 / 210 / 37 |

Dữ liệu thô: [lần đầu](local-before-after.json), [chạy lại](local-repeat.json). CPU local lần đầu 48,14 → 4,61ms; lần sau 121,71 → 4,99ms. Các số CPU biến động theo tải máy; **không phải thời gian lệnh GAS**, không dùng để tuyên bố đạt mục tiêu <5s/<3s.

Chạy lại: `node erp-prototype/test/benchmark-persistence.cjs`. Cần commit `55ced52` có trong lịch sử Git (checkout shallow cần fetch lịch sử trước). Không dùng khách thật và không kết nối Google.

## Thay đổi

- Dưới hoặc bằng 30 snapshot: không gọi compact. Bản thứ 31 compact một lần còn 20; đọc/recover/replay không dọn. Không scan archive lớn, chỉ kiểm tra đuôi tương ứng một attempt; retry partial archive vẫn copy/verify trước delete. Giữ mọi test fault injection cũ.
- Revision mới nằm trong manifest. Với manifest cũ, fallback decode chỉ diễn ra khi maintenance thật sự cần chạy. `latest` dùng block có manifest cuối cùng; append chỉ đọc lại block vừa ghi để verify checksum. Không decode 20 snapshot trên đường ghi thường.
- Chọn KTD là get qua HMAC, không mở workbook Điều phối. Preview chỉ nằm trong form. Tạo đơn xác minh lại KTD ngoài lock rồi upsert snapshot khách + đơn trong cùng một command. Không tin snapshot browser gửi. Gán khách cũ vẫn ghi riêng và giữ local ID/hồ sơ máy.
- Sau 8 giây có thông báo chờ cố định, không hủy request. Sau 60 giây có retry với khóa cũ. Kết quả server đến sau khi UI đã hết hạn không tự tạo thêm thao tác. Nếu request đầu đã commit, lần retry lấy đúng receipt cũ, kể cả Danh bạ đang lỗi.

## Đo native trên staging

Trong execution console, lọc `dispatch-command-timing`. Log chỉ chứa tên phase và số ms:

- `request`: toàn bộ dispatchApi, gồm xác thực/khởi tạo;
- `directory_fetch`: UrlFetchApp tới Danh bạ, kể cả redirect;
- `command`: lock_wait, recover, compact, domain, journal, state, commit và total;
- `snapshot_read`: đọc state/journal phục vụ recover;
- `export_outbox`: xuất hàng chờ, riêng với ghi dữ liệu.

`recover` bao gồm `snapshot_read`; các chỉ số lồng nhau, không cộng tất cả log để suy ra tổng. `command.total` còn bao gồm callback outbox và publish thay đổi. `compact=0` là đường thường.

Sau khi deploy đúng staging hiện có, chủ chạy **`profileDispatchStorage`** trong Apps Script editor. Hàm kiểm tra quyền chủ, lấy snapshot dưới lock/recovery, in `snapshot_chars`, `max_chars`, `revision`, `tabs[].rows`, `elapsed_ms`, không in khách/secret. Hàm không tạo đơn hay thu tiền; nếu có journal PREPARED thì recovery vẫn làm đúng nhiệm vụ hoàn tất giao dịch đó.

Tiếp đó thực hiện một lệnh Nhận đơn, một lệnh Tạo đơn thử và một lần chọn KTD, lấy log execution tương ứng. Chọn KTD không được có log `command`/compact. Chỉ khi có các log này mới xác nhận mục tiêu <5s cho lệnh ghi và <3s cho chọn khách.

Tùy chọn, chủ chạy `installDispatchSnapshotMaintenance` để cài maintenance 10 phút một lần. Trigger dùng cùng ScriptLock và chỉ dọn khi vượt ngưỡng. Không cần chạy setup/reset hay tạo lại file.

Workflow staging thử gọi `profileDispatchStorage` qua Execution API và lưu `storage-profile-status.json`. Không mở rộng scope/quyền/API access để lấy số đo. Nếu API không cho chạy, cần chủ chạy hàm trong editor; không thay bằng số local hoặc bịa kích thước workbook.

## Kiểm thử

- 337 Node: fault injection cũ, 31→20, không compact dưới ngưỡng, archive chỉ đọc đuôi, select không mở Sheets, create_order chỉ một command, native GAS không dựng repository khi preview, replay khi Danh bạ offline.
- 26 bộ browser Điều phối gồm UAT cũ và `slow-request-browser.cjs`: giữ kết quả sau 8s/12s, timeout 60s mở lại form, retry khóa cũ sau server commit chỉ một đơn.
- Chạy lại browser Danh bạ và ERP UI. Số đo native/deployment sẽ được ghi riêng sau khi workflow hoàn tất.
