# Thanh toán và ghi nợ theo từng khoản — 15/10/2026

## Quyết định nghiệp vụ

- Hồ sơ khách: `allow_credit` có/không, chỉ dispatcher/director tạo/sửa. Đây là quyền, không chọn sẵn Ghi công nợ. Form tiếp nhận không hỏi thanh toán; đơn mới không có `terms` cố định.
- Khách cũ thiếu `allow_credit`: đọc `terms=credit` thành có quyền; giá trị boolean đã lưu có ưu tiên. Projection trả cờ rõ ràng; khi sửa khách lưu cờ mới. Không chạy migration/backfill đơn, không đổi snapshot hay số tiền cũ.
- Sau nghiệm thu/phí Không làm được: thợ được giao chọn mỗi lần Tiền mặt/ACB/TCB/Ghi công nợ. POS/Khác đã cấu hình vẫn giữ. Màn mobile Thu tiền giữ bố cục/CTA 62px, số tiền ban đầu trống, nút Thu đủ/Ghi nợ phần còn lại phải bấm.
- `record_credit`: khách có quyền thì approved ngay, ghi actor/at và chế độ customer_permission. Chưa có quyền thì pending và bắt buộc lý do; dispatcher/director khác người lập approve/reject. Một đề nghị chờ/đơn; không tự cấp quyền vĩnh viễn khi duyệt ngoại lệ. Thợ có thêm vai trò vẫn không tự duyệt đề nghị của mình.
- Cần gán ID_KH Finance còn hoạt động trước khi thành approved. Chọn từ danh mục qua màn Gán Finance hiện có, không gõ/đoán tên. Chụp snapshot ID_KH lúc approved; đổi mapping sau đó không đổi CN đã lập.
- Nợ không vượt phần chưa được thu/ghi nợ. Đề nghị chờ không giữ chỗ tiền và không tính là nợ: khách có thể thanh toán trong lúc chờ; khi duyệt kiểm lại số còn lại. Ghi nợ đã approved không phải tiền đã thu, không vào tiền thợ giữ.

## Tách các số và trả bù

Ví dụ đơn 300k, báo thu tiền mặt 200k, ghi nợ 100k: held 200k, CN 100k, chờ kế toán nhận tiền mặt; chưa đóng. Kế toán nhận đủ 200k và đồng bộ xong: đóng, ghi còn nợ 100k. Không gọi tổng 300k là tiền đã thu/quỹ đã nhận.

- `remaining`: tổng đơn trừ đã xác nhận thu, gồm cả công nợ chưa thu.
- `collectable`: phần khách còn có thể trả, trừ cả khoản đã báo thu chờ xác nhận để không thu vượt. Vẫn gồm công nợ vì cho khách trả bù.
- `outstanding`: nợ được duyệt trừ phần trả bù đã đối soát; `reserved`: trả bù đã báo nhưng đang chờ xác nhận.
- `credit_limit`: phần chưa được thu, chưa có khoản báo thu giữ chỗ và chưa được ghi nợ. Không dùng collectable làm giới hạn ghi nợ, vì sẽ ghi nợ hai lần.
- Mỗi PT lưu `debt_allocations[]`. Phân bổ phần chưa ghi nợ trước, sau đó trả các CN theo thứ tự, chỉ lấy số còn chưa có PT giữ chỗ. CK/POS bị từ chối giải phóng giữ chỗ; tiền mặt chỉ giảm nợ đã đối soát khi kế toán nhận NQ.
- PT trả bù cho hồ sơ đã đóng: mở lại **đối soát tiền**, giữ closure_history và công việc đã kết thúc; sau thu/NQ/sync thì đóng lại. Không tự khởi động lại việc kỹ thuật.
- ĐC tiền mặt áp dụng cho cả PT trả bù: tính lại phân bổ thay thế, Finance hủy THU cũ/đảo phân bổ native trước khi THU mới. NQ đã nhận vẫn chặn như bản trước.

## Finance bản sao

- Approved CN tạo outbox `DIEUPHOI:CN:<CN-no>` trong cùng transaction, số tiền đúng khoản nợ, không tổng đơn. CONG_NO_KH dùng CN-no làm số hóa đơn độc lập, **MA_DOI_CHIEU = mã TD**. Một đơn có thể có nhiều CN, mỗi CN chỉ một lần.
- THU tiền hàng/công giữ tài khoản/danh mục theo bảng gán. Dòng trả bù tham chiếu `debt_key`; consumer tìm đúng ID_CONG_NO bằng marker external key, không tìm theo tên. Chưa có CN native thì THU bị giữ để retry; không ghi THU không liên kết.
- Nếu một PT gồm phần thu thường và trả bù, hoặc trả nhiều CN, chia thành các dòng native THU riêng, external suffix ổn định theo danh mục/CN. Tổng vẫn bằng PT, không tạo thêm doanh thu đơn.
- Adapter COPY cho phép KH allocations cùng danh mục hàng/công đã gán qua cờ **nội bộ consumer**. Vẫn chạy validate danh mục/tài khoản và native prepare/apply/appendPaymentAllocations, lock/chốt ngày/audit. Public caller không dùng được cờ này. Luôn lưu sổ phân bổ kể cả một CN để native deleteTransaction đảo đúng nợ khi ĐC. Native update trực tiếp phiếu nối có khoản nợ bị chặn; sửa qua Điều phối.
- CN cũ của terms giữ số tiền/key và mapping cũ, trả bù dùng lại. Đơn cũ chỉ có terms nhưng chưa từng ghi CN không tự sinh nợ. Đã đóng cũ không có outbox thì giữ trách nhiệm còn nợ đã chốt; lúc có trả bù mới tạo chứng từ nối cần thiết và yêu cầu gán đúng khách.
- Đóng cần nghiệm thu hoặc phí đã chốt, không vật tư mở, không khoản thu/đề nghị nợ chờ, đã xác nhận đủ tiền hoặc nợ approved, tiền mặt đã nộp, đồng bộ hoàn tất. Không miễn điều kiện NQ hay sync vì có nợ.

## UAT trên bản sao

1. Khách có quyền: đơn 300k, thu cash 200k, Ghi nợ 100k; kiểm CN Finance tổng 100k/MA_DOI_CHIEU TD, THU cash 200k vào tài khoản thợ giữ. Nộp quỹ/xác nhận/sync rồi đóng.
2. Khách thường: chọn Ghi công nợ + lý do; kiểm chưa có CN native, remaining chưa giảm. Điều phối ở tab **Nợ chờ duyệt** duyệt; không đổi allow_credit của khách. Kiểm cả từ chối và lý do.
3. Đơn đóng còn nợ 100k: trả bù ACB 60k; chờ xác nhận chưa tính là tiền đã đối soát. Kế toán xác nhận/sync: THU ACB 60k, native CN đã thanh toán 60k/còn 40k; retry không trùng. Đóng lại ghi nợ còn 40k.
4. PT cash trả bù chưa có NQ: thử ĐC giảm; kiểm Finance hủy gốc và trả lại nợ trước khi lập THU mới. PT có NQ đã nhận vẫn bị chặn.

Các kiểm thử native dùng workbook mô phỏng, không phải Google thật. Quyền remote Google hiện trả 403 ở Execution API/Sheets; chưa nhận pass Google cho luồng mới. UAT thủ công dùng copy đã cấu hình, không Finance/Kho thật. Không yêu cầu gửi token/mật khẩu.

## Vận hành và khôi phục

Giữ account, ID copy, token/HMAC, bảng gán, dữ liệu/chứng từ hiện tại. Không chạy setup/reset lại. Trước dùng thật vẫn cần normalized tables, đối soát tài khoản/công nợ/phiếu, chống lạm dụng login và phê duyệt riêng triển khai app thật.

Nếu chưa có CN/PT trả bù mới có thể dừng đồng bộ và khôi phục code cũ sau đối chiếu. **Sau khi có sổ nợ mới không rollback riêng về v52**: reader cũ không hiểu debts/debt_allocations và có thể ghi nợ theo tổng đơn. Dừng thao tác ghi/sync, giữ reader mới, đối chiếu CN/PT/NQ/Finance và sửa tiếp; phục hồi chỉ trên bộ snapshot đồng bộ của bản sao, không xóa CN hay chỉnh số dư đầu kỳ để bù. Không thay đổi Finance main/project thật trong đợt này.
