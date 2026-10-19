# Khung nghiệp vụ Thành Đức ERP — bản demo tiếp nối

Cập nhật 12/10/2026. Đây là contract và mô phỏng dữ liệu mẫu; không phải chính sách vận hành đã được duyệt hoặc hệ thống kế toán.

## Các luồng liên kết

| Luồng | Hồ sơ liên kết | Đã thử được trong demo | Còn cần triển khai |
|---|---|---|---|
| Dịch vụ tại khách | khách → đơn → kỹ thuật → vật tư → kiểm tra → bàn giao | giao việc, dùng vật tư, bằng chứng kiểm tra/bàn giao, thu khách | địa chỉ, lịch hẹn, nhiều lần thực hiện, ảnh/chữ ký, bảng giá công |
| Bán hàng/lắp đặt | đơn → dòng hàng → phiếu cấp → bàn giao → đề nghị doanh thu | xác nhận đơn, cấp hàng theo dòng, đề nghị và Finance duyệt | giao trực tiếp khách, nhiều kho, serial, giao từng phần, VAT |
| Mực định kỳ | hợp đồng → lịch → lần thực hiện/đơn | có dòng dịch vụ trong đơn | hợp đồng cha, lịch định kỳ, chỉ số máy; doanh thu không cộng trùng hợp đồng và đơn |
| Care/bảo hành | máy → phiếu yêu cầu → việc → bàn giao | dùng luồng công việc chung | điều kiện bảo hành, liên kết máy, SLA, chi phí bảo hành |
| Kho/kho thợ | kho trung tâm → thợ → dùng/trả dư | cấp, kỹ thuật kiểm đếm/nhận, sử dụng, đề nghị trả, kho xác nhận nhận lại | số dư thật, nhiều kho, serial, mua hàng/phải trả, normalized tables |
| Thanh toán/nộp quỹ | khoản thu → Finance xác nhận → đề nghị nộp → quỹ xác nhận | thu từng phần, tiền mặt/chuyển khoản/POS, đối soát tiền giữ | từ chối/sửa khoản khai sai, hoàn tiền thực tế, POS settlement/phí, hạn giữ tiền được duyệt |
| Công nợ/hóa đơn | đơn → tiền đã xác nhận → còn phải thu | còn phải thu theo đơn, tách doanh thu với thu tiền | điều khoản/hạn thanh toán, tuổi nợ, VAT/hóa đơn, phân bổ nhiều đơn |
| CSKH/khiếu nại | khách → đơn/máy → phản ánh → xử lý | tra đơn và nhật ký hiện có | phiếu khiếu nại, trách nhiệm xử lý, hẹn chăm sóc, khảo sát |

## Luồng kho thợ trong bộ mẫu

1. Kinh doanh xác nhận đơn; quản lý giao kỹ thuật.
2. Vai trò Kho cấp hàng vật lý theo dòng đơn. Tổng số đã cấp không vượt số lượng dòng; số dư kho phải có rõ ràng. Sản phẩm dịch vụ không thể xuất như vật tư.
3. Kỹ thuật được giao đến kho kiểm đếm và xác nhận nhận hàng mang theo, kèm bằng chứng. Kho cấp trừ số khả dụng của kho vào vùng chờ bàn giao; chưa tính vào số kỹ thuật đang giữ. Chỉ người kỹ thuật trên phiếu được nhận, không được tự xác nhận phiếu do chính mình cấp.
4. Sau khi nhận đủ hàng vật lý theo dòng đơn, kỹ thuật bắt đầu tới khách/xử lý và ghi lượng vật tư dùng. Không dùng vượt số đang giữ sau khi trừ lượng đã đề nghị trả.
5. Kỹ thuật đề nghị trả hàng dư. Lượng này được giữ chỗ, vẫn còn trong số đang giữ; kho chưa tăng tồn.
6. Kho xác nhận thực nhận với bằng chứng. Khi đó mới giảm hàng thợ và tăng kho mẫu. Người đề nghị không tự xác nhận.

Số đang giữ = đã nhận − đã dùng − trả đã xác nhận. Cấp hàng làm đơn có dấu vết đã xuất; không thể hủy đơn bằng thao tác trước xuất. Tồn thợ đang tính theo từng đơn/dòng, không cho chuyển vật tư giữa đơn hoặc cấp lại phần đã trả. `record_dispatch` cũ chỉ ghi tham chiếu, không tự sinh chuyển kho; dùng các thao tác kho thợ mới để thử số lượng.

## Luồng thu khách và nộp quỹ

1. Kinh doanh hoặc kỹ thuật được giao báo thu: số tiền VND nguyên dương và phương thức. Biên nhận nội bộ tự cấp số; mã giao dịch ngân hàng/POS nhập riêng nếu có. Khoản báo thu có trạng thái `reported`; không giảm số còn phải thu.
2. Finance xác nhận theo bằng chứng, bằng actor khác người thu. Khoản này chuyển `confirmed`. Còn phải thu = giá trị đơn − các khoản thu đã xác nhận. Tổng các khoản báo và đã xác nhận không vượt đơn.
3. Người đã thu tiền mặt đề nghị nộp một phần hoặc toàn bộ, phân bổ tới khoản thu đã xác nhận của chính mình. Chuyển khoản và POS không thuộc tiền mặt đang giữ. Đề nghị đang chờ giữ chỗ để tránh lập hai đề nghị cùng tiền.
4. Finance/quỹ xác nhận nhận tiền với bằng chứng, bằng actor khác. Khi đó tiền đã nộp mới giảm tiền mặt đang giữ; trạng thái thanh toán khách không đổi lần nữa.

Tiền mặt giữ đã xác nhận = khoản tiền mặt đã xác nhận − nộp quỹ đã xác nhận. Khoản báo thu chưa xác nhận và nộp quỹ chờ nhận được hiển thị riêng. Tiền báo thu chưa xác nhận không được coi là số đã đối soát; vẫn hiện trên màn hình để không mất dấu.

Doanh thu vẫn theo đề nghị từ công việc đã bàn giao và Finance duyệt. Chuyển trạng thái doanh thu không ghi tiền. Duyệt hồ sơ hoàn/đảo không trừ tiền giữ, không hoàn tiền hoặc tự đảo kho; đối soát khoản đã thu/nộp vẫn được phép. Đơn có bất kỳ khoản báo thu phải dùng hồ sơ xử lý hoàn/đảo thay vì hủy đơn làm mất dấu tiền.

## Quyền và độ bền

Chín command mới dùng chung order version, actor + idempotency key, command fingerprint và nhật ký với luồng đơn. `operation_id` liên kết phiếu kho/thu/nộp trong kết quả và event. Biên nhận/phiếu nội bộ được domain cấp số theo loại và ngày Việt Nam: BN (biên nhận), NQ (nộp quỹ), PX (xuất/cấp), SD (sử dụng), HT (đề nghị trả), PN (kho nhận trả). Mẫu PREFIX-YYYYMMDD-0001 tăng độc lập theo ngày/loại. Cấp số trong cùng commit state/journal; replay không cấp lại, lệnh bị từ chối không tiêu số. Giữ số chứng từ cũ; nếu gặp số cũ trùng mẫu thì bỏ qua. Mã giao dịch ngoài được lưu riêng ở external_reference và chống trùng theo phương thức khi có cung cấp; ghi chú không bắt buộc. Các fixture command cũ gửi reference được đọc như mã giao dịch ngoài cho khoản thu, không quyết định số biên nhận nội bộ.

LocalRepository và SheetsRepository sử dụng cùng domain; các phiếu mới nằm trong snapshot/journal hiện có. Kiểm thử local recovery xác nhận retry sau PREPARED không nhân đôi khoản thu. GAS build đóng gói cùng logic nhưng chưa nghiệm thu Google runtime.

UI chọn vai trò chỉ là mô phỏng. Cần auth server, phân quyền truy vấn, xác thực đầu vào, masters bền vững và staging UAT trước khi dùng dữ liệu thật. Không áp dụng tự động 3 ngày/5 triệu, mức giảm giá hoặc vai trò duyệt chưa được chốt. Chưa có từ chối/sửa phiếu, giao dịch hoàn thực tế hay xử lý mất/thừa tiền; không dùng demo quyết toán.

## Dùng thử HTML

Mở tệp HTML mới trên máy tính. Bộ dữ liệu cũ vẫn được giữ; nếu muốn thử lại từ đầu, vào Tiến độ dự án → Khôi phục bộ mẫu (sẽ thay dữ liệu demo của trình duyệt).

Thử đơn mới có 3 hộp mực: xác nhận → quản lý giao Kỹ thuật 1 → Kho cấp 3 → Kỹ thuật 1 kiểm đếm và xác nhận nhận đủ 3 mang theo → Kỹ thuật 1 bắt đầu, dùng 2, đề nghị trả 1 → Kho nhận lại 1. Tiếp theo Kỹ thuật 1 báo thu 150.000 tiền mặt → Finance xác nhận → Kỹ thuật 1 đề nghị nộp 100.000 → Finance xác nhận nhận tiền. Mục Thu tiền & nộp quỹ phải còn 50.000 tiền mặt đã xác nhận đang giữ, doanh thu không tự thay đổi.

### Tương thích bộ mẫu cũ
Phiếu cấp trong bản trước đã được tính ngay vào hàng thợ; giữ nguyên cách diễn giải đó để không thay số dư cũ. Phiếu mới có `awaiting_receipt` và chuyển `received` khi kỹ thuật xác nhận. Dòng đơn mới lưu `kind`; đơn mới có dòng physical phải nhận đủ mới bắt đầu. Đơn cũ thiếu kind không tự bổ sung chặn mới. Đơn dịch vụ thuần không bắt buộc lấy hàng. Chưa hỗ trợ nhận thiếu/hỏng, từ chối phiếu cấp, thay vật tư hoặc điều chỉnh phiếu đã giao; bộ mẫu xác nhận nhận nguyên phiếu.
