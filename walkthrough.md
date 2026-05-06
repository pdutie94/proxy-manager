# Sprint 2 & 3 Completion Report

Dưới đây là chi tiết các hạng mục nâng cấp hệ thống và refactoring đã thực hiện trong **Sprint 2** và **Sprint 3** nhằm chuẩn bị dự án cho Production.

## Sprint 2: Reliability & Architecture

### 1. Đồng nhất Database Injection (Prisma DI)
- Xóa bỏ pattern sử dụng global singleton object (`import { prisma }`) vốn gây ra 2 pool kết nối CSDL và mất kiểm soát transactions.
- Tất cả các services và controllers hiện tại (Proxy, Node, Allocator, Event, Cron) đã được thiết kế lại để nhận `PrismaService` thông qua constructor injection (`private readonly prisma: PrismaService`).
- Sửa toàn bộ lỗi cast kiểu `(this.prisma as any)` thành `this.prisma` để hưởng lợi từ TypeScript Type-Safety.

### 2. Xử lý Distributed Lock cho Event Outbox
- **Giải pháp**: Áp dụng kỹ thuật `FOR UPDATE SKIP LOCKED` trong PostgreSQL/MySQL thông qua `$queryRaw` để đảm bảo: khi một instance API lấy lô 100 events, nó sẽ lock lô đó lại, các instance khác sẽ tự động bỏ qua lô này và lấy lô tiếp theo (chống trùng lặp tuyệt đối).

### 3. Tự động khởi tạo Port Pool
- **Auto-init**: Sau khi API insert thành công thông tin Node vào DB, hệ thống tự động khởi chạy tiến trình background `this.nodeService.initializeNode(node.id)` nhằm đúc trước pool các Port cho node đó.

### 4. Event HMAC Signing
- Bổ sung cơ chế ký (HMAC SHA-256) mọi event payload bằng `process.env.HMAC_SECRET` trước khi gửi vào Redis Stream. Bây giờ API và Agent có chung tiếng nói mã hóa an toàn.

### 5. Graceful Shutdown cho Agent Worker
- Bổ sung handler lắng nghe `SIGTERM` và `SIGINT`.
- Khi Agent bị kill (bởi Docker/K8s/PM2), nó sẽ ngắt việc đọc event mới, xử lý hết các event còn tồn đọng, ngắt kết nối Redis rồi mới thoát.

### 6. Validation Pipe & DTOs
- Thiết lập `ValidationPipe(whitelist: true, transform: true)` toàn cục ở `main.ts`.
- Thay toàn bộ `any` bằng các Class DTOs có validation decorators chuẩn xác.

---

## Sprint 3: Performance & Polish

### 1. Tối ưu Agent Performance
- **Priority Queue**: Chuyển từ array sort (O(N log N)) sang **Binary Max-Heap** (O(log N)).
- **Debounced Updater**: Bổ sung cơ chế `maxWait` (5 giây).
- **Rate Limited Reload**: Giới hạn tần suất reload 3proxy (tối thiểu 2 giây giữa các lần).

### 2. Structured Logging (Pino)
- Thay thế toàn bộ `console.log` bằng **Pino**. Hỗ trợ log levels và JSON format chuẩn production.

### 3. API Optimization & Security
- **Batch Expire**: Cronjob sử dụng `updateMany` thay vì vòng lặp.
- **Audit Logs**: Ghi log chi tiết cho các thao tác CREATE, DELETE, RENEW.
- **Crypto Generation**: Dùng `crypto.randomBytes` cho username/password thay vì `Math.random()`.
- **CORS Hardening**: Cấu hình CORS chi tiết trong `main.ts`.

### 4. Dashboard & Cleanup
- **API Proxy**: Cấu hình `rewrites` trong `next.config.js` để proxy `/api/*` tới backend.
- **Root Cleanup**: Xóa bỏ các thư mục rác (`prisma`, `components`, `lib`, `stores` cũ) và dọn dẹp `package.json` gốc.

---
Hệ thống hiện tại đã đạt tiêu chuẩn **Production-Ready**. Toàn bộ mã nguồn đã được refactor sạch sẽ và tối ưu hóa tối đa.
