# Danh bạ khách — 15/10/2026

## Phạm vi đã làm: bước 1 và 2, COPY riêng

- Core Danh bạ KTD-000001 tăng bền vững, hai nơi lưu bộ đếm, không dùng số dòng/không tái sử dụng; counter hỏng/lùi bị chặn. ScriptLock, expected_version, idempotency và WAL delta có kiểm checksum/phục hồi, receipt/lịch sử không nhân đôi sau retry hoặc ghi dở.
- KHACH + index SĐT/MST/tên không dấu/mã/alias, lịch sử trước/sau/người/thời điểm, soft stop/merge. Quyền cấp trường: chỉ finance/director đổi tên, MST, loại/quyền/hạn mức nợ và trạng thái; các vai trò kinh doanh/tiếp nhận/điều phối tìm/tạo/sửa liên hệ. Gộp chỉ director, kiểm version hai phía, giữ mã nguồn và liên hệ/lịch sử/alias.
- API HTTP Google authenticated + HMAC/timestamp, client/actor allowlist, role server; không ANYONE_ANONYMOUS ghi. Mặc định không cấp key hay nối app nào. Browser dùng Google ActiveUser; không xác định được email thì chặn, cần UAT tài khoản ngoài Workspace trước pilot.
- UI tìm/chọn một dòng, max20, bàn phím/ARIA, tạo từ ô tìm; tạo/sửa/gộp/lịch sử; loại/trạng thái ngắn là nút chọn ngang. Kiểm trùng MST/SĐT trả khách hiện có, cùng SĐT công ty có thêm liên hệ hoặc tạo riêng có lý do. Hủy kết quả tìm cũ đến chậm tránh chọn nhầm người.
- Bộ nhập chỉ đọc bốn COPY do chủ tạo; chặn ID gốc/tên/owner/thời gian sai, registry có chữ ký. Adapter theo cột thực tế Sales/CARE/Finance, Finance chỉ LA_KHACH_HANG, bắt buộc đọc công nợ; Điều phối đọc copied snapshot+hash/journal, không nối API hay ghi app đó.
- DUYET_TRUNG: ghép chắc MST hoặc SĐT+tên; các nhóm nghi ngờ phải KT duyệt, nợ mở phải thêm GD khác người duyệt. Cả ghép chắc nhưng có nợ cũng bị giữ. Quyết định/fingerprint/version bền vững, nội dung nguồn đổi phải duyệt lại; không trộn nhóm qua MST mâu thuẫn hoặc quyết định Khác khách bắc cầu. Cấp tối đa50 nhóm/lượt, một mã/nhóm, ANH_XA giữ ID và mã hiển thị cũ của Finance/Điều phối. Rerun không cấp lại, không ghi đè khách đã được sửa tay.
- Ưu tiên thông tin hóa đơn Sales, quyền/hạn mức nợ Finance mới nhất; chỉ thiếu Finance mới fallback Điều phối credit. SĐT/địa chỉ từ dòng mới nhất có thông tin; thiếu timestamp báo riêng, không đoán ngày. Chưa gán nhóm nguồn tùy ý vào khách tạo tay: trùng master hiện có dừng để kiểm tra, không tự tạo khách trùng. Nên nhập trước khi tạo khách dùng thật.

## Kiểm chứng local

**62/62 Node, 8 nhóm trình duyệt đạt, không pageerror**, build GAS đạt. Bao gồm nguồn giả MST/SĐT/tên khác/không số/nợ, KT+GD, stale version sau rescan, alias ID/mã hiển thị, chạy lại giữ mã, hai người tạo đồng thời; 9 điểm lỗi WAL native-driver mock, counter hỏng/lùi, compiled GAS HMAC/session/provision guard, rich text literal, browser390px và stale search. [Kết quả local](docs/LOCAL_VERIFICATION.json).

Đây là fixture/local/compiled VM, **không phải kết quả gộp khách thật trên Google**. CI/project Google sẽ có bằng chứng riêng. Chưa có bốn ID COPY do chủ tạo nên chưa đọc/gộp dữ liệu khách thật, chưa có số khách/nhóm thực tế để báo. Link thiết kế Claude chỉ trả khung Artifact, phần nội dung chưa đối chiếu được; thực hiện theo đặc tả chi tiết trong tin nhắn.

## Google / CI đã kiểm chứng

- Commit code `3d1d55e`, CI [38734359081](https://github.com/tinhocthanhduc-dotcom/SALE_THANHDUC/actions/runs/38734359081): Node và browser mới đều thành công; project Danh bạ riêng đã triển khai **v1**, Google login bắt buộc. [Link app/editor](project.copy.json), [bằng chứng](docs/GOOGLE_STATUS.json).
- Lần gọi setup qua Execution API **chưa xác nhận thành công**; không gọi đó là đã có workbook hoặc UAT Google. Chủ mở app bấm khởi tạo hoặc Run setupCustomerDirectory, sau đó Run runCustomerDirectoryCopyUat. Hàm setup chạy lại an toàn, không reset nếu lần trước đã khởi tạo.
- Hai job deploy cũ xác nhận skipped: Điều phối 38734358972, consumer 38734358982. Không cập nhật project Google cũ. Chưa có COPY nguồn được cấu hình, chưa đọc/gộp khách thật, chưa có báo cáo số khách thực tế.

## OWNER_SETUP

1. Mở web app project **Danh bạ riêng**, bấm Khởi tạo bản sao, hoặc Run setupCustomerDirectory nếu CI chưa confirmed setup.
2. Cấp email finance/director khác nhau. Run runCustomerDirectoryCopyUat nếu CI chưa xác nhận; hàm chỉ tạo workbook UAT giả riêng, không đụng root/source.
3. Chủ tạo bốn file CD_COPY_ sau setup, giữ nguyên sheet/cột; điền CD_SOURCE_COPIES_JSON + CD_CONFIRM_SOURCE_COPIES, Run configureCustomerDirectorySources.
4. KT quét → duyệt → GD xác nhận nợ → KT cấp mã → đối chiếu ANH_XA và số đếm. Các ô lựa chọn trên sheet chỉ là nháp, phải áp dụng bằng danh tính KT thật.

[Hướng dẫn từng bước](README.md), [UAT/khôi phục](docs/UAT.md), [API](docs/API.md), [lưu trữ](docs/ARCHITECTURE.md).

## Chưa làm theo phạm vi chủ chốt

Chưa sửa/ghi/deploy Sales, CARE, Finance thật; chưa nối Điều phối hoặc điền MA_KHACH_CHUNG, chưa gộp công nợ/số dư của app nguồn. Chưa cấp key tích hợp cho các app. Không công khai workbook/khách/khóa. Có gate workflow để đợt này không tự redeploy Điều phối hoặc consumer cũ; chỉ request deployment tương ứng đổi mới được chạy.

Trước pilot: UAT Google nhiều tài khoản và số dữ liệu thật trên COPY; rà dữ liệu xấu/thiếu ngày/nợ cũ, đo thời gian/index/journal và backup/retention, xử lý nhóm vượt giới hạn30k quan hệ/8MB transaction, quy trình sửa gộp nhầm/gán nhóm vào khách tạo tay. Các bước nối app và triển khai dữ liệu thật cần đợt phê duyệt riêng.


## Bản sửa quét SĐT cũ (revision 2)

Quét không dừng vì số điện thoại nguồn không hợp lệ. Tách từng số, chuẩn hóa phần hợp lệ; phần lỗi không dùng để ghép và không tự đoán. Giao diện Gộp khách cũ có danh sách tổng hợp nguồn/mã cũ/SĐT gốc/phần lỗi. Giá trị gốc và phần lỗi giữ ở JSON của sheet NGUON (DIEN_THOAI_GOC, DIEN_THOAI_LOI), kể cả sau cấp mã. Chủ có thể sửa nhiều dòng trên bản sao nguồn rồi quét lại. API tạo/sửa danh bạ vẫn kiểm SĐT nghiêm ngặt. Cần rà danh sách lỗi trước khi duyệt/cấp mã; SĐT chưa xác minh không được tự bổ sung vào khách. Không sửa dữ liệu nguồn hoặc app thật.

Kiểm tra revision 2: 63/63 Node; 8 nhóm trình duyệt 390px (gồm bảng SĐT lỗi, chuỗi HTML được escape); build GAS đạt. Chưa đối chiếu kết quả quét dữ liệu thật trên Google.


## Quét MST cũ (revision 3)

MST không hợp lệ không dừng quét; liệt kê toàn bộ trong mục MST cần kiểm tra, đồng thời với SĐT lỗi. NGUON giữ MST_GOC và MST_LOI; MST chuẩn hóa để trống khi sai, không dùng giá trị sai để ghép, không tự đoán/thêm số 0. Có thông tin MST gốc vẫn giữ loại công ty. Cần rà lỗi trước cấp mã; sửa trên bản sao rồi quét lại. CRUD vẫn chặn MST sai. Kiểm tra: 64/64 Node, 8 nhóm trình duyệt (cả lỗi SĐT/MST cùng lượt, HTML escape), build GAS đạt; chưa xác nhận quét dữ liệu Google thực tế.


## PHONE_OF_PERSON

Đã bổ sung cảnh báo chiều cá nhân → công ty, kèm mã cá nhân và ba lựa chọn. Chuyển loại dùng update có version/quyền KT/GĐ; tạo công ty + liên hệ atomically lấy thông tin cá nhân từ server, kiểm version; tạo riêng bắt buộc lý do. Không tự gộp, không đổi phạm vi migration/tích hợp.

Kiểm tra: 67/67 Node (gồm service API, quyền giả, replay, stale version), 9 nhóm browser 390px (cả 3 lựa chọn và sales không thấy chuyển loại), build GAS đạt. Chưa UAT Google thay đổi này. DEPLOY_REQUEST không đổi: chưa triển khai bản vá, OWNER_SETUP vẫn do chủ chạy trên bản sao.
