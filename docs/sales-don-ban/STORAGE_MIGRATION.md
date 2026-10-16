# Receipt vào sheet và đọc Đơn bán không giữ lock

Bản này chỉ đổi DonBan.js và test; không đổi code.js, Index.html, DonBan.html, nghiệp vụ, API hay 3 schema kinh doanh. Chưa deploy, chưa chạy migration trên Google thật. Sales v63 hiện có vẫn là bản trước sửa này.

## Cơ chế mới

- Sheet ẩn **LENH_DON_BAN**, đúng header: `RequestKey, Fingerprint, Action, ResultJson, TaoLuc`. Tạo tự động, tự thêm dòng khi hết lưới, không xóa receipt. RequestKey vẫn là `DON_BAN_REQ_<hash>` để tương thích receipt cũ.
- Lệnh ghi tra RequestKey bằng TextFinder trên cột khóa dưới ScriptLock; chỉ đọc dòng kết quả, không nạp toàn bộ lịch sử lệnh cho mỗi lần retry. Receipt và fingerprint cũ giữ nguyên; cùng key/nội dung trả lại kết quả cũ, khác nội dung bị chặn.
- Journal vẫn ở Properties tạm. Sau ghi delta, ghi/flush receipt vào sheet rồi mới xóa journal. Nếu dừng sau ghi receipt nhưng chưa xóa journal, lần sau khôi phục mà không thêm receipt/đơn/báo thu trùng. Journal v63 chưa có Action vẫn khôi phục được.
- `DON_BAN_SCHEMA_V1=DONE` chỉ đặt sau setup và chuyển hết receipt cũ thành công. Setup không định dạng cả cột. `@` chỉ đặt trên các ô SĐT/MST/mã giao dịch khi ghi dòng mới, giữ nguyên số 0 đầu.
- Đọc thông thường không gọi LockService và không ghi Sheets. Chỉ setup khi thiếu schema/marker hoặc khôi phục khi có DON_BAN_PENDING mới lấy lock; trả lock trước phần đọc dữ liệu. Header trống được bổ sung đúng vị trí; header đổi sang tên khác bị chặn, không tự đổi tên hay sửa dữ liệu.
- listDonBan đọc DON_BAN và BAO_THU mỗi bảng một lần, không cần tải CHI_TIET_DON_BAN. getDonBan đọc cả ba bảng mỗi bảng một lần. CAU_HINH đọc riêng cho danh sách nhân viên; Finance vẫn chỉ đọc như cũ.

## Cách chuyển receipt trên Google

1. Thử trên bản sao trước. Sao lưu file Sales; tạm dừng người dùng thao tác khi nâng cấp để phiên code cũ không tiếp tục ghi receipt Properties trong lúc chuyển.
2. Thay nội dung file server **DonBanServer.gs** trong Apps Script bằng toàn bộ DonBan.js mới. Repo vẫn giữ tên DonBan.js; bộ deploy hiện tại copy thành DonBanServer.js để không trùng tên với HTML DonBan. Không thay code.js/Index.html/DonBan.html.
3. Cập nhật deployment sang code mới và yêu cầu mọi người tải lại app. Trong editor chọn **migrateDonBanReceipts** → **Chạy**. Không chạy setup/reset app cũ; không xóa Properties bằng tay.
4. Execution log chỉ in số lượng, ví dụ `don-ban-receipts-migration {"success":true,"migrated":120,"alreadyCopied":0}`. Hàm tạo/ẩn LENH_DON_BAN, ghi theo lô 100, flush, đọc kiểm lại rồi mới xóa từng khóa DON_BAN_REQ_* tương ứng. Action của receipt v63 được suy từ dạng kết quả đã lưu; TaoLuc của receipt cũ là thời điểm chuyển vì bản cũ không lưu thời gian này. Không in request key, kết quả hoặc dữ liệu khách vào log.
5. Chạy lại: `migrated:0` nếu đã chuyển hết, số dòng không đổi. Kiểm tra không còn DON_BAN_REQ_* trong Script Properties; giữ nguyên bộ đếm, cấu hình Finance, schema marker và journal tạm nếu có. Nếu Apps Script hết thời gian giữa chừng, chạy lại cùng hàm; các khóa chưa chuyển/xác minh vẫn được giữ. JSON hỏng hoặc fingerprint/result không khớp thì dừng, không xóa khóa đó để quản trị kiểm tra.

Nếu không chạy thủ công, lần dùng Đơn bán đầu tiên sau nâng cấp cũng tự setup và chuyển receipt dưới lock. Chạy thủ công trước giúp tránh người đầu tiên phải đợi. Không xóa sheet LENH_DON_BAN hoặc receipt để “dọn dung lượng”.

Không quay lại code v63 sau khi chuyển bằng cách bỏ sheet receipt: bản cũ chỉ tra Properties nên không nhận ra receipt đã chuyển. Giữ bản mới khi đối soát/khắc phục; nếu cần quay lui phải lập kế hoạch bảo toàn chống replay trước.

## Test và số đo local

```
node --test test/don-ban/domain.test.cjs test/don-ban/regression.test.cjs test/don-ban/storage.test.cjs test/don-ban/browser.cjs
```

**50/50 đạt**: 38 ca trước + 12 ca mới. Một test cũ từng mượn dbRead_ để ghi dữ liệu chuẩn bị; phần chuẩn bị được đổi sang lock tường minh vì dbRead_ nay không giữ lock. Toàn bộ assertion nghiệp vụ cũ được giữ.

- 3.000 lệnh giả qua dbRun_ tạo đúng 3.000 receipt; kích thước Properties sau cùng bằng trước chạy, không có DON_BAN_REQ_*; retry lệnh đầu vẫn trả kết quả cũ.
- listDonBan và getDonBan sau setup: **0 lần ghi Sheets, 0 lần gọi LockService**; mỗi bảng cần dùng đúng 1 lần đọc, không đọc LENH_DON_BAN.
- Đọc vẫn chạy khi có người khác giữ ScriptLock nếu không có journal. Có journal dở thì lấy lock khôi phục; lần đọc sau trở lại 0 lock/0 ghi.
- Migration tự động/thủ công/chạy lại, crash sau copy trước xóa Properties, receipt xung đột/JSON hỏng, crash sau receipt trước xóa journal, journal cũ thiếu Action, thiếu sheet/header, header đổi tên, định dạng @ và 7 ca browser đều đạt.

Số đo trên fixture Sheets trong bộ nhớ; chưa phải số đo hoặc kết quả migration Google thật. Không ghi Finance/Kho.
