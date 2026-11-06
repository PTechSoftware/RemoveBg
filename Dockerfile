# Stage 1: Build Frontend
FROM node:24-alpine AS frontend-build

WORKDIR /app-frontend

COPY frontend/package*.json frontend/.npmrc ./
RUN npm install

COPY frontend/ .
RUN npm run build


# Stage 2: Build Rust Backend (Hexagonal Architecture + Actix-Web + ONNX Runtime)
FROM rust:1-bookworm AS backend-build

WORKDIR /app-backend

# Provide C23 / libstdc++13 compatibility symbols required by prebuilt ort-sys static lib on Bookworm
RUN cat << 'EOF' > /tmp/ort_compat.cpp
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

extern "C" {
long __isoc23_strtol(const char* nptr, char** endptr, int base) {
    return strtol(nptr, endptr, base);
}
long long __isoc23_strtoll(const char* nptr, char** endptr, int base) {
    return strtoll(nptr, endptr, base);
}
unsigned long long __isoc23_strtoull(const char* nptr, char** endptr, int base) {
    return strtoull(nptr, endptr, base);
}
}

namespace std {
template<typename _CharT> struct char_traits;
template<typename _Tp> class allocator;

namespace __cxx11 {
template<typename _CharT, typename _Traits, typename _Alloc>
class basic_string {
public:
    void _M_replace_cold(_CharT* __p, unsigned long __len1, const _CharT* __s,
                         unsigned long __len2, unsigned long __how_much);
};

template<>
void basic_string<char, char_traits<char>, allocator<char>>::_M_replace_cold(
    char* __p, unsigned long __len1, const char* __s,
    unsigned long __len2, unsigned long __how_much) {
    if (__how_much && __len1 != __len2) {
        memmove(__p + __len2, __p + __len1, __how_much);
    }
    if (__s > __p && __s < __p + __len1) {
        if (__s + __len2 <= __p + __len1) {
            memmove(__p, __s, __len2);
        } else {
            const unsigned long __nleft = (__p + __len1) - __s;
            memmove(__p, __s, __nleft);
            memcpy(__p + __nleft, __p + __len2, __len2 - __nleft);
        }
    } else {
        memmove(__p, __s, __len2);
    }
}

template<>
void basic_string<wchar_t, char_traits<wchar_t>, allocator<wchar_t>>::_M_replace_cold(
    wchar_t* __p, unsigned long __len1, const wchar_t* __s,
    unsigned long __len2, unsigned long __how_much) {
    if (__how_much && __len1 != __len2) {
        memmove(__p + __len2, __p + __len1, __how_much * sizeof(wchar_t));
    }
    if (__s > __p && __s < __p + __len1) {
        if (__s + __len2 <= __p + __len1) {
            memmove(__p, __s, __len2 * sizeof(wchar_t));
        } else {
            const unsigned long __nleft = (__p + __len1) - __s;
            memmove(__p, __s, __nleft * sizeof(wchar_t));
            memcpy(__p + __nleft, __p + __len2, (__len2 - __nleft) * sizeof(wchar_t));
        }
    } else {
        memmove(__p, __s, __len2 * sizeof(wchar_t));
    }
}
} // namespace __cxx11
} // namespace std
EOF
RUN g++ -O2 -fPIC -c /tmp/ort_compat.cpp -o /tmp/ort_compat.o && \
    ar rcs /usr/lib/x86_64-linux-gnu/libc_nonshared.a /tmp/ort_compat.o

COPY backend/Cargo.toml backend/Cargo.lock* ./
COPY backend/src ./src

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/root/.cache/ort.pyke.io \
    --mount=type=cache,target=/app-backend/target \
    cargo build --release && \
    cp /app-backend/target/release/removebg-backend /usr/local/bin/removebg-backend


# Stage 3: Final Runtime Image
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && mkdir -p /app/models \
    && rm -rf /var/lib/apt/lists/*

ENV U2NET_HOME=/app/models
ENV HOST=0.0.0.0
ENV PORT=8000
ENV RUST_LOG=info

# Copy Rust binary from Stage 2
COPY --from=backend-build /usr/local/bin/removebg-backend /app/removebg-backend

# Copy Frontend Build from Stage 1
COPY --from=frontend-build /app-frontend/dist /app/static

EXPOSE 8000

CMD ["/app/removebg-backend"]
