# AI_KHO: các đường ghi Kho 145 và đề xuất chuyển

Ngày 14/10/2026. Đối chiếu checkout AI_KHO `d77e5be`, QL_KHO `bb25855`. **Chưa sửa/push/deploy AI_KHO hiện hành.** Mã review sinh ở ngoài repository, chỉ nhận ID bản sao có marker. Quyền ghi sổ cuối cùng thuộc QL_KHO cho cả 58/145; không dùng quyền mặc định OPERATOR khi principal chưa có trong USER_ROLES.

## Các đường ghi tìm thấy

Số dòng dưới đây thuộc source gốc AI_KHO; đường dẫn tương đối trong repository đó.

| Source / hàm | Ghi trực tiếp / đường gọi | Chuyển đề xuất |
|---|---|---|
| `code.js:74` `updateReferencePrice` | Giá I, thời điểm K, xóa giá/thời điểm (134–138) | Chặn ở review; phải làm qua tác vụ giá có quyền của QL_KHO. Chưa có adapter giá được duyệt. |
| `code.js:163,183` `setupInventoryValueColumns` / `ensureInventoryValueColumns_` | Header I:K, công thức F×I, định dạng | Chuyển thao tác bảo trì/schema về chủ app Kho. Proxy không cho setter trên sheet kho. |
| `code.js:740` `commitAiMutations_` | Điều phối ghi IN/OUT, reversal, pending, daily close | IN/OUT đưa vào outbox AI_KHO:<request>:<action>; QL_KHO đọc, kiểm INVENTORY_IN/OUT rồi chạy native pipeline. Không báo executed khi mới xếp hàng. Các action khác bị chặn, không âm thầm bỏ qua. |
| `code.js:1074` `resetTonKhoDailyCountersIfNeeded_` | Reset D/E TONKHO về 0 (1080), tự đổi bộ đếm ngày | Bỏ reset ở AI. Bộ đếm/tổng hợp thuộc QL_KHO. |
| `code.js:1169` `commitMovementRows_` | TONKHO D/E/F/J; CHOTHUE D:H; nhật ký giao dịch (1177–1179) | Bỏ toàn bộ ghi trực tiếp. IN/OUT TONKHO chuyển qua outbox, dùng G mã TD chuẩn; không fuzzy-match. CHOTHUE chưa có adapter: chặn rõ. |
| `code.js:1180` rollback của movement | Khôi phục dữ liệu/công thức tồn; xóa dòng nhật ký | Chỉ QL_KHO quản lý rollback/ledger/reconciliation. |
| `code.js:1182` `commitAiReversal_` | Gọi movement, cập nhật trạng thái REVERSED, khôi phục tồn và nhật ký khi lỗi (1186) | Chặn; chuyển người dùng sang chức năng hoàn tác QL_KHO. Chưa có adapter reversal được duyệt. |
| `code.js:1189` `commitAiPending_` | Gọi movement rồi ghi pending ID/trạng thái/transaction/time; rollback tồn/nhật ký (1194) | Chặn; cần adapter pending của QL_KHO, không ghi Kho 145. |
| `code.js:1197` `commitAiDailyClose_` | Backup nhật ký, snapshot tồn/giá, trạng thái ngày; clear/rewrite nhật ký; rollback (1202–1206) | Chặn; chốt ngày/retention/backup thuộc QL_KHO. |
| `MANUAL_INVENTORY.js:17,79,144` preview/`commitManualInventoryMovement` | Mở trực tiếp file, reset bộ đếm, gọi movement | Preview chỉ đọc; commit đưa IN/OUT vào cùng outbox, giữ ngày/request ID, chưa ghi sổ. |
| `MANUAL_REVERSAL.js:90–107` `commitManualReversal` | Gọi movement, đánh dấu REVERSED, rollback/xóa nhật ký | Chặn và chuyển về QL_KHO. |

## Ghi metadata cũng nằm chung file Kho 145

- `ensureAiSheets_` (code.js:968–976), seed/update alias (1000,1018), append log: tạo/ghi sheet AI_ALIAS và AI_LOG theo tên cấu hình. Đề xuất chuyển sang workbook AI metadata riêng; không cần ghi file Kho.
- `ensureJournalHeader_` (1090–1098), `ensureOperationSheets_` (1142–1148), `ensurePendingHeader_` (1151–1154): tạo/header/format journal, backup, pending, daily close, snapshot và ID pending. Đề xuất bỏ quyền sửa schema các bảng này khỏi AI.
- `AI_ALIAS_V2.js:27,32,192,210,229–249,254`: tạo header, bổ sung/sửa alias, trạng thái duyệt, thời điểm. Thay mọi openById bằng proxy; ghi sang AI metadata riêng.
- `AI_AGENT_V13.js:32`: mở workbook rồi gọi helper; thay bằng proxy chỉ đọc. AI_AGENT_V1, DEPLOY_AGENT_V13, DEPLOY_BATCH_SELECTION không có setter Sheets trực tiếp; helper bị giới hạn như trên.
- Rà soát toàn bộ `.js`: mọi openById trong bản review chuyển qua `aiReadStockBook_`. Range → getSheet → getParent → getSheetByName/getSheets vẫn bị chặn ghi. Không chỉ khóa UI; các hàm server ghi cũ cũng bị chặn/thay thế.

## Phạm vi review và điều kiện duyệt

`build-ai-review.cjs` tạo bản review riêng có toàn bộ file JS/Index. Cần `AI_KHO_BRIDGE_APPROVED=true` mới được gửi IN/OUT; cờ mặc định chưa đặt. Outbox riêng được ký HMAC; consumer Kho kiểm quyền Google thật và mã TD hiện hành trước ghi. Nhật ký QL_KHO giữ external key để replay sau khi cache hết hạn vẫn không trùng.

Kiểm thử local: 8 nhóm kiểm tra đạt, gồm setters/nested capabilities bị chặn, metadata riêng, cần duyệt, queue/replay, nhập/xuất thủ công giữ ngày. **Không có nghĩa AI_KHO đang chạy trên Google đã ngừng ghi**: bản hiện hành vẫn giữ source cũ cho đến khi chủ duyệt và triển khai chuyển đầu ghi. Trước bật đồng bộ thật phải khóa mọi đường ghi AI cũ, chuyển trigger/người dùng, đối chiếu tồn/ledger và kiểm thử trên bản sao Google. Giá, CHOTHUE, reversal, pending, daily close cần quyết định luồng QL_KHO tương ứng; bản review chặn chứ chưa thay thế toàn bộ tính năng đó.
