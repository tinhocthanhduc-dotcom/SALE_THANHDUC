# Chuyển Điều phối sang bảng — chỉ bản sao và staging

## Phạm vi và điều kiện

Code mặc định vẫn LEGACY, không tự migrate khi deploy. Không sửa Kho, Finance hay Danh bạ. Giữ nguyên action/command; query thêm bộ lọc tùy chọn `view`, `date`. Giao diện giữ bố cục, tab Đã đóng tải riêng theo lựa chọn của chủ.

Bản này chưa được nghiệm thu tốc độ Google. Không dùng cho app thật trước khi hoàn thành phép đo và UAT trên bản sao.

## Thao tác trong Apps Script staging

1. Lưu phiên bản deployment đang dùng. Tạm ngừng người dùng staging trong lúc chuyển. Triển khai gói Code.gs/Index.html được build từ commit này vào **project Điều phối staging**, không phải app thật. Không đổi các secret hay ID app bên ngoài.
2. Đăng nhập Google bằng tài khoản chủ project. Chọn hàm `createDispatchTablesCopy`, bấm Chạy và cấp quyền nếu Google yêu cầu. Hàm tạo tệp Drive riêng tư, lưu ID ở `DISPATCH_TABLES_COPY_ID`; không đổi tệp nguồn và chưa bật bảng mới. Không tự sửa ID này sang tệp thật.
3. Chạy `migrateDispatchToTables`. Hàm khóa, đọc legacy, sao lưu JSON vào `BACKUP_<ngày giờ>`, kiểm checksum, ghi từng bảng, đối chiếu đầy đủ dữ liệu, số bản ghi và tổng tiền. Chỉ khi khớp mới đặt `DISPATCH_STORAGE_MODE=TABLES`. Cờ này hướng staging sang tệp COPY vừa tạo; nguồn cũ vẫn nguyên vẹn.
4. Chạy lại `migrateDispatchToTables` lần hai **trước khi có giao dịch mới**. Phải trả `already_migrated:true`, không nhân đôi. Nếu nguồn cũ đã thay đổi sẽ dừng `MIGRATION_SOURCE_CHANGED`; không ép bỏ kiểm tra.
5. F5 staging. Kiểm tra đơn mở, tab Đã đóng, chi tiết, ảnh, tiền và đồng bộ. Không bật gửi sang ứng dụng thật; giữ cấu hình bộ nối bản sao hiện có.
6. Chạy `profileDispatchTables`. Lưu JSON kết quả: thời gian nạp danh sách, revision, dòng mỗi bảng và số ô toàn tệp. Không gửi token, nội dung khách hay payload ra log công khai.
7. Sau khi UAT được chấp nhận, chạy `installDispatchTablesArchive`. Trigger hàng ngày lúc 02h giờ Việt Nam chuyển đơn đóng quá 30 ngày vào DP_ARCHIVE_ORDERS. Có thể chạy `archiveDispatchClosedOrders` thủ công trước đó. Tra cứu đơn cũ bằng mã TD đầy đủ trên ô tìm desktop hoặc link đơn đã có; quyền truy cập vẫn kiểm tại server.

## Đo Google cần hoàn thành

Dùng bản sao có ít nhất 1.000 đơn giả. Ghi lại số đơn mở/đóng và số dòng, không chỉ tổng 1.000. Chạy `profileDispatchTables`, sau đó thử Tạo đơn, Nhận đơn và Hoàn tất trên staging. Lấy thời gian Executions và console `dispatch-command-timing`, thêm thời gian chờ trên trình duyệt. Lặp mỗi thao tác 5 lần, ghi cả lượt đầu, trung vị và lớn nhất. Mục tiêu: từng thao tác <5s, danh sách <3s. Nếu không đạt, chưa bật cho pilot; tiếp tục tối ưu batch IO. Thời gian MemoryTableDriver không thay cho phép đo này.

Execution API của project hiện trả NOT_FOUND khi thử đo bản trước; chưa có kết quả native cho bản bảng. Không có cơ chế bỏ kiểm tra chủ/quyền để đo.

## Khôi phục

- Nếu migration lỗi trước khi bật: vẫn LEGACY. Sửa lỗi rồi chạy lại; các dòng đã ghi được kiểm tra cùng nội dung trước khi ghi tiếp. Không xóa bảng giữa chừng.
- `rollbackDispatchToSnapshot` chỉ cho quay LEGACY khi **chưa có ghi mới hoặc archive kể từ migration** và không có journal dở dang. Nguồn legacy giữ nguyên nên không mất dữ liệu trong trường hợp này.
- Sau khi COPY có giao dịch mới, hàm dừng `ROLLBACK_HAS_NEW_WRITES`. Không đổi cờ bằng tay: việc đó sẽ bỏ các giao dịch mới. Giữ TABLES, sao lưu COPY và sửa tiến; xuất ngược sang snapshot cần đối chiếu riêng và vẫn chịu trần 1MB của chế độ cũ. Bản đầu chưa hỗ trợ rollback dữ liệu mới tự động.
- Muốn bỏ trigger: Apps Script → Trình kích hoạt → xóa `dispatchTablesArchiveTick`. Không xóa tệp COPY, BACKUP hoặc journal khi đang điều tra.
