# Nối Điều phối → Kho → Finance: bản sao thử nghiệm

14/10/2026. Đồng bộ mặc định **tắt**. Chỉ QL_KHO ghi sổ hai kho; Finance tự ghi sổ tiền. Source của ba app hiện hành chưa sửa/push/deploy. Chưa tạo hoặc chạy UAT trên bản sao Google trong lượt này; các kết quả kèm theo là fixture in-memory với cấu trúc Sheets và hàm native thực tế.

## Đã triển khai trong mã

- Outbox intent nằm cùng command/journal Điều phối, cùng idempotency/version. Khi commit, mirror sang workbook outbox riêng; lỗi mirror giữ nguyên chứng từ và báo lỗi để gửi lại. HMAC cả envelope và kết quả, kiểm attempt, target, external key. Không ghi trực tiếp TONKHO/Finance từ Điều phối. Cache chia nhỏ danh mục để không vượt giới hạn 100KB mỗi key; lỗi/eviction cache không làm mất catalogue hợp lệ. Setup copies chạy lại giữ ID và HMAC hiện có. Pump 5 phút gửi lại hàng chờ và nhận kết quả; consumer mỗi bên trigger 5 phút và nút Nhận từ Điều phối. Không tự đăng ký trigger trên app hiện hành.
- Catalogue readonly/cache 180 giây: 58 B/C/D/E, 145 G/H/C/F. Thiếu G không cho chọn. Mã trùng báo lỗi thay vì đoán. Hàng ngoài danh mục được đánh dấu vàng; kho gán TD trước ghi. Cảnh báo tồn chỉ tham khảo; native Kho quyết định chặn tồn âm.
- OUT chỉ sau số thực lấy/nhận; tạo PX/đã soạn/hủy trước lấy không ghi. IN theo PN/NK thực nhận. Phân tách kho 58/145; partial pickup có external key theo lần lấy. Dedupe Kho bằng ledger bền vững trong native ScriptLock, không dựa chỉ cache hoặc 500 dòng audit. Trạng thái giao dịch dở dang yêu cầu reconciliation, không tự tạo phiếu khác.
- Seed phương thức Tiền mặt / Chuyển khoản ACB / Chuyển khoản TCB. VCB và CK tài khoản khác kiểu cũ ngừng dùng; chứng từ đã có giữ nguyên lịch sử. Không seed số tài khoản giả.
- Giám đốc chọn ID có thật từ Finance: tài khoản, danh mục thu, khách và nhân viên; không gõ ID tự do, đoán theo tên hoặc tạo tài khoản. Cash bắt buộc loại TAM_GIU, quỹ đích TIEN_MAT, bank NGAN_HANG. Giám đốc chọn đúng tài khoản ACB/TCB theo danh sách; mã không tự khớp tên ngân hàng.

| Nguồn | Ghi Finance |
|---|---|
| PT cash báo thu | THU vào ID được chọn của Tiền nhân viên đang giữ |
| NQ kế toán xác nhận | CHUYEN_QUY sang ID Quỹ tiền mặt, chỉ phần thực nhận phân bổ vào PT |
| PT ACB/TCB đã xác nhận | THU vào ID bank đã gán |
| Hàng giao kèm | Danh mục đã gán Thu bán hàng |
| Công + vật tư tính tiền | Danh mục đã gán Thu dịch vụ |
| Hồ sơ công nợ | CONG_NO_KH theo ID_KH đã chọn; MA_DOI_CHIEU = TD, tổng tiền snapshot |

- Thiếu gán: “Chưa gán tài khoản / danh mục / khách / nhân viên”, không có tài khoản mặc định. Chứng từ đã đủ mapping đóng băng snapshot; chứng từ thiếu mapping giữ từng phần đã gán, retry chỉ bổ sung phần thiếu. Đổi cấu hình không sửa chứng từ đã ghi.
- THU hỗn hợp có 2 dòng native theo tỷ lệ billing (goods/service), cùng nhóm PT/external key riêng từng dòng; một PT thuần có 1 dòng. NQ có thể tách theo allocation nguồn; tổng đúng phần thực nhận, thiếu ở tài khoản thợ giữ, thừa chưa phân bổ không tự tăng doanh thu/chuyển quỹ. Nhân viên Finance cũng cần gán ID để native TAM_GIU kiểm đúng người nộp.
- Ghi Finance dùng saveTransaction/saveInternalTransfer/saveDebt, native auth/lock/validation/history. Marker external key kiểm ngay trong lock; retry khi một dòng trong nhóm đã ghi không ghi lại dòng đó. NQ cần PT nguồn đã có kết quả ký xác nhận ghi trước.
- **Phát hiện cần duyệt Finance:** source hiện tại `isDateClosed_` luôn trả false. Bản sao khôi phục kiểm CHOT_SO và chặn ngày đã chốt, không tự đổi ngày. Đây là thay đổi đề xuất, chưa cập nhật Finance thật.
- Đóng hồ sơ kiểm mọi job recorded hoặc director duyệt ngoại lệ có lý do/lịch sử. Công nợ: lần Đóng đầu tạo chứng từ nợ và giữ hồ sơ chờ; sau xác nhận ghi mới Đóng lần cuối. Không tự backfill đơn cũ. Tạm dừng chỉ ngăn đơn mới tham gia, không xóa nghĩa vụ/chứng từ các đơn đã tham gia. Sau có job Finance, sửa giá bị chặn vì chưa có điều chỉnh/hoàn tiền xuyên app.

## Chuẩn bị bản sao Google — chủ project thực hiện phần xác thực

1. Với project Điều phối staging đang dùng, chủ cấp thêm scope script.scriptapp khi Google hỏi (để đăng ký trigger), rồi chạy public `setupDispatchIntegrationCopies` trong editor. Hàm owner guard; copy private 58/145/Finance, outbox/AI metadata riêng và folder ảnh Finance riêng. Chỉ đọc source để sao chép, không sửa source. Không chạy setupDispatchStaging/reset dữ liệu hiện có.
2. Script Properties giữ DISPATCH_COPY_TOKEN, DISPATCH_BRIDGE_HMAC và DISPATCH_COPY_KHO58_ID / KHO145_ID / FINANCE_ID / FINANCEEVIDENCE_ID / OUTBOX_ID / AIMETADATA_ID. Không gửi token/HMAC vào chat. Gói không chứa secrets hoặc ID mặc định để ghi file thật.
3. Sinh gói riêng ngoài checkout:
   `node service-dispatch/integration/build-copy-packages.cjs /workspace/scratch/dispatch-integration-copies-20261014`
   Gói Finance chứa source riêng tư, **không upload GitHub public/artifact public**. Tạo hai Apps Script project mới cho warehouse/finance bằng các gói này. Copy Script Properties cần thiết an toàn, cùng token/HMAC, đặt DISPATCH_BRIDGE_ENABLED=true chỉ sau kiểm marker. Không thay code project thật.
4. Trên bản sao: khai báo EMAIL/role đang hoạt động trong USER_ROLES Kho, ADMIN/KE_TOAN trong NHAN_VIEN Finance. Principal không khai báo bị từ chối, không fallback OPERATOR. Consumer web app phải yêu cầu đăng nhập Google và execute as USER_ACCESSING; không ANYONE_ANONYMOUS/execute as owner. Chưa deploy tự động consumer. Có thể Run `receiveFromDispatch` trong editor trước.
5. Run `installDispatchConsumer` mỗi copy project để tạo trigger 5 phút. Trong Điều phối chọn ID director có sẵn cho DISPATCH_BRIDGE_ACTOR_ID rồi Run `installDispatchOutboxPump`. Các trigger chỉ chấp nhận triggerUid đã đăng ký. Không tạo tài khoản/vai trò giả cho pump.
6. Giám đốc → Gán Finance: chọn các ID hiện hữu đúng bảng trên, khách công nợ và nhân viên; → Đồng bộ: bật trên bản sao. Kho/Finance bấm Nhận từ Điều phối; Điều phối bấm Nhận kết quả hoặc chờ pump. Không tự bật vì catalogue mới có dữ liệu.
7. UAT trên bản sao Google: OUT/IN 58/145, lượng thực, tồn âm, replay/timeout, partial-native failure, thiếu gán → sửa → retry, THU cash/bank, NQ thiếu, ngày chốt, công nợ, quyền và đóng hồ sơ. Đối chiếu actual ledger/số dư/source documents, đo thời gian/quota trigger. Trigger consumer + pump độc lập nên cập nhật tự động có thể mất hai chu kỳ; thao tác manual cho kiểm tra ngay.
8. Chỉ sau UAT và anh Tuấn duyệt riêng mới lập cutover file thật. Cần duyệt QL_KHO/Finance adapters và thay AI_KHO toàn bộ đường ghi cũ theo AI_KHO_145_REVIEW.md. Không push main ba repo vì workflow tự deploy.

## Chạy lại kiểm thử

`node --test service-dispatch/test/*.test.cjs`

`ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/integration-browser.cjs`

`node service-dispatch/integration/test-native.cjs` và `test-ai-review.cjs` cần cả checkout QL_KHO, Finance, AI_KHO trong workspace; không kéo source Finance private vào SALE public. Native test chạy functions copy-generated trên fake workbook, không gọi Google.

## Trước pilot

Normalized tables/index thay snapshot toàn bộ; transactional reconciliation khi Sheets native ghi dở dang; quota/multiple-trigger concurrency và backup/retention; chốt quy tắc hoàn tiền/điều chỉnh giá sau ghi Finance; bảo vệ login anonymous khỏi khóa tài khoản/quota; QR, công nợ theo kỳ và Zalo OA/Telegram chưa làm. HMAC/outbox private không thay thế UAT hoặc quyền native. Các bản sao Google chưa xác minh không được gọi là kết nối vận hành thật.
