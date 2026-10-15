# API v1 — chưa cấp khóa hoặc nối các app

Endpoint: `/exec` của **project Danh bạ COPY riêng**, POST JSON. Deployment `ANYONE` yêu cầu Google đăng nhập, không `ANYONE_ANONYMOUS`. Chữ ký HMAC bắt buộc cho HTTP; Google session không thay cho khóa HMAC. App gọi về sau phải dùng ngữ cảnh Google/OAuth được phép và HMAC từ server. Chưa kiểm chứng lời gọi giữa bốn app trên Google, chưa sửa client app nào.

Mẫu envelope (giá trị minh họa, không phải khóa thật):

```json
{
  "client_id":"sales-copy",
  "actor_id":"nhanvien@example.com",
  "timestamp":1792058400000,
  "action":"create",
  "idempotency_key":"uuid-ngau-nhien-khong-doi-khi-retry",
  "payload":{"customer":{"LOAI":"CA_NHAN","TEN":"Khách mẫu","DIEN_THOAI":["+84 90 123 4567"]}},
  "signature":"HMAC_SHA256_HEX"
}
```

- `signature` = HMAC-SHA256 UTF-8 của canonical JSON của **toàn envelope trừ signature**, khóa client; object keys sắp xếp đệ quy, array giữ thứ tự (`stable` trong repository.cjs). `timestamp` milliseconds UTC, lệch tối đa 5 phút. Retry quá thời gian phải ký lại timestamp mới, giữ idempotency_key/payload/version cũ.
- Client chỉ dùng actor_id trong allowlist do chủ cài; quyền lấy từ CD_USERS ở server, không lấy roles, email hoặc người duyệt trong payload. Tắt client/người dùng chặn cả replay.
- Ghi bắt buộc idempotency_key; một khóa + command + actor → cùng kết quả, thay payload/actor → IDEMPOTENCY_CONFLICT. Idempotency không thay kiểm version. Unknown fields và ID tự gán bị từ chối.
- Response `{ok:true,data:...}` hoặc `{ok:false,error:CODE,details?:...}`; ContentService có thể trả HTTP 200 khi nghiệp vụ lỗi. Không dựa riêng HTTP status. Lỗi trùng trả existing có mã/khách hiện tại cho actor đã được xác thực, không ghi thêm.
- Không log envelope/response có thông tin khách hoặc khóa. Không đặt khóa trong HTML/trình duyệt, URL, repository hoặc chat.

## Các action

| action | payload | version / quyền |
| --- | --- | --- |
| search | `{q}` | 5 vai trò, tối đa 20; không dấu/hoa thường, SĐT một phần, MST, mã KTD/mã cũ; khách đã gộp trả đích |
| get | `{ma}` | 5 vai trò; KTD hoặc alias đầy đủ `SALE:KH0012` |
| create | `{customer,confirmation?}` | 5 vai trò; cấp KTD server; CHO_PHEP_NO/HAN_MUC_NO khác 0 chỉ finance/director |
| update | `{ma,customer,reason?,confirmation?}` | expected_version của khách bắt buộc; TEN/MST/LOAI/CHO_PHEP_NO/HAN_MUC_NO/TRANG_THAI chỉ finance/director |
| add_contact | `{ma,contact:{ten,dien_thoai,ghi_chu}}` | expected_version, khách công ty; không tạo khách cá nhân trùng |
| merge | `{source,target,target_version,reason}` | expected_version của nguồn và target_version bắt buộc; chỉ director, lý do bắt buộc |
| history | `{ma}` | 5 vai trò, 100 sự kiện gần nhất; trước/sau/ai/lúc nào |
| report | `{}` | finance/director; chỉ số liệu tổng hợp |
| import_view | `{}` | finance/director; nhóm nợ đầu, trạng thái duyệt |
| review_detail | `{id}` | finance/director; chi tiết nguồn riêng tư |
| scan_copies | `{}` | finance/director; expected_version **toàn danh bạ**, chỉ nguồn COPY đã xác minh |
| review_import | `{id,decision,reason}` hoặc `{id,director:true,reason}` | expected_version của nhóm; finance duyệt CUNG_KHACH/KHAC_KHACH; director khác người duyệt xác nhận nhóm có nợ |
| finalize_import | `{limit?:50}` | finance; expected_version **toàn danh bạ**; tối đa 100 nhóm/lượt |
| mappings | `{}` | finance/director; bảng APP, MA_CU, MA_KHACH; không viết về app nguồn |

`customer`: LOAI CA_NHAN/CONG_TY, TEN, MST, DIEN_THOAI (array hoặc chuỗi cách bằng ; , /), EMAIL, DIA_CHI, NGUOI_LIEN_HE (array), CHO_PHEP_NO boolean, HAN_MUC_NO integer >=0, GHI_CHU, TRANG_THAI DANG_DUNG/NGUNG. VERSION/mã/audit/MA_CU không cho client sửa. SĐT về 10 số đầu 0; số bàn 02… 11 số cũng được giữ; +84/0084 và số di động 9 chữ số thiếu 0 được chuẩn hóa. MST 10 hoặc 13 số, bỏ cách/dấu chấm/gạch nối.

SĐT trùng công ty → COMPANY_PHONE_WARNING + existing. Người dùng chọn add_contact vào công ty hoặc create riêng với `confirmation:{mode:"CREATE_SEPARATE",reason:"..."}`. Không tự tạo khi mới có cảnh báo. Tên không dấu giống chỉ warnings SIMILAR_NAME.

Không có API ghi nguồn, export vào app nguồn hoặc giả lập quyền. `scan_import` nhận rows thô chỉ cho bộ kiểm thử nội bộ, HTTP/UI bắt dùng scan_copies. `apply_review_choices` chỉ UI Google đã xác thực finance; các ô sheet chỉ là lựa chọn nháp.

## Cấp client sau này (chưa làm kết nối)

Chủ cài `CD_PROVISION_CLIENT={"id":"sales-copy","actors":["email-da-cap-quyen@example.com"]}` rồi Run provisionCustomerDirectoryClient. Khóa sinh ngẫu nhiên, giữ trong CD_CLIENTS của project Danh bạ; hàm không in khóa. Chuyển khóa qua kênh bí mật đến Script Properties của client ở bước tích hợp đã được duyệt. Mặc định không có client/key nào được cấp cho Sales/CARE/Finance/Điều phối.


### SĐT cá nhân khi tạo công ty

`PHONE_OF_PERSON` trả `details.existing` và `choices`: `CONVERT_PERSON`, `CREATE_COMPANY_WITH_CONTACT`, `CREATE_SEPARATE`. Không cấp mã khi chưa xác nhận.

- Chuyển: dùng `update` trên mã cá nhân, `expected_version` của cá nhân và thông tin công ty. Chỉ finance/director; giữ KTD và lịch sử. UI giữ quyền nợ/hạn mức và thông tin liên hệ cũ khi ô mới trống.
- Tạo công ty + liên hệ: `create` với `confirmation={mode:"CREATE_COMPANY_WITH_CONTACT",person_id:"KTD-...",person_version:1}`. Server tự lấy tên/SĐT từ cá nhân và thêm liên hệ cùng transaction; không đổi hồ sơ cá nhân, kiểm phiên bản, không nhận nguồn cá nhân giả/mã đã gộp. Dùng lại idempotency key khi gửi lại.
- Tạo riêng: `confirmation={mode:"CREATE_SEPARATE",reason:"lý do bắt buộc"}`; ghi lý do vào lịch sử.

Các cảnh báo trùng MST, cá nhân trùng cá nhân, SĐT công ty và quyền cột giữ nguyên.
