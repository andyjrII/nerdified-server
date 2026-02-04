# Unified Auth & Roles Refactor — Plan & Progress

**Goal:** One role enum for all users (Student, Tutor, Admin), unified sign-in/signout/refresh for the platform, shared endpoints where possible, and proper RBAC using role from JWT. No backwards compatibility required.

---

## Role enum (new)

Replace the old admin-only `ROLE` (SUPER, SUB) with a single enum used for auth and RBAC:

```prisma
enum UserRole {
  STUDENT
  TUTOR
  SUPER_ADMIN
  SUB_ADMIN
}
```

- **STUDENT** — platform learner
- **TUTOR** — platform tutor (separate table, different fields)
- **SUPER_ADMIN** — full admin (e.g. create/delete admins)
- **SUB_ADMIN** — limited admin

Tables stay separate: **Student**, **Tutor**, **Admin**. Only Admin gets a `role` column; its type changes from `ROLE` to `UserRole` (values SUPER_ADMIN, SUB_ADMIN).

---

## Backend changes

### 1. Schema (Prisma)

- [x] Add enum `UserRole` with: `STUDENT`, `TUTOR`, `SUPER_ADMIN`, `SUB_ADMIN`
- [x] Remove enum `ROLE` (SUPER, SUB)
- [x] Change `Admin.role` type from `ROLE` to `UserRole`; default `SUB_ADMIN`
- [x] Run migration (existing admin rows: map SUPER → SUPER_ADMIN, SUB → SUB_ADMIN in migration or data fix)

### 2. Auth module

**Sign-in**

- [x] **Unified student/tutor sign-in:** One `POST /auth/signin` body: `{ email, password, role }` where `role` is `STUDENT` or `TUTOR`. Look up in Student or Tutor table by role; validate password; issue tokens with `role` in JWT payload. Response: `{ access_token, refresh_token }`; for tutor optionally include `approved: boolean` in body.
- [x] Remove `POST /auth/tutor/signin` (keep only `POST /auth/signin` for student/tutor).
- [x] Keep `POST /auth/admin/signin` (separate form). Response includes role (SUPER_ADMIN or SUB_ADMIN); put role in JWT.

**Sign-out**

- [x] One `POST /auth/signout` for all. Protect with AtGuard. Read `sub` + `role` from JWT; clear refresh token in correct table (Student, Tutor, Admin). No email query param.
- [x] Remove separate student/tutor/admin signout endpoints.

**Refresh**

- [x] One `POST /auth/refresh` for all. Refresh token payload must include `sub`, `email`, `role`. Validate and rotate refresh token in the correct table by `role`; issue new access + refresh with same role (and for admin, same SUPER_ADMIN/SUB_ADMIN).
- [x] Remove separate student/tutor/admin refresh endpoints.

**JWT payload**

- [x] Access token: `{ sub, email, role }` where `role` is `UserRole` (STUDENT | TUTOR | SUPER_ADMIN | SUB_ADMIN).
- [x] Refresh token: same `role` so refresh handler can branch by table.
- [x] Update `getTokens()` (or equivalent) to accept `role` and include it in both AT and RT.

**Optional shared endpoints**

- [ ] `GET /auth/me` — from JWT `sub` + `role`, load profile from Student, Tutor, or Admin and return.
- [ ] `PATCH /auth/me/password` — body `{ oldPassword, newPassword }`; update password in correct table by `role`.

**Password**

- [ ] Existing `PATCH /auth/password` (student) can stay as-is or be replaced by `PATCH /auth/me/password` for all roles.

### 3. Guards & RBAC

- [x] Add **RolesGuard**: reads `role` from JWT. Restricts route to allowed roles.
- [x] Add `@Roles(...roles: UserRole[])` decorator to specify allowed roles per handler/controller.
- [x] Apply to admin controller: `@Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)` for “any admin”; `@Roles(UserRole.SUPER_ADMIN)` for create admin, list admins, delete admin.
- [ ] Student routes: `@Roles(UserRole.STUDENT)`; tutor routes: `@Roles(UserRole.TUTOR)` (optional; currently de facto by URL).

### 4. Admin module

- [x] **Authorization from JWT, not request:** createAdmin, getAdmins, deleteAdmin use RolesGuard(SUPER_ADMIN); no role from query/body for permission.
- [x] CreateAdminDto keeps `role` for the new admin’s role (SUB_ADMIN or SUPER_ADMIN); permission enforced by RolesGuard.
- [x] getAdmins(page, search): no role param; RolesGuard(SUPER_ADMIN).
- [x] deleteAdmin(id): no role param; RolesGuard(SUPER_ADMIN).
- [x] create-admin script: use `UserRole.SUPER_ADMIN` when creating admin.

### 5. Other backend references

- [ ] Replace all `ROLE` (from Prisma) with `UserRole` where used (admin service, controller, DTOs, scripts).
- [ ] Sessions/messages that reference “role” for participants (e.g. LiveKit): keep as-is if they use SENDERTYPE or similar; only auth enum is changing.

---

## Frontend changes

### 1. Sign-in (student / tutor)

- [x] **Single endpoint:** Call `POST /auth/signin` with `{ email, password, role }`. Use `role: 'STUDENT' | 'TUTOR'`.
- [x] Always use `auth/signin` with `role` in body.
- [x] Handle response: same shape; tutor response includes `approved` for pending-approval redirect.
- [x] **Admin:** Keep separate form and `POST /auth/admin/signin`. Store returned role (SUPER_ADMIN / SUB_ADMIN) in auth storage.

### 2. Sign-out

- [ ] **Single endpoint:** All users call `POST /auth/signout` with credentials (cookie + auth header). No query param.
- [ ] One **logout hook** (e.g. `useLogout`) that: calls `POST /auth/signout` with credentials, clears local auth storage and cookie, then redirects. Redirect path can be role-based: admin → `/admin/signin`, others → `/signin`.
- [ ] Remove or refactor `useLogout` (student), `useTutorLogout`, `useAdminLogout` into one hook that uses unified endpoint and redirects by role (from storage before clear, or from a single “user” context).

### 3. Refresh token

- [x] **Single endpoint:** All users call `POST /auth/refresh` (cookie with refresh_token). Backend derives role from RT payload.
- [x] All three refresh hooks now call `auth/refresh`; each stores the new token in its own storage (student/tutor/admin).

### 4. Auth storage & context

- [x] **Admin role in storage:** `AuthAdmin` has `role?: 'SUPER_ADMIN' | 'SUB_ADMIN'`.
- [x] **Admin role values:** CreateAdmin, AllAdmins, AdminSidebar use `SUPER_ADMIN` / `SUB_ADMIN`. AdminSignin stores role in context and storage.

### 5. API calls that send role (admin)

- [x] **CreateAdmin:** Body includes `role` for the new admin (SUB_ADMIN or SUPER_ADMIN). Permission from JWT (RolesGuard).
- [x] **AllAdmins (list):** No `role` in params. Backend uses JWT.
- [x] **Delete admin:** No `role` in params.
- [x] **CreateAdmin / AllAdmins / AdminSidebar:** Use `SUPER_ADMIN` / `SUB_ADMIN`; sidebar shows “Create Admin” etc. when `role === 'SUPER_ADMIN'`.

### 6. Axios / interceptors

- [ ] If you have separate axios instances or interceptors per “user type” (student, tutor, admin), consider one private axios that calls unified `auth/refresh` and stores token in one place (or three places keyed by role). Ensure the correct token is sent per route (student vs tutor vs admin) — e.g. from a single context that holds `{ user, role }` and sets header from that.
- [ ] Ensure 401/403 triggers refresh then retry using unified `auth/refresh`.

### 7. Middleware (Next.js)

- [ ] Protect routes by role where needed. You may have paths like `/student/*`, `/tutor/*`, `/admin/*`. Middleware can read role from cookie or a single auth cookie set after login; redirect unauthenticated to `/signin` or `/admin/signin` based on path.
- [ ] If you store role in a cookie or in the same auth_session payload, middleware can allow only STUDENT on student routes, only TUTOR on tutor routes, only SUPER_ADMIN/SUB_ADMIN on admin routes.

### 8. Files to touch (frontend checklist)

- [x] `components/pages/Signin.tsx` — single endpoint `auth/signin`, body includes role STUDENT/TUTOR
- [x] `components/pages/AdminSignin.tsx` — store role (SUPER_ADMIN/SUB_ADMIN) in storage and context
- [x] `hooks/useLogout.ts`, `useTutorLogout.ts`, `useAdminLogout.ts` — all call `auth/signout` with private axios
- [x] `hooks/useRefreshToken.ts`, `useTutorRefreshToken.ts`, `useAdminRefreshToken.ts` — all call `auth/refresh`
- [ ] `hooks/useAxiosPrivate.ts`, etc. — no change; already use correct token per role
- [x] `utils/authStorage.ts` — AuthAdmin.role type SUPER_ADMIN | SUB_ADMIN
- [x] `components/pages/admin/CreateAdmin.tsx` — role state SUB_ADMIN/SUPER_ADMIN; send in body for new admin
- [x] `components/pages/admin/AllAdmins.tsx` — remove role from API params
- [ ] `middleware.ts` — no change required
- [x] `components/navigation/AdminSidebar.tsx` — use SUPER_ADMIN for SUPER-only UI
- [ ] Context providers — keep three; admin context gets role from storage

---

## Progress summary

| Area              | Status   | Notes |
|-------------------|----------|--------|
| Schema & migration| Done     | UserRole enum; Admin.role migrated SUPER→SUPER_ADMIN, SUB→SUB_ADMIN |
| Auth (signin/out/refresh, JWT) | Done | One signin (body: role), one signout, one refresh; role in JWT |
| Guards & RBAC     | Done     | RolesGuard + @Roles(); admin routes use SUPER_ADMIN/SUB_ADMIN |
| Admin module (JWT role) | Done | createAdmin/getAdmins/deleteAdmin use JWT, no client role param |
| Frontend signin   | Done     | Single auth/signin with role STUDENT/TUTOR; admin separate form |
| Frontend logout/refresh | Done | All call auth/signout and auth/refresh; logout uses private axios |
| Frontend storage & admin UI | Done | AuthAdmin.role SUPER_ADMIN\|SUB_ADMIN; CreateAdmin/AllAdmins updated |
| Middleware        | Pending  | No change required for role values |

---

## Reminder

- **One enum:** `UserRole` = STUDENT, TUTOR, SUPER_ADMIN, SUB_ADMIN. Drop old `ROLE`.
- **One sign-in** for student/tutor (body has role); **one sign-out** and **one refresh** for everyone; **role in JWT** for RBAC.
- **Admin permission:** Backend gets “is SUPER_ADMIN” from JWT (load admin by sub, check role), not from client-sent role param.
- **Tables:** Student, Tutor, Admin stay separate; only Admin.role type and enum name change.
