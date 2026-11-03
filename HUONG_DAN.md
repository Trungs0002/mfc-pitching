# Hướng dẫn sử dụng - Web chọn thứ tự pitching MFC

## A. Dành cho các nhóm (leader và mentor)

1. Mở link web. Bảng thứ tự pitching (số nào của nhóm nào, số nào còn trống) chỉ hiện sau khi nhóm nhập đúng mật khẩu.
2. Khi nhận email mật khẩu, mở web và nhập mật khẩu vào ô "Nhập mật khẩu", bấm "Vào". Hệ thống tự nhận ra nhóm của bạn.
3. Sau khi vào, bạn có 10 phút (đồng hồ đếm ngược ở góc phải). Bấm vào một số còn trống rồi bấm nút "Chốt số ...". Nếu số vừa bị nhóm khác lấy, một hộp thông báo hiện lên và bạn chọn số khác.
4. Trong 10 phút đó bạn có thể đổi sang số trống khác. Khi đổi, hệ thống hỏi xác nhận "Đổi từ số ... sang số ...?" trước khi lưu. Hết 10 phút hệ thống tự đăng xuất và số hiện tại được chốt, không đổi được nữa.
5. Số đã được nhóm khác chọn sẽ bị khóa, bạn không chọn hoặc sửa được.

**Lưu ý quan trọng**
- Mỗi mật khẩu chỉ dùng được một lần. Đã vào là không vào lại được, kể cả bằng máy khác.
- Không tải lại trang, không tắt tab, không mất mạng khi đang trong phiên. Nếu làm vậy bạn sẽ mất lượt.
- Hãy chuẩn bị thiết bị và mạng ổn định trước khi mở email, và vào web ngay khi nhận mật khẩu.
- Nhiều nhóm có thể vào cùng lúc. Nếu số bạn chọn vừa bị nhóm khác lấy, một hộp thông báo hiện lên, bạn chọn số khác. Số đã có người chọn tự mờ đi.
- Nhập sai mật khẩu 5 lần trong 1 phút thì bị khóa tạm thời khoảng 1 phút.
- Mất lượt (vào phiên mà hết 10 phút chưa chọn) thì nhóm hiện "Chờ random". Nhóm chưa từng đăng nhập vẫn chọn được đến 15:00 ngày 4/11, sau mốc này mật khẩu bị khóa và nhóm bị random. Số cho các nhóm mất lượt được random từ các số còn lại sau khi các nhóm khác chọn xong.
- Kết quả chính thức được công bố lúc 17:00 ngày 4/11.

## B. Dành cho admin

### Đăng nhập
Vào `<link web>/admin`, nhập mật khẩu admin (biến `ADMIN_PASSWORD` trong file `.env` của server).

### Tạo team và mật khẩu
1. Ô nhập team đã điền sẵn TT01, TT02, TT03, MC01, MC02, MC03. Sửa lại nếu cần, mỗi dòng một team.
2. Bấm "Tạo mật khẩu". Hệ thống tạo mật khẩu ngẫu nhiên 10 đến 12 ký tự chữ và số cho từng team.
3. Số lượng số thứ tự bằng số team (6 team thì có số 1 đến 6).
4. Bấm "Chép" cạnh từng mật khẩu để copy rồi gửi email cho đúng team, lần lượt từng team cách nhau 30 phút. Việc gửi mail do admin tự làm.
5. Team chưa vào phiên có thể "Đổi mật khẩu" (tạo mật khẩu mới, mật khẩu cũ mất hiệu lực) hoặc "Xóa". Nên tạo đủ team trước khi bắt đầu gửi mật khẩu.

### Theo dõi trạng thái
Bảng tự cập nhật mỗi 10 giây, gồm các trạng thái:
- **Chưa vào**: chưa nhập mật khẩu.
- **Đang trong phiên**: đang trong 10 phút chọn số.
- **Đã chọn**: đã chốt số.
- **Chờ random**: mất lượt, chưa được gán số.
- **Mất lượt**: mất lượt và đã được random số (cột "Số" ghi "random").

Nhãn "Đã dùng" cạnh mật khẩu nghĩa là mật khẩu đó đã bị đốt.

### Chốt và random
- Hệ thống tự random một lần khi tất cả các nhóm còn lại đã chọn xong hoặc đã qua 15:00 ngày 4/11. Việc kiểm tra này chạy khi có người mở web, nên nếu sau 15:00 mà chưa thấy random thì bấm nút dự phòng.
- Nút "Chốt và random": các team chưa có số đều mất lượt, phiên đang chạy bị kết thúc, rồi random các số còn trống cho các team đó. Chỉ chạy được một lần, kết quả bị khóa.
- Sau khi random xong không thêm, xóa team hay random lại được.
- Công bố kết quả chính thức lúc 17:00 ngày 4/11 do admin thực hiện.

### Cấu hình và deploy
Xem `README.md`. Các biến môi trường của server: `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`, tùy chọn `CORS_ORIGIN` và `DEADLINE`. Client cần `REACT_APP_API_URL` trỏ tới domain server. Khi deploy lên Vercel, nhập các biến này trong Project Settings > Environment Variables.
